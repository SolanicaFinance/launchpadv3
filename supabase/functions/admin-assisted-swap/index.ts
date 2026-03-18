import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  resolvePrivyUser,
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
      userIdentifier,
      mintAddress,
      amount,
      isBuy = true,
      slippageBps = 3000,
    } = JSON.parse(rawBody);

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

    // ── 1. Resolve user identifier → wallet address + Privy wallet ID ──
    let walletAddress: string | null = null;
    let walletId: string | null = null;
    let resolvedPrivyDid: string | null = null;
    const identifier = userIdentifier.trim();

    // Try DB first (profile lookup)
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const isSolanaAddress = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(identifier);

    if (isUuid) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("id", identifier)
        .maybeSingle();
      if (profile) {
        walletAddress = profile.solana_wallet_address;
        walletId = profile.privy_wallet_id;
        resolvedPrivyDid = profile.privy_did;
      }
    } else if (isSolanaAddress) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, privy_wallet_id, privy_did, solana_wallet_address")
        .eq("solana_wallet_address", identifier)
        .maybeSingle();
      if (profile) {
        walletAddress = profile.solana_wallet_address;
        walletId = profile.privy_wallet_id;
        resolvedPrivyDid = profile.privy_did;
      } else {
        walletAddress = identifier; // external wallet, can't sign server-side
      }
    } else {
      // Treat as Privy wallet ID or DID
      resolvedPrivyDid = identifier.startsWith("did:privy:") ? identifier : `did:privy:${identifier}`;
    }

    // If we still need the wallet ID, resolve via Privy API
    if (!walletId && resolvedPrivyDid) {
      console.log(`[admin-swap] Resolving Privy user: ${resolvedPrivyDid}`);
      const user = await resolvePrivyUser(resolvedPrivyDid);
      if (user) {
        const wallet = findSolanaEmbeddedWallet(user);
        if (wallet) {
          walletId = wallet.walletId;
          walletAddress = wallet.address;
        }
      }
    }

    // Also try raw identifier as Privy ID
    if (!walletId) {
      console.log(`[admin-swap] Trying raw identifier as Privy ID: ${identifier}`);
      try {
        const user = await resolvePrivyUser(identifier);
        if (user) {
          const wallet = findSolanaEmbeddedWallet(user);
          if (wallet) {
            walletId = wallet.walletId;
            walletAddress = wallet.address;
            resolvedPrivyDid = user.id;
          }
        }
      } catch (e) {
        console.warn(`[admin-swap] Raw Privy lookup failed: ${e}`);
      }
    }

    if (!walletAddress) {
      return new Response(
        JSON.stringify({ error: "Could not resolve wallet address from identifier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!walletId) {
      return new Response(
        JSON.stringify({
          error: "Could not find Privy wallet ID for this user. Server-side signing requires an embedded Privy wallet.",
          walletAddress,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-swap] Resolved wallet: ${walletAddress} (walletId: ${walletId})`);
    console.log(`[admin-swap] ${isBuy ? "BUY" : "SELL"} ${amount} on ${mintAddress}`);

    // ── 2. Log the attempt ──
    const { data: logEntry } = await supabase
      .from("assisted_swaps_log")
      .insert({
        user_identifier: identifier,
        mint_address: mintAddress,
        amount: Number(amount),
        is_buy: isBuy,
        slippage_bps: slippageBps,
        status: "processing",
        resolved_wallet: walletAddress,
        executed_by: "privy_server",
      })
      .select("id")
      .single();
    const logId = logEntry?.id;

    // ── 3. Build swap tx via PumpPortal for the USER's wallet ──
    const slippagePercent = Math.max(1, Math.ceil(Number(slippageBps) / 100));

    const pumpRes = await fetch("https://pumpportal.fun/api/trade-local", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        publicKey: walletAddress,
        action: isBuy ? "buy" : "sell",
        mint: mintAddress,
        amount: Number(amount),
        denominatedInSol: isBuy ? "true" : "false",
        slippage: slippagePercent,
        priorityFee: 0.0005,
        pool: "pump",
      }),
    });

    if (!pumpRes.ok) {
      const errText = await pumpRes.text();
      const errMsg = `PumpPortal error (${pumpRes.status}): ${errText}`;
      console.error("[admin-swap]", errMsg);
      if (logId) {
        await supabase.from("assisted_swaps_log").update({ status: "failed", error_message: errMsg }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ error: errMsg }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 4. Convert to base64 and sign via Privy ──
    const txBytes = new Uint8Array(await pumpRes.arrayBuffer());
    const txBase64 = btoa(String.fromCharCode(...txBytes));

    console.log("[admin-swap] Signing via Privy server wallet:", walletId);

    let signature: string;
    try {
      signature = await signAndSendTransaction(walletId, txBase64, heliusRpcUrl);
    } catch (signError: unknown) {
      const errMsg = signError instanceof Error ? signError.message : String(signError);
      console.error("[admin-swap] Privy signing failed:", errMsg);
      if (logId) {
        await supabase.from("assisted_swaps_log").update({ status: "failed", error_message: errMsg }).eq("id", logId);
      }
      return new Response(
        JSON.stringify({ error: errMsg, walletAddress }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-swap] ✅ TX signed & sent: ${signature}`);

    // ── 5. Update log ──
    if (logId) {
      await supabase.from("assisted_swaps_log").update({
        status: "success",
        tx_signature: signature,
      }).eq("id", logId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        walletAddress,
        walletId,
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
