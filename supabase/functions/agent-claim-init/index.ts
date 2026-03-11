import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Initialize agent ownership claim for Twitter-launched agents.
 * 
 * Users who launch tokens via Twitter (!saturntrade) don't get an API key immediately.
 * This endpoint generates a verification challenge that they sign with their wallet
 * to prove ownership and get their API key.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { walletAddress } = await req.json();

    if (!walletAddress || typeof walletAddress !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "walletAddress is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find agent by wallet address
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, wallet_address, verified_at, api_key_hash")
      .eq("wallet_address", walletAddress)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (agentError) {
      console.error("[agent-claim-init] Agent lookup error:", agentError);
      return new Response(
        JSON.stringify({ success: false, error: "Database error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!agent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No agent found for this wallet. Launch a token first via Twitter ${BRAND.twitterHandle}." 
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already verified
    if (agent.verified_at && agent.api_key_hash) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "This agent is already verified. Use your existing API key.",
          alreadyVerified: true,
          agentName: agent.name
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate verification challenge using database function
    const { data: challenge, error: challengeError } = await supabase
      .rpc("backend_create_agent_verification", { p_agent_id: agent.id });

    if (challengeError || !challenge || challenge.length === 0) {
      console.error("[agent-claim-init] Challenge generation error:", challengeError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to generate verification challenge" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { challenge: message, nonce, expires_at } = challenge[0];

    console.log(`[agent-claim-init] Generated challenge for agent ${agent.name} (${agent.id})`);

    return new Response(
      JSON.stringify({
        success: true,
        agentId: agent.id,
        agentName: agent.name,
        walletAddress: agent.wallet_address,
        challenge: message,
        nonce,
        expiresAt: expires_at,
        message: "Sign this message with your wallet to verify ownership."
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[agent-claim-init] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
