import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Connection, PublicKey, SystemProgram, Transaction, Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CLAIM_AMOUNT_SOL = 1; // $1 worth — we use 1 SOL as placeholder, adjust with price oracle if needed
const CLAIM_AMOUNT_LAMPORTS = 0.005 * 1e9; // 0.005 SOL per claim (approx $1 at typical SOL prices)

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { meteoriteTokenId, twitterUsername, walletAddress } = await req.json();
    if (!meteoriteTokenId) throw new Error("meteoriteTokenId required");
    if (!twitterUsername) throw new Error("twitterUsername required");
    if (!walletAddress) throw new Error("walletAddress required");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Verify this user is an eligible replier
    const { data: eligible } = await supabase
      .from("meteorite_eligible_replies")
      .select("*")
      .eq("meteorite_token_id", meteoriteTokenId)
      .eq("twitter_username", twitterUsername.toLowerCase())
      .single();

    if (!eligible) throw new Error("You are not an eligible replier for this token");

    // 2. Check if already claimed
    const { data: existingClaim } = await supabase
      .from("meteorite_reply_claims")
      .select("*")
      .eq("meteorite_token_id", meteoriteTokenId)
      .eq("twitter_username", twitterUsername.toLowerCase())
      .single();

    if (existingClaim?.status === "claimed") {
      throw new Error("Already claimed for this token");
    }

    // 3. Get the meteorite token (need dev wallet private key to send funds)
    const { data: token } = await supabase
      .from("meteorite_tokens")
      .select("id, dev_wallet_private_key, dev_wallet_address, total_fees_earned, status")
      .eq("id", meteoriteTokenId)
      .single();

    if (!token) throw new Error("Token not found");
    if (token.status !== "live") throw new Error("Token is not live yet");

    // 4. Check dev wallet balance
    const rpcUrl = Deno.env.get("HELIUS_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const devKeypair = Keypair.fromSecretKey(bs58.decode(token.dev_wallet_private_key));
    const devBalance = await connection.getBalance(devKeypair.publicKey);

    const claimLamports = Math.floor(CLAIM_AMOUNT_LAMPORTS);
    if (devBalance < claimLamports + 5000) {
      throw new Error("Insufficient funds in dev wallet. Fees haven't accumulated enough yet.");
    }

    // 5. Send SOL to claimer
    const recipientPubkey = new PublicKey(walletAddress);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: devKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: claimLamports,
      })
    );

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = devKeypair.publicKey;
    tx.sign(devKeypair);

    const signature = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });

    console.log(`[meteorite-claim] Sent ${CLAIM_AMOUNT_LAMPORTS / 1e9} SOL to ${walletAddress}, sig: ${signature}`);

    // 6. Update claim record
    await supabase
      .from("meteorite_reply_claims")
      .upsert(
        {
          meteorite_token_id: meteoriteTokenId,
          twitter_username: twitterUsername.toLowerCase(),
          status: "claimed",
          claim_amount_sol: CLAIM_AMOUNT_LAMPORTS / 1e9,
          claim_wallet_address: walletAddress,
          claim_tx_signature: signature,
          claimed_at: new Date().toISOString(),
        },
        { onConflict: "meteorite_token_id,twitter_username" }
      );

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        amountSol: CLAIM_AMOUNT_LAMPORTS / 1e9,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-claim] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
