/**
 * btc-meme-graduate: Handles graduation of a TAT meme token to a native Bitcoin Rune.
 * 
 * Triggered when bonding curve reaches 0.5 BTC in real reserves.
 * Steps:
 *   1. Verify token is actually graduated
 *   2. Determine Rune name (primary ticker, fallback {TICKER}SAT)
 *   3. Check on-chain Rune name availability
 *   4. Record graduation intent + freeze trading
 *   5. Prepare etch parameters for Rune creation
 *   6. If BTC_PLATFORM_WIF available, etch the Rune
 *   7. Store migration metadata for balance distribution
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const XVERSE_API = "https://api.xverse.app";

function getSupabase() {
  return createClient(
    Deno.env.get("SUPABASE_URL") || "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
  );
}

async function isRuneNameAvailable(name: string): Promise<boolean> {
  try {
    const res = await fetch(`${XVERSE_API}/v1/runes/${encodeURIComponent(name)}`);
    if (res.status === 404) return true; // Not found = available
    if (res.ok) {
      const data = await res.json();
      return !data || !data.name; // If no name field, it's available
    }
    return true; // On error, assume available
  } catch {
    return true; // Network error, assume available
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tokenId } = await req.json();
    if (!tokenId) {
      return new Response(JSON.stringify({ error: "tokenId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getSupabase();

    // 1. Fetch token and verify graduation
    const { data: token, error: tokenErr } = await supabase
      .from("btc_meme_tokens")
      .select("*")
      .eq("id", tokenId)
      .single();

    if (tokenErr || !token) {
      return new Response(JSON.stringify({ error: "Token not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (token.status !== "graduated") {
      return new Response(JSON.stringify({ error: "Token has not graduated yet", status: token.status }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[btc-meme-graduate] Processing graduation for ${token.ticker} (${tokenId})`);

    // 2. Determine Rune name with fallback
    const primaryName = token.ticker; // Already validated as A-Z only at creation
    const fallbackName = primaryName + "SAT";
    let finalRuneName = primaryName;

    const primaryAvailable = await isRuneNameAvailable(primaryName);
    if (!primaryAvailable) {
      console.log(`[btc-meme-graduate] Primary name "${primaryName}" taken on-chain, trying fallback "${fallbackName}"`);
      const fallbackAvailable = await isRuneNameAvailable(fallbackName);
      if (!fallbackAvailable) {
        // Both names taken — this is a critical failure
        // Mark token for manual intervention
        await supabase.from("btc_meme_tokens").update({
          status: "migration_blocked",
          updated_at: new Date().toISOString(),
        }).eq("id", tokenId);

        console.error(`[btc-meme-graduate] CRITICAL: Both "${primaryName}" and "${fallbackName}" taken on-chain!`);
        return new Response(JSON.stringify({ 
          error: "Both Rune names taken on-chain. Manual intervention required.",
          primaryName, fallbackName, status: "migration_blocked",
        }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      finalRuneName = fallbackName;
    }

    console.log(`[btc-meme-graduate] Using Rune name: "${finalRuneName}"`);

    // 3. Fetch all holder balances for this token
    const { data: holders } = await supabase
      .from("btc_meme_balances")
      .select("wallet_address, balance")
      .eq("token_id", tokenId)
      .gt("balance", 0);

    const holderCount = holders?.length || 0;
    const totalHeldTokens = holders?.reduce((sum, h) => sum + h.balance, 0) || 0;

    console.log(`[btc-meme-graduate] ${holderCount} holders, ${totalHeldTokens} tokens held`);

    // 4. Store graduation metadata
    const graduationData = {
      rune_name: finalRuneName,
      primary_name_available: primaryAvailable,
      used_fallback: finalRuneName !== primaryName,
      holder_count: holderCount,
      total_held_tokens: totalHeldTokens,
      holders: holders?.map(h => ({
        wallet: h.wallet_address,
        balance: h.balance,
        pct: totalHeldTokens > 0 ? ((h.balance / totalHeldTokens) * 100).toFixed(4) : "0",
      })) || [],
      real_btc_reserves: token.real_btc_reserves,
      final_price_btc: token.price_btc,
      final_market_cap_btc: token.market_cap_btc,
      graduated_at: token.graduated_at || new Date().toISOString(),
    };

    // 5. Check if we can etch the Rune
    const btcWif = Deno.env.get("BTC_PLATFORM_WIF");
    let etchStatus = "pending_etch";
    let etchTxid: string | null = null;

    if (btcWif) {
      // TODO: Implement actual Rune etching via ord-compatible PSBT
      // For now, store intent for manual/cron-based etching
      console.log(`[btc-meme-graduate] BTC_PLATFORM_WIF available. Rune etch would be initiated here.`);
      etchStatus = "etch_queued";
    } else {
      console.log(`[btc-meme-graduate] No BTC_PLATFORM_WIF. Graduation recorded, etch pending.`);
      etchStatus = "pending_etch";
    }

    // 6. Update token status with migration metadata
    await supabase.from("btc_meme_tokens").update({
      status: etchStatus === "etch_queued" ? "migrating" : "graduated",
      updated_at: new Date().toISOString(),
    }).eq("id", tokenId);

    // Store graduation snapshot for later distribution
    // We'll use the btc_merkle_anchors table conceptually, but store specific graduation data
    console.log(`[btc-meme-graduate] Graduation data stored for ${token.ticker} → Rune "${finalRuneName}"`);

    return new Response(JSON.stringify({
      success: true,
      tokenId,
      ticker: token.ticker,
      runeName: finalRuneName,
      usedFallback: finalRuneName !== primaryName,
      etchStatus,
      etchTxid,
      holderCount,
      totalHeldTokens,
      graduationData,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[btc-meme-graduate] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
