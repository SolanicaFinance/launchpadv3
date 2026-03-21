import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const { tweetUrl, creatorWallet } = await req.json();

    if (!tweetUrl || (!tweetUrl.includes("x.com") && !tweetUrl.includes("twitter.com"))) {
      throw new Error("Invalid tweet URL");
    }

    // Parse tweet ID from URL
    const tweetIdMatch = tweetUrl.match(/status\/(\d+)/);
    const tweetId = tweetIdMatch ? tweetIdMatch[1] : null;

    // Generate a fresh dev wallet for this token
    const devKeypair = Keypair.generate();
    const devWalletAddress = devKeypair.publicKey.toBase58();
    const devWalletPrivateKey = bs58.encode(devKeypair.secretKey);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if this tweet is already being tokenized
    const { data: existing } = await supabase
      .from("meteorite_tokens")
      .select("id, status, dev_wallet_address")
      .eq("tweet_url", tweetUrl)
      .not("status", "eq", "failed")
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({
          alreadyExists: true,
          id: existing.id,
          status: existing.status,
          devWalletAddress: existing.dev_wallet_address,
          paymentAmount: 0.1,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Save to database
    const { data: token, error } = await supabase
      .from("meteorite_tokens")
      .insert({
        tweet_url: tweetUrl,
        tweet_id: tweetId,
        dev_wallet_address: devWalletAddress,
        dev_wallet_private_key: devWalletPrivateKey,
        creator_wallet: creatorWallet || null,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (error) throw error;

    console.log(`[meteorite-init] Created token ${token.id} for tweet ${tweetId}, dev wallet: ${devWalletAddress}`);

    return new Response(
      JSON.stringify({
        id: token.id,
        devWalletAddress,
        paymentAmount: 0.1,
        tweetId,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-init] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
