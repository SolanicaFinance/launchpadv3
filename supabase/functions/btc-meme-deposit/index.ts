const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const MEMPOOL_API = "https://mempool.space/api";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
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
    const body = await req.json();
    const { walletAddress, txid, action } = body;

    const platformAddress = Deno.env.get("BTC_PLATFORM_DEPOSIT_ADDRESS") || Deno.env.get("BTC_PLATFORM_ADDRESS");

    // --- Action: get deposit address ---
    if (!walletAddress && !txid && !action) {
      if (!platformAddress) {
        return new Response(JSON.stringify({ error: "Platform deposit address not configured" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ depositAddress: platformAddress }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Action: scan-deposits — auto-detect incoming txs from connected wallet ---
    if (action === "scan-deposits") {
      if (!walletAddress || !platformAddress) {
        return new Response(JSON.stringify({ error: "walletAddress required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = getSupabase();

      // Fetch recent txs to the platform deposit address
      const txsRes = await fetch(`${MEMPOOL_API}/address/${platformAddress}/txs`);
      if (!txsRes.ok) throw new Error(`mempool.space address txs returned ${txsRes.status}`);
      const allTxs: MempoolTx[] = await txsRes.json();

      // Filter: only txs where at least one input is from the connected wallet
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

        // Sum outputs going to platform address
        let totalSats = 0;
        const vouts: number[] = [];
        for (let i = 0; i < tx.vout.length; i++) {
          if (tx.vout[i].scriptpubkey_address === platformAddress) {
            totalSats += tx.vout[i].value;
            vouts.push(i);
          }
        }
        if (totalSats === 0) continue;

        // Check if already credited in ledger
        const { data: ledgerRows } = await supabase
          .from("btc_deposit_ledger")
          .select("vout")
          .eq("txid", tx.txid)
          .eq("wallet_address", walletAddress);

        const creditedVouts = new Set((ledgerRows || []).map(r => r.vout));
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
            // Credit trading balance
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
          credited: allCredited || tx.status.confirmed, // will be credited after this call
        });
      }

      return new Response(JSON.stringify({ deposits: userDeposits, depositAddress: platformAddress }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Legacy: manual txid verification (kept for backwards compat) ---
    if (!walletAddress || !txid) {
      return new Response(JSON.stringify({ error: "walletAddress and txid are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!/^[a-fA-F0-9]{64}$/.test(txid)) {
      return new Response(JSON.stringify({ error: "Invalid transaction ID format" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!platformAddress) {
      return new Response(JSON.stringify({ error: "Platform deposit address not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Rate limit
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from("btc_deposit_ledger")
      .select("*", { count: "exact", head: true })
      .eq("wallet_address", walletAddress)
      .gte("created_at", oneHourAgo);

    if ((recentCount || 0) >= 5) {
      return new Response(JSON.stringify({ error: "Rate limit: max 5 deposits per hour." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const txRes = await fetch(`${MEMPOOL_API}/tx/${txid}`);
    if (!txRes.ok) {
      if (txRes.status === 404) {
        return new Response(JSON.stringify({ error: "Transaction not found. Try again in a minute." }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`mempool.space returned ${txRes.status}`);
    }

    const txData: MempoolTx = await txRes.json();

    if (!txData.status.confirmed) {
      return new Response(JSON.stringify({ error: "Transaction unconfirmed. Wait for ≥1 confirmation." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const senderAddresses = txData.vin.map(v => v.prevout?.scriptpubkey_address).filter(Boolean);
    if (!senderAddresses.includes(walletAddress)) {
      return new Response(JSON.stringify({ error: "Transaction not sent from your wallet." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const platformOutputs = txData.vout
      .map((out, index) => ({ ...out, vout: index }))
      .filter(out => out.scriptpubkey_address === platformAddress);

    if (platformOutputs.length === 0) {
      return new Response(JSON.stringify({ error: "Transaction does not pay to the deposit address." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCredited = 0;
    let alreadyClaimed = 0;

    for (const out of platformOutputs) {
      const amountBtc = out.value / 1e8;
      const { error: insertErr } = await supabase.from("btc_deposit_ledger").insert({
        wallet_address: walletAddress,
        amount_btc: amountBtc,
        txid,
        vout: out.vout,
        confirmed: true,
        block_height: txData.status.block_height || null,
      });

      if (insertErr) {
        if (insertErr.code === "23505") { alreadyClaimed++; continue; }
        console.error("[btc-meme-deposit] Ledger insert error:", insertErr);
        continue;
      }
      totalCredited += amountBtc;
    }

    if (totalCredited === 0) {
      if (alreadyClaimed > 0) {
        return new Response(JSON.stringify({ error: "Already credited." }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "No creditable outputs." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existing } = await supabase
      .from("btc_trading_balances")
      .select("balance_btc, total_deposited")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existing) {
      await supabase.from("btc_trading_balances").update({
        balance_btc: existing.balance_btc + totalCredited,
        total_deposited: (existing.total_deposited || 0) + totalCredited,
        updated_at: new Date().toISOString(),
      }).eq("wallet_address", walletAddress);
    } else {
      await supabase.from("btc_trading_balances").insert({
        wallet_address: walletAddress,
        balance_btc: totalCredited,
        total_deposited: totalCredited,
      });
    }

    const newBalance = (existing?.balance_btc || 0) + totalCredited;
    console.log(`[btc-meme-deposit] ✅ Verified deposit: ${totalCredited} BTC from ${walletAddress} (tx: ${txid})`);

    return new Response(JSON.stringify({
      success: true, credited: totalCredited, balance: newBalance,
      txid, blockHeight: txData.status.block_height, alreadyClaimed,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-deposit] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
