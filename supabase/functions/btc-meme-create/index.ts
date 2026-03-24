const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const TOTAL_SUPPLY = 1_000_000_000;
const INITIAL_VIRTUAL_BTC = 0.3; // 30,000,000 sats per TAT spec
const INITIAL_VIRTUAL_TOKENS = 1_073_000_000; // Per TAT spec
const REAL_TOKEN_RESERVES = 800_000_000;
const GRADUATION_THRESHOLD_BTC = 0.5; // 50,000,000 sats
const PLATFORM_FEE_BPS = 100; // 1% platform fee per TAT spec

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

const LAUNCH_FEE_SATS = 10_000; // 10,000 sats (~$1) to cover OP_RETURN genesis miner fee

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Preflight: return platform deposit address and launch fee
  if (req.method === "GET") {
    const platformAddress = Deno.env.get("BTC_PLATFORM_ADDRESS");
    if (!platformAddress) {
      return new Response(JSON.stringify({ error: "Platform address not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({
      platformAddress,
      launchFeeSats: LAUNCH_FEE_SATS,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  try {
    const body = await req.json();
    const { name, ticker, description, imageUrl, websiteUrl, twitterUrl, creatorWallet, initialBuyBtc, creatorFeeBps, paymentTxId, genesisEmbedded } = body;

    if (!name || !ticker || !creatorWallet) {
      return new Response(JSON.stringify({ error: "name, ticker, and creatorWallet required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Require payment transaction ID
    if (!paymentTxId) {
      return new Response(JSON.stringify({ error: "Payment transaction required. Send BTC from your wallet to launch." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify payment tx exists on mempool (basic check - tx was broadcast)
    console.log(`[btc-meme-create] Verifying payment tx: ${paymentTxId}`);
    try {
      const mempoolRes = await fetch(`https://mempool.space/api/tx/${paymentTxId}`);
      if (!mempoolRes.ok) {
        console.warn(`[btc-meme-create] Payment tx not found on mempool yet (status ${mempoolRes.status}), proceeding anyway (may be in mempool)`);
      } else {
        const txData = await mempoolRes.json();
        console.log(`[btc-meme-create] Payment tx verified, outputs: ${txData.vout?.length || 0}`);
      }
    } catch (e) {
      console.warn("[btc-meme-create] Mempool verification failed, proceeding:", e);
    }

    if (ticker.length > 10) {
      return new Response(JSON.stringify({ error: "Ticker must be 10 chars or less" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Rune naming validation ──
    // Rune names must be A-Z only (1-28 chars). Validate ticker conforms.
    const cleanTicker = ticker.toUpperCase().trim().replace(/[^A-Z]/g, "");
    if (cleanTicker.length === 0) {
      return new Response(JSON.stringify({ error: "Ticker must contain at least one letter (A-Z only for Rune compatibility)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cleanTicker !== ticker.toUpperCase().trim()) {
      return new Response(JSON.stringify({ error: "Ticker must be letters only (A-Z) for Bitcoin Rune compatibility. No numbers or special characters." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (cleanTicker.length > 28) {
      return new Response(JSON.stringify({ error: "Rune names can be max 28 characters" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // Check for duplicate ticker in our DB (active or graduated — both block reuse)
    const { data: existing } = await supabase
      .from("btc_meme_tokens")
      .select("id, status")
      .eq("ticker", cleanTicker)
      .in("status", ["active", "pending_genesis", "graduated"])
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: `Ticker $${cleanTicker} already exists` }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also check the fallback name ({TICKER}SAT) isn't taken
    const fallbackTicker = cleanTicker + "SAT";
    if (fallbackTicker.length <= 28) {
      const { data: fallbackExists } = await supabase
        .from("btc_meme_tokens")
        .select("id")
        .eq("ticker", fallbackTicker)
        .in("status", ["active", "pending_genesis", "graduated"])
        .maybeSingle();

      if (fallbackExists) {
        return new Response(JSON.stringify({ error: `Fallback Rune name ${fallbackTicker} already exists. Choose a different ticker.` }), {
          status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ── Check Rune name availability on Bitcoin mainnet via Xverse API ──
    const XVERSE_API = "https://api.xverse.app";
    const runeNamesToCheck = [cleanTicker, fallbackTicker].filter(n => n.length <= 28);
    
    for (const candidateName of runeNamesToCheck) {
      try {
        const runeRes = await fetch(`${XVERSE_API}/v1/runes/${encodeURIComponent(candidateName)}`);
        if (runeRes.ok) {
          const runeData = await runeRes.json();
          if (runeData && runeData.name) {
            // This Rune already exists on Bitcoin mainnet
            if (candidateName === cleanTicker) {
              return new Response(JSON.stringify({ 
                error: `Rune name "${candidateName}" already exists on Bitcoin. Choose a different ticker.`,
                onChainConflict: true,
              }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
            }
            // Fallback name taken — warn but don't block (primary name still works)
            console.warn(`[btc-meme-create] Fallback Rune "${candidateName}" exists on-chain, primary "${cleanTicker}" will be used.`);
          }
        }
        // 404 = name available, which is good
      } catch (e) {
        console.warn("[btc-meme-create] Rune name availability check failed:", e);
        // Don't block launch if API is down
      }
    }

    const virtualBtc = INITIAL_VIRTUAL_BTC;
    const virtualTokens = INITIAL_VIRTUAL_TOKENS;
    const priceBtc = virtualBtc / virtualTokens;
    const marketCapBtc = priceBtc * TOTAL_SUPPLY;

    // If genesis is embedded in the payment PSBT (OP_RETURN), token is immediately active
    const tokenStatus = genesisEmbedded ? "active" : "pending_genesis";
    const genesisTxid = genesisEmbedded ? paymentTxId : null;

    const { data: token, error: tokenErr } = await supabase
      .from("btc_meme_tokens")
      .insert({
        name: name.trim(),
        ticker: cleanTicker,
        description: description?.trim() || null,
        image_url: imageUrl || null,
        website_url: websiteUrl || null,
        twitter_url: twitterUrl || null,
        creator_wallet: creatorWallet,
        total_supply: TOTAL_SUPPLY,
        virtual_btc_reserves: virtualBtc,
        virtual_token_reserves: virtualTokens,
        real_btc_reserves: 0,
        real_token_reserves: REAL_TOKEN_RESERVES,
        price_btc: priceBtc,
        market_cap_btc: marketCapBtc,
        graduation_threshold_btc: GRADUATION_THRESHOLD_BTC,
        bonding_progress: 0,
        platform_fee_bps: PLATFORM_FEE_BPS,
        creator_fee_bps: 0,
        status: tokenStatus,
        payment_tx_id: paymentTxId,
        genesis_txid: genesisTxid,
      })
      .select("id, ticker, price_btc, market_cap_btc")
      .single();

    if (tokenErr) throw tokenErr;

    let devBuyResult = null;
    if (initialBuyBtc && initialBuyBtc > 0) {
      // Register the genesis payment as a confirmed deposit in the ledger
      // so execute_btc_swap recognizes this wallet as having a real deposit
      await supabase.from("btc_deposit_ledger").insert({
        wallet_address: creatorWallet,
        amount_btc: initialBuyBtc,
        txid: paymentTxId,
        vout: 0,
        confirmed: true,
        block_height: null, // will be confirmed later
      }).then(({ error }) => {
        if (error && error.code !== "23505") console.warn("[btc-meme-create] Deposit ledger insert warning:", error);
      });

      await supabase
        .from("btc_trading_balances")
        .upsert({ wallet_address: creatorWallet, balance_btc: initialBuyBtc, total_deposited: initialBuyBtc }, { onConflict: "wallet_address" });

      const feeAmount = initialBuyBtc * (PLATFORM_FEE_BPS / 10000);
      const netBtc = initialBuyBtc - feeAmount;
      const tokensOut = (virtualTokens * netBtc) / (virtualBtc + netBtc);
      const newVirtualBtc = virtualBtc + netBtc;
      const newVirtualTokens = virtualTokens - tokensOut;
      const newRealBtc = netBtc;
      const newPrice = newVirtualBtc / newVirtualTokens;
      const newMcap = newPrice * TOTAL_SUPPLY;
      const newProgress = Math.min((newRealBtc / GRADUATION_THRESHOLD_BTC) * 100, 100);

      await supabase.from("btc_meme_tokens").update({
        virtual_btc_reserves: newVirtualBtc,
        virtual_token_reserves: newVirtualTokens,
        real_btc_reserves: newRealBtc,
        real_token_reserves: REAL_TOKEN_RESERVES - tokensOut,
        price_btc: newPrice, market_cap_btc: newMcap,
        bonding_progress: newProgress, holder_count: 1,
        trade_count: 1, volume_btc: initialBuyBtc,
        updated_at: new Date().toISOString(),
      }).eq("id", token.id);

      await supabase.from("btc_meme_balances").insert({
        token_id: token.id, wallet_address: creatorWallet,
        balance: tokensOut, avg_buy_price_btc: newPrice, total_bought: tokensOut,
      });

      await supabase.from("btc_meme_trades").insert({
        token_id: token.id, wallet_address: creatorWallet,
        trade_type: "buy", btc_amount: initialBuyBtc, token_amount: tokensOut,
        price_btc: newPrice, fee_btc: feeAmount,
        pool_virtual_btc: newVirtualBtc, pool_virtual_tokens: newVirtualTokens,
        pool_real_btc: newRealBtc, bonding_progress: newProgress, market_cap_btc: newMcap,
      });

      await supabase.from("btc_trading_balances").update({
        balance_btc: 0, updated_at: new Date().toISOString(),
      }).eq("wallet_address", creatorWallet);

      devBuyResult = { tokensReceived: tokensOut, priceAfterBuy: newPrice, marketCapAfterBuy: newMcap };
    }

    // Only fire separate genesis proof if OP_RETURN wasn't embedded in payment tx
    if (!genesisEmbedded) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
      const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

      fetch(`${supabaseUrl}/functions/v1/btc-genesis-proof`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          tokenId: token.id,
          ticker: ticker.toUpperCase().trim(),
          name: name.trim(),
          imageUrl: imageUrl || null,
          creatorWallet,
        }),
      }).catch(err => console.warn("[btc-meme-create] Genesis proof fire-and-forget error:", err));

      // Auto-activate fallback for non-embedded genesis
      setTimeout(async () => {
        try {
          const { data: checkToken } = await supabase
            .from("btc_meme_tokens")
            .select("status, payment_tx_id")
            .eq("id", token.id)
            .maybeSingle();
          if (checkToken && checkToken.status === "pending_genesis" && checkToken.payment_tx_id) {
            console.log(`[btc-meme-create] Auto-activating paid token ${token.id} after 60s timeout`);
            await supabase.from("btc_meme_tokens").update({
              status: "active",
              genesis_txid: checkToken.payment_tx_id,
            }).eq("id", token.id);
          }
        } catch (e) {
          console.warn("[btc-meme-create] Auto-activate fallback error:", e);
        }
      }, 60_000);
    } else {
      console.log(`[btc-meme-create] Genesis embedded in payment tx ${paymentTxId} — token ${token.id} is immediately active`);
    }

    return new Response(JSON.stringify({
      success: true,
      token: { id: token.id, ticker: token.ticker, priceBtc: devBuyResult?.priceAfterBuy || token.price_btc, marketCapBtc: devBuyResult?.marketCapAfterBuy || token.market_cap_btc },
      devBuy: devBuyResult,
      genesisEmbedded: !!genesisEmbedded,
      genesisTxid: genesisEmbedded ? paymentTxId : null,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-create] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});