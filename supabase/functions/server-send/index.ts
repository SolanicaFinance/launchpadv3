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
};

/**
 * Server-side SOL send — no client popup needed.
 * 
 * Body: { walletAddress, toAddress, amountSol, adminSecret }
 * 
 * Uses Privy server-side signing to build & send a SOL transfer.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { walletAddress, toAddress, amountSol } = await req.json();

    if (!walletAddress || !toAddress || !amountSol) {
      return new Response(
        JSON.stringify({ error: "walletAddress, toAddress, and amountSol are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (amountSol <= 0 || amountSol > 100) {
      return new Response(
        JSON.stringify({ error: "amountSol must be between 0 and 100" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("[server-send] Resolving wallet for:", walletAddress);

    // 1. Look up the user's Privy wallet ID from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, privy_wallet_id, privy_did, solana_wallet_address")
      .eq("solana_wallet_address", walletAddress)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ error: "No profile found for wallet: " + walletAddress }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let walletId = profile.privy_wallet_id;
    const privyDid = profile.privy_did;

    // If no wallet ID cached, resolve from Privy API
    if (!walletId && privyDid) {
      console.log("[server-send] No cached wallet ID, fetching from Privy API...");
      const privyUser = await getPrivyUser(privyDid);
      const embeddedWallet = findSolanaEmbeddedWallet(privyUser);
      if (!embeddedWallet) {
        return new Response(
          JSON.stringify({ error: "No Solana embedded wallet found for this user" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      walletId = embeddedWallet.walletId;

      // Cache it for next time
      await supabase
        .from("profiles")
        .update({ privy_wallet_id: walletId })
        .eq("id", profile.id);
    }

    if (!walletId) {
      return new Response(
        JSON.stringify({ error: "Cannot resolve Privy wallet ID. User may need to log in first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[server-send] Building SOL transfer:", { from: walletAddress, to: toAddress, sol: amountSol });

    // 2. Build the SOL transfer transaction
    // Use @solana/web3.js via esm.sh
    const { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = 
      await import("https://esm.sh/@solana/web3.js@1.98.0");

    const connection = new Connection(heliusRpcUrl, "confirmed");
    const fromPubkey = new PublicKey(walletAddress);
    const toPubkey = new PublicKey(toAddress);
    const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports,
      })
    );

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    transaction.recentBlockhash = blockhash;
    transaction.lastValidBlockHeight = lastValidBlockHeight;
    transaction.feePayer = fromPubkey;

    // 3. Serialize and sign via Privy server-side
    const serialized = transaction.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });
    const base64Tx = btoa(String.fromCharCode(...serialized));

    console.log("[server-send] Signing via Privy wallet:", walletId);
    const signature = await signAndSendTransaction(walletId, base64Tx, heliusRpcUrl);

    console.log("[server-send] ✅ Transaction sent:", signature);

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        from: walletAddress,
        to: toAddress,
        amountSol,
        solscanUrl: `https://solscan.io/tx/${signature}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[server-send] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
