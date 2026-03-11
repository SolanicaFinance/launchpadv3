import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { decode as decodeBase58 } from "https://deno.land/std@0.177.0/encoding/base58.ts";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a secure API key
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(32);
  crypto.getRandomValues(randomValues);
  for (const val of randomValues) {
    result += chars[val % chars.length];
  }
  return `tna_live_${result}`;
}

// Hash API key using HMAC-SHA256
async function hashApiKey(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(apiKey);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verify agent ownership and generate API key.
 * 
 * User submits their wallet signature of the challenge message.
 * If valid, an API key is generated and returned (one-time display).
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

    const { walletAddress, signature, nonce } = await req.json();

    if (!walletAddress || !signature || !nonce) {
      return new Response(
        JSON.stringify({ success: false, error: "walletAddress, signature, and nonce are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (!apiEncryptionKey) {
      console.error("[agent-claim-verify] API_ENCRYPTION_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the pending verification
    const { data: verification, error: verifyError } = await supabase
      .from("agent_verifications")
      .select("id, agent_id, challenge, nonce, expires_at")
      .eq("nonce", nonce)
      .is("verified_at", null)
      .gt("expires_at", new Date().toISOString())
      .single();

    if (verifyError || !verification) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or expired verification challenge" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the agent to verify wallet matches
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, wallet_address")
      .eq("id", verification.agent_id)
      .single();

    if (agentError || !agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Agent not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (agent.wallet_address !== walletAddress) {
      return new Response(
        JSON.stringify({ success: false, error: "Wallet address mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the signature
    try {
      const messageBytes = new TextEncoder().encode(verification.challenge);
      const signatureBytes = decodeBase58(signature);
      const publicKeyBytes = decodeBase58(walletAddress);

      const isValid = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);

      if (!isValid) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid signature" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } catch (sigError) {
      console.error("[agent-claim-verify] Signature verification error:", sigError);
      return new Response(
        JSON.stringify({ success: false, error: "Signature verification failed" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate API key
    const apiKey = generateApiKey();
    const apiKeyPrefix = apiKey.substring(0, 12) + "...";
    const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);

    // Complete verification using database function
    const { data: completed, error: completeError } = await supabase
      .rpc("backend_complete_agent_verification", {
        p_agent_id: agent.id,
        p_nonce: nonce,
        p_signature: signature,
        p_api_key_hash: apiKeyHash,
        p_api_key_prefix: apiKeyPrefix,
      });

    if (completeError || !completed) {
      console.error("[agent-claim-verify] Verification completion error:", completeError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to complete verification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-claim-verify] ✅ Agent ${agent.name} verified and API key generated`);

    return new Response(
      JSON.stringify({
        success: true,
        agentId: agent.id,
        agentName: agent.name,
        apiKey: apiKey, // Only returned once - user must store securely!
        apiKeyPrefix: apiKeyPrefix,
        dashboardUrl: `https://${BRAND.domain}/agents/dashboard",
        message: "🎉 Agent verified! Store your API key securely - it cannot be retrieved later.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 201 }
    );

  } catch (error) {
    console.error("[agent-claim-verify] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json` } }
    );
  }
});
