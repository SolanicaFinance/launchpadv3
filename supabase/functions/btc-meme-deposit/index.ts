const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MEMPOOL_API = "https://mempool.space/api";
const FETCH_TIMEOUT = 10000;

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    return await fetch(url, { signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface MempoolTxOutput {
  scriptpubkey_address?: string;
  value: number;
}

interface MempoolTx {
  txid: string;
  vin: { prevout: { scriptpubkey_address?: string } }[];
  vout: MempoolTxOutput[];
  status: {
    confirmed: boolean;
    block_height?: number;
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { walletAddress, txid, action } = body as { walletAddress?: string; txid?: string; action?: string };

    const platformAddress = Deno.env.get("BTC_PLATFORM_DEPOSIT_ADDRESS") || Deno.env.get("BTC_PLATFORM_ADDRESS");

    // --- Action: get deposit address ---
    if (!walletAddress && !txid && !action) {
      if (!platformAddress) {
        return respond({ error: "Platform deposit address not configured" }, 500);
      }
      return respond({ depositAddress: platformAddress });
    }

    // --- Action: scan-deposits ---
    if (action === "scan-deposits") {
      if (!walletAddress || !platformAddress) {
        return respond({ error: "walletAddress required" }, 400);
      }

      const supabase = getSupabase();

      let allTxs: MempoolTx[] = [];
      try {
        const txsRes = await fetchWithTimeout(`${MEMPOOL_API}/address/${platformAddress}/txs`);
        if (!txsRes.ok) {
          console.error(`[btc-meme-deposit] mempool.space returned ${txsRes.status}`);
          return respond({ deposits: [], depositAddress: platformAddress, warning: "mempool.space unavailable" });
        }
        allTxs = await txsRes.json();
      } catch (e) {
        console.error("[btc-meme-deposit] mempool.space fetch failed:", e);
        return respond({ deposits: [], depositAddress: platformAddress, warning: "mempool.space timeout" });
      }

      const userDeposits: {
        txid: string;
        amountBtc: number;
        confirmed: boolean;
        blockHeight: number | null;
        credited: boolean;
      }[] = [];

      for (const tx of allTxs) {
        const senderAddresses = tx.vin.map(v => v.prevout?.scriptpubkey_address).filter(Boolean);
        if (!senderAddresses.includes(walletAddress)) continue;

        let totalSats = 0;
        const vouts: number[] = [];
        for (let i = 0; i < tx.vout.length; i++) {
          if (tx.vout[i].scriptpubkey_address === platformAddress) {
            totalSats += tx.vout[i].value;
            vouts.push(i);
          }
        }
        if (totalSats === 0) continue;

        const { data: ledgerRows } = await supabase
          .from("btc_deposit_ledger")
          .select("vout")
          .eq("txid", tx.txid)
          .eq("wallet_address", walletAddress);

        const creditedVouts = new Set((ledgerRows || []).map((r: { vout: number }) => r.vout));
        const allCredited = vouts.every(v => creditedVouts.has(v));

        // Auto-credit if confirmed and not yet credited
        if (tx.status.confirmed && !allCredited) {
          let credited = 0;
          for (const voutIdx of vouts) {
            if (creditedVouts.has(voutIdx)) continue;
            const amountBtc = tx.vout[voutIdx].value / 1e8;

            const { error: insertErr } = await supabase.from("btc_deposit_ledger").insert({
              wallet_address: walletAddress,
              amount_btc: amountBtc,
              txid: tx.txid,
              vout: voutIdx,
              confirmed: true,
              block_height: tx.status.block_height || null,
            });

            if (!insertErr) {
              credited += amountBtc;
            }
          }

          if (credited > 0) {
            const { data: existing } = await supabase
              .from("btc_trading_balances")
              .select("balance_btc, total_deposited")
              .eq("wallet_address", walletAddress)
              .maybeSingle();

            if (existing) {
              await supabase.from("btc_trading_balances").update({
                balance_btc: existing.balance_btc + credited,
                total_deposited: (existing.total_deposited || 0) + credited,
                updated_at: new Date().toISOString(),
              }).eq("wallet_address", walletAddress);
            } else {
              await supabase.from("btc_trading_balances").insert({
                wallet_address: walletAddress,
                balance_btc: credited,
                total_deposited: credited,
              });
            }
            console.log(`[btc-meme-deposit] ✅ Auto-credited ${credited} BTC from ${walletAddress} (tx: ${tx.txid})`);
          }
        }

        userDeposits.push({
          txid: tx.txid,
          amountBtc: totalSats / 1e8,
          confirmed: tx.status.confirmed,
          blockHeight: tx.status.block_height || null,
          credited: allCredited || tx.status.confirmed,
        });
      }

      return respond({ deposits: userDeposits, depositAddress: platformAddress });
    }

    return respond({ error: "Use action: 'scan-deposits' with walletAddress for automatic deposit detection." }, 400);
  } catch (error) {
    console.error("[btc-meme-deposit] Error:", error);
    return respond({ error: error instanceof Error ? error.message : "Internal error" }, 500);
  }
});
