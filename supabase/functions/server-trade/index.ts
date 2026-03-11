import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  getPrivyUser,
  findSolanaEmbeddedWallet,
  signAndSendTransaction,
} from "../_shared/privy-server-wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      privyUserId,   // "did:privy:..." — primary identifier
      profileId,     // UUID fallback
      walletAddress, // wallet fallback
      mintAddress,
      amount,        // SOL for buy, token amount for sell
      isBuy = true,
      slippageBps = 3000,
    } = await req.json();

    if (!mintAddress || !amount) {
      return new Response(
        JSON.stringify({ error: "mintAddress and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 1. Resolve the user's Privy wallet ID ──────────────────────────
    let resolvedWalletId: string | null = null;
    let resolvedWalletAddress: string | null = walletAddress || null;
    let resolvedPrivyDid: string | null = privyUserId || null;
    let resolvedProfileId: string | null = profileId || null;

    // Try DB first (fast path)
    if (privyUserId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("privy_did", privyUserId)
        .maybeSingle();

      if (profile) {
        resolvedProfileId = profile.id;
        resolvedWalletAddress = profile.solana_wallet_address;
        resolvedWalletId = profile.privy_wallet_id;
      }
    } else if (profileId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("id", profileId)
        .maybeSingle();

      if (profile) {
        resolvedPrivyDid = profile.privy_did;
        resolvedWalletAddress = profile.solana_wallet_address;
        resolvedWalletId = profile.privy_wallet_id;
      }
    } else if (walletAddress) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("solana_wallet_address", walletAddress)
        .maybeSingle();

      if (profile) {
        resolvedProfileId = profile.id;
        resolvedPrivyDid = profile.privy_did;
        resolvedWalletId = profile.privy_wallet_id;
      }
    }

    // If we don't have wallet ID cached, fetch from Privy API
    if (!resolvedWalletId && resolvedPrivyDid) {
      console.log(`[server-trade] Fetching wallet from Privy for ${resolvedPrivyDid}`);
      const user = await getPrivyUser(resolvedPrivyDid);
      const wallet = findSolanaEmbeddedWallet(user);

      if (!wallet) {
        return new Response(
          JSON.stringify({ error: "No Solana embedded wallet found for this user" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      resolvedWalletId = wallet.walletId;
      resolvedWalletAddress = wallet.address;

      // Cache for future calls
      if (resolvedProfileId) {
        await supabase
          .from("profiles")
          .update({ privy_wallet_id: wallet.walletId, privy_did: resolvedPrivyDid })
          .eq("id", resolvedProfileId);
      }
    }

    if (!resolvedWalletId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve user wallet. Provide privyUserId, profileId, or walletAddress." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[server-trade] User wallet: ${resolvedWalletAddress}, Privy wallet ID: ${resolvedWalletId}`);
    console.log(`[server-trade] ${isBuy ? "BUY" : "SELL"} ${amount} on ${mintAddress}`);

    // ── 2. Build swap transaction ──────────────────────────────────────
    let meteoraApiUrl = Deno.env.get("METEORA_API_URL") || "https://saturntrade.vercel.app";
    if (!meteoraApiUrl.startsWith("http")) meteoraApiUrl = `https://${meteoraApiUrl}`;

    const swapPayload = {
      mintAddress,
      userWallet: resolvedWalletAddress,
      amount: Number(amount),
      isBuy,
      slippageBps,
    };

    console.log("[server-trade] Building swap via Meteora API:", swapPayload);

    const swapRes = await fetch(`${meteoraApiUrl}/api/swap/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swapPayload),
    });

    const swapResult = await swapRes.json();

    if (!swapResult.success && !swapResult.serializedTransaction && !swapResult.transaction) {
      console.error("[server-trade] Swap build failed:", swapResult);
      return new Response(
        JSON.stringify({ error: swapResult.error || "Failed to build swap transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the serialized transaction (base58 from Meteora API)
    const encodedTx = swapResult.serializedTransaction || swapResult.transaction;
    if (!encodedTx) {
      return new Response(
        JSON.stringify({ error: "No serialized transaction returned from swap API" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert base58 tx to base64 for Privy API
    const bs58 = await import("npm:bs58@6.0.0");
    const txBytes = bs58.default.decode(encodedTx);
    const txBase64 = btoa(String.fromCharCode(...txBytes));

    // ── 3. Sign and send via Privy ─────────────────────────────────────
    console.log("[server-trade] Signing via Privy server wallet...");
    const signature = await signAndSendTransaction(
      resolvedWalletId,
      txBase64,
      heliusRpcUrl
    );

    console.log(`[server-trade] ✅ Transaction sent: ${signature}`);

    // ── 4. Record in launchpad_transactions ────────────────────────────
    // Look up token ID from mint address
    const { data: tokenData } = await supabase
      .from("tokens")
      .select("id")
      .eq("mint_address", mintAddress)
      .maybeSingle();

    const { data: funTokenData } = await supabase
      .from("fun_tokens")
      .select("id")
      .eq("mint_address", mintAddress)
      .maybeSingle();

    const tokenId = tokenData?.id || funTokenData?.id;

    if (tokenId) {
      await supabase.rpc("backend_record_transaction", {
        p_token_id: tokenId,
        p_user_wallet: resolvedWalletAddress,
        p_transaction_type: isBuy ? "buy" : "sell",
        p_sol_amount: isBuy ? Number(amount) : (swapResult.estimatedOutput || 0),
        p_token_amount: isBuy ? (swapResult.estimatedOutput || 0) : Number(amount),
        p_price_per_token: swapResult.pricePerToken || 0,
        p_signature: signature,
        p_user_profile_id: resolvedProfileId,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        walletAddress: resolvedWalletAddress,
        estimatedOutput: swapResult.estimatedOutput,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[server-trade] Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
