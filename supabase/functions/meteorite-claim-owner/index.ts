import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Connection, PublicKey, SystemProgram, Transaction, Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    // 1. Get the meteorite token
    const { data: token } = await supabase
      .from("meteorite_tokens")
      .select("*")
      .eq("id", meteoriteTokenId)
      .single();

    if (!token) throw new Error("Token not found");
    if (token.status !== "live") throw new Error("Token is not live yet");

    // 2. Verify the claimer is the tweet author
    const tweetAuthor = (token.tweet_author || "").toLowerCase().replace("@", "");
    if (tweetAuthor !== twitterUsername.toLowerCase()) {
      throw new Error("Only the original tweet author can claim the owner share");
    }

    // 3. Check if already claimed
    if (token.owner_claimed_at) {
      throw new Error("Owner share already claimed for this token");
    }

    // 4. Calculate owner share: 25% of total fees earned (which is the dev wallet's 1%)
    // Dev wallet gets 1% of all swaps. 25% of total goes to tweet owner.
    const totalFees = Number(token.total_fees_earned) || 0;
    const ownerShare = totalFees * 0.25; // 25% of dev wallet fees

    if (ownerShare < 0.001) {
      throw new Error("Not enough fees accumulated yet. Owner share is below minimum (0.001 SOL)");
    }

    // 5. Check dev wallet balance
    const rpcUrl = Deno.env.get("HELIUS_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const devKeypair = Keypair.fromSecretKey(bs58.decode(token.dev_wallet_private_key));
    const devBalance = await connection.getBalance(devKeypair.publicKey);
    const ownerLamports = Math.floor(ownerShare * 1e9);

    if (devBalance < ownerLamports + 5000) {
      throw new Error("Insufficient funds in dev wallet for owner payout");
    }

    // 6. Send SOL to tweet owner
    const recipientPubkey = new PublicKey(walletAddress);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: devKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports: ownerLamports,
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

    console.log(`[meteorite-claim-owner] Sent ${ownerShare} SOL to owner ${walletAddress}, sig: ${signature}`);

    // 7. Update token record
    await supabase
      .from("meteorite_tokens")
      .update({
        owner_claimed_at: new Date().toISOString(),
        owner_claimed_sol: ownerShare,
        owner_claim_wallet: walletAddress,
        owner_claim_signature: signature,
      })
      .eq("id", meteoriteTokenId);

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        amountSol: ownerShare,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-claim-owner] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
