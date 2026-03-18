import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  getPrivyUser,
  findSolanaEmbeddedWallet,
  signAndSendTransaction,
} from "../_shared/privy-server-wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_PASSWORD = "saturn135@";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const rawBody = await req.text();
    const {
      adminPassword,
      userIdentifier, // wallet address, profile ID, or privy DID
      mintAddress,
      amount,
      isBuy = true,
      slippageBps = 3000,
    } = JSON.parse(rawBody);

    // Validate admin
    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!userIdentifier || !mintAddress || !amount) {
      return new Response(
        JSON.stringify({ error: "userIdentifier, mintAddress, and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Log the attempt
    const { data: logEntry } = await supabase
      .from("assisted_swaps_log")
      .insert({
        user_identifier: userIdentifier,
        mint_address: mintAddress,
        amount: Number(amount),
        is_buy: isBuy,
        slippage_bps: slippageBps,
        status: "processing",
      })
      .select("id")
      .single();

    const logId = logEntry?.id;

    // ── Resolve user wallet ──
    let resolvedWalletId: string | null = null;
    let resolvedWalletAddress: string | null = null;
    let resolvedProfileId: string | null = null;

    const identifier = userIdentifier.trim();
    const isPrivyDid = identifier.startsWith("did:privy:");
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const isWalletAddress = !isPrivyDid && !isUuid;

    if (isPrivyDid) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("privy_did", identifier)
        .maybeSingle();
      if (profile) {
        resolvedProfileId = profile.id;
        resolvedWalletAddress = profile.solana_wallet_address;
        resolvedWalletId = profile.privy_wallet_id;
      }
      // If no cached wallet ID, fetch from Privy
      if (!resolvedWalletId) {
        const user = await getPrivyUser(identifier);
        const wallet = findSolanaEmbeddedWallet(user);
        if (wallet) {
          resolvedWalletId = wallet.walletId;
          resolvedWalletAddress = wallet.address;
        }
      }
    } else if (isUuid) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("id", identifier)
        .maybeSingle();
      if (profile) {
        resolvedProfileId = profile.id;
        resolvedWalletAddress = profile.solana_wallet_address;
        resolvedWalletId = profile.privy_wallet_id;
        if (!resolvedWalletId && profile.privy_did) {
          const user = await getPrivyUser(profile.privy_did);
          const wallet = findSolanaEmbeddedWallet(user);
          if (wallet) {
            resolvedWalletId = wallet.walletId;
            resolvedWalletAddress = wallet.address;
          }
        }
      }
    } else {
      // Wallet address
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("solana_wallet_address", identifier)
        .maybeSingle();
      if (profile) {
        resolvedProfileId = profile.id;
        resolvedWalletId = profile.privy_wallet_id;
        resolvedWalletAddress = profile.solana_wallet_address;
        if (!resolvedWalletId && profile.privy_did) {
          const user = await getPrivyUser(profile.privy_did);
          const wallet = findSolanaEmbeddedWallet(user);
          if (wallet) {
            resolvedWalletId = wallet.walletId;
            resolvedWalletAddress = wallet.address;
          }
        }
      }
    }

    if (!resolvedWalletId || !resolvedWalletAddress) {
      const errMsg = "Could not resolve Privy embedded wallet for this user";
      if (logId) {
        await supabase.from("assisted_swaps_log").update({
          status: "failed", error_message: errMsg, resolved_wallet: resolvedWalletAddress,
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update log with resolved wallet
    if (logId) {
      await supabase.from("assisted_swaps_log").update({
        resolved_wallet: resolvedWalletAddress,
      }).eq("id", logId);
    }

    console.log(`[admin-swap] Wallet: ${resolvedWalletAddress}, WalletID: ${resolvedWalletId}`);
    console.log(`[admin-swap] ${isBuy ? "BUY" : "SELL"} ${amount} on ${mintAddress}`);

    // ── Build swap transaction via Meteora API ──
    let meteoraApiUrl = Deno.env.get("METEORA_API_URL") || "https://saturntrade.vercel.app";
    if (!meteoraApiUrl.startsWith("http")) meteoraApiUrl = `https://${meteoraApiUrl}`;

    const swapPayload = {
      mintAddress,
      userWallet: resolvedWalletAddress,
      amount: Number(amount),
      isBuy,
      slippageBps,
    };

    const swapRes = await fetch(`${meteoraApiUrl}/api/swap/execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(swapPayload),
    });

    const swapResult = await swapRes.json();

    if (!swapResult.success && !swapResult.serializedTransaction && !swapResult.transaction) {
      const errMsg = swapResult.error || "Failed to build swap transaction";
      if (logId) {
        await supabase.from("assisted_swaps_log").update({
          status: "failed", error_message: errMsg,
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const encodedTx = swapResult.serializedTransaction || swapResult.transaction;
    if (!encodedTx) {
      const errMsg = "No serialized transaction returned from swap API";
      if (logId) {
        await supabase.from("assisted_swaps_log").update({
          status: "failed", error_message: errMsg,
        }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert base58 tx to base64 for Privy
    const bs58 = await import("npm:bs58@6.0.0");
    const txBytes = bs58.default.decode(encodedTx);
    const txBase64 = btoa(String.fromCharCode(...txBytes));

    // ── Sign and send via Privy ──
    console.log("[admin-swap] Signing via Privy server wallet...");
    const signature = await signAndSendTransaction(resolvedWalletId, txBase64, heliusRpcUrl);

    console.log(`[admin-swap] ✅ TX sent: ${signature}`);

    // Update log with success
    if (logId) {
      await supabase.from("assisted_swaps_log").update({
        status: "success",
        tx_signature: signature,
      }).eq("id", logId);
    }

    // Record in launchpad_transactions
    const { data: tokenData } = await supabase
      .from("tokens").select("id").eq("mint_address", mintAddress).maybeSingle();
    const { data: funTokenData } = await supabase
      .from("fun_tokens").select("id").eq("mint_address", mintAddress).maybeSingle();
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
    console.error("[admin-swap] Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
