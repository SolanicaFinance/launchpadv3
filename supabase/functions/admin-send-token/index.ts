import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  LAMPORTS_PER_SOL,
} from "npm:@solana/web3.js@1.98.0";
import {
  getAssociatedTokenAddress,
  createTransferInstruction,
  createAssociatedTokenAccountInstruction,
  getAccount,
  getMint,
} from "npm:@solana/spl-token@0.4.14";
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
    throw new Error("Invalid private key format");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { adminPassword, privateKey, mintAddress, toAddress, amount } = await req.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!privateKey || !mintAddress || !toAddress || !amount || Number(amount) <= 0) {
      return new Response(
        JSON.stringify({ error: "privateKey, mintAddress, toAddress, and amount (>0) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!heliusRpcUrl) {
      return new Response(
        JSON.stringify({ error: "HELIUS_RPC_URL not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const keypair = parseKeypair(privateKey);
    const fromAddress = keypair.publicKey.toBase58();
    const connection = new Connection(heliusRpcUrl, "confirmed");

    let mintPubkey: InstanceType<typeof PublicKey>;
    let toPubkey: InstanceType<typeof PublicKey>;
    try {
      mintPubkey = new PublicKey(mintAddress);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid mint address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    try {
      toPubkey = new PublicKey(toAddress);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid destination address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get mint info for decimals
    const mintInfo = await getMint(connection, mintPubkey);
    const decimals = mintInfo.decimals;
    const rawAmount = BigInt(Math.round(Number(amount) * Math.pow(10, decimals)));

    console.log(`[admin-send-token] Mint: ${mintAddress}, Decimals: ${decimals}, Amount: ${amount}, Raw: ${rawAmount}`);

    // Get source ATA
    const sourceAta = await getAssociatedTokenAddress(mintPubkey, keypair.publicKey);
    
    // Check source balance
    let sourceAccount;
    try {
      sourceAccount = await getAccount(connection, sourceAta);
    } catch {
      return new Response(
        JSON.stringify({ error: "Source wallet has no token account for this mint", fromAddress }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sourceBalance = sourceAccount.amount;
    console.log(`[admin-send-token] Source balance: ${sourceBalance}, need: ${rawAmount}`);

    if (sourceBalance < rawAmount) {
      return new Response(
        JSON.stringify({
          error: `Insufficient token balance. Have ${Number(sourceBalance) / Math.pow(10, decimals)}, need ${amount}`,
          fromAddress,
          balance: Number(sourceBalance) / Math.pow(10, decimals),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get or create destination ATA
    const destAta = await getAssociatedTokenAddress(mintPubkey, toPubkey);
    
    const tx = new Transaction();

    // Check if dest ATA exists, create if not
    try {
      await getAccount(connection, destAta);
    } catch {
      console.log(`[admin-send-token] Creating destination ATA...`);
      tx.add(
        createAssociatedTokenAccountInstruction(
          keypair.publicKey, // payer
          destAta,
          toPubkey,
          mintPubkey
        )
      );
    }

    // Add transfer instruction
    tx.add(
      createTransferInstruction(
        sourceAta,
        destAta,
        keypair.publicKey,
        rawAmount
      )
    );

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = keypair.publicKey;
    tx.sign(keypair);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`[admin-send-token] ✅ TX sent: ${signature}`);

    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );

    if (confirmation.value?.err) {
      const errMsg = `TX failed on-chain: ${JSON.stringify(confirmation.value.err)}`;
      console.error(`[admin-send-token] ❌ ${errMsg}`);
      return new Response(
        JSON.stringify({ error: errMsg, signature, fromAddress }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[admin-send-token] ✅ TX confirmed: ${signature}`);

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        fromAddress,
        toAddress,
        mintAddress,
        amount: Number(amount),
        decimals,
        solscanUrl: `https://solscan.io/tx/${signature}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-send-token] Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
