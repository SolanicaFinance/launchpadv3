import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REQUIRED_SOL = 0.1;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tokenId } = await req.json();
    if (!tokenId) throw new Error("tokenId required");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the token record
    const { data: token, error } = await supabase
      .from("meteorite_tokens")
      .select("id, dev_wallet_address, status")
      .eq("id", tokenId)
      .single();

    if (error || !token) throw new Error("Token not found");

    // If already past pending_payment, return current status
    if (token.status !== "pending_payment") {
      return new Response(
        JSON.stringify({ confirmed: true, status: token.status }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check on-chain balance
    const rpcUrl = Deno.env.get("HELIUS_RPC_URL") || "https://api.mainnet-beta.solana.com";
    const connection = new Connection(rpcUrl, "confirmed");
    const pubkey = new PublicKey(token.dev_wallet_address);
    const balance = await connection.getBalance(pubkey);
    const balanceSol = balance / LAMPORTS_PER_SOL;

    console.log(`[meteorite-confirm] Token ${tokenId} wallet ${token.dev_wallet_address} balance: ${balanceSol} SOL`);

    if (balanceSol >= REQUIRED_SOL) {
      // Payment confirmed - update status
      await supabase
        .from("meteorite_tokens")
        .update({ status: "generating_image", updated_at: new Date().toISOString() })
        .eq("id", tokenId);

      return new Response(
        JSON.stringify({ confirmed: true, status: "generating_image", balance: balanceSol }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ confirmed: false, status: "pending_payment", balance: balanceSol }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-confirm] Error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
