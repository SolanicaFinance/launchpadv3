import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  LAMPORTS_PER_SOL,
} from "npm:@solana/web3.js@1.98.0";
import bs58 from "npm:bs58@6.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ADMIN_PASSWORD = "saturn135@";

function parseKeypair(privateKey: string): InstanceType<typeof Keypair> {
  try {
    if (privateKey.startsWith("[")) {
      const keyArray = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(keyArray));
    }
    return Keypair.fromSecretKey(bs58.decode(privateKey));
  } catch {
    throw new Error("Invalid PUMP_DEPLOYER_PRIVATE_KEY format");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { adminPassword, toAddress, amountSol } = await req.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!toAddress || !amountSol || Number(amountSol) <= 0) {
      return new Response(
        JSON.stringify({ error: "toAddress and amountSol (>0) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL")!;
    const deployerPrivateKey = Deno.env.get("PUMP_DEPLOYER_PRIVATE_KEY");

    if (!deployerPrivateKey) {
      return new Response(
        JSON.stringify({ error: "PUMP_DEPLOYER_PRIVATE_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keypair = parseKeypair(deployerPrivateKey);
    const fromAddress = keypair.publicKey.toBase58();
    const connection = new Connection(heliusRpcUrl, "confirmed");

    // Check balance
    const balanceLamports = await connection.getBalance(keypair.publicKey, "confirmed");
    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;
    const sendLamports = Math.round(Number(amountSol) * LAMPORTS_PER_SOL);

    console.log(`[admin-send-sol] From: ${fromAddress}, To: ${toAddress}, Amount: ${amountSol} SOL, Balance: ${balanceSol} SOL`);

    if (balanceLamports < sendLamports + 5000) {
      return new Response(
        JSON.stringify({
          error: `Insufficient balance. Have ${balanceSol.toFixed(6)} SOL, need ${Number(amountSol).toFixed(6)} SOL + fees`,
          balanceSol,
          fromAddress,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build simple SOL transfer
    let toPubkey: InstanceType<typeof PublicKey>;
    try {
      toPubkey = new PublicKey(toAddress);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid destination address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey,
        lamports: sendLamports,
      })
    );
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`[admin-send-sol] ✅ TX sent: ${signature}`);

    // Confirm
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    if (confirmation.value?.err) {
      const errMsg = `TX failed on-chain: ${JSON.stringify(confirmation.value.err)}`;
      console.error(`[admin-send-sol] ❌ ${errMsg}`);
      return new Response(
        JSON.stringify({ error: errMsg, signature, fromAddress }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-send-sol] ✅ TX confirmed: ${signature}`);

    const newBalance = await connection.getBalance(keypair.publicKey, "confirmed");

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        fromAddress,
        toAddress,
        amountSol: Number(amountSol),
        newBalanceSol: newBalance / LAMPORTS_PER_SOL,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-send-sol] Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
