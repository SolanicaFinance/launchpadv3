import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Generate a random API key
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

    const body = await req.json();
    const { name, walletAddress, source, agentUrl } = body;

    // Validate inputs
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 50) {
      return new Response(
        JSON.stringify({ success: false, error: "Name is required (1-50 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!walletAddress || typeof walletAddress !== "string" || walletAddress.length < 32 || walletAddress.length > 44) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid Solana wallet address is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");

    if (!apiEncryptionKey) {
      console.error("API_ENCRYPTION_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if wallet already registered
    const { data: existingAgent } = await supabase
      .from("agents")
      .select("id, name")
      .eq("wallet_address", walletAddress)
      .maybeSingle();

    if (existingAgent) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Wallet already registered as agent "${existingAgent.name}"` 
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate API key and hash it
    const apiKey = generateApiKey();
    const apiKeyPrefix = apiKey.substring(0, 12) + "...";
    const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);

    // Create agent record
    const { data: agent, error: insertError } = await supabase
      .from("agents")
      .insert({
        name: name.trim(),
        wallet_address: walletAddress,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        status: "active",
        registration_source: (typeof source === "string" && source.length <= 50) ? source.trim() : "api",
        external_agent_url: (typeof agentUrl === "string" && agentUrl.length <= 500) ? agentUrl.trim() : null,
      })
      .select("id, name, wallet_address, api_key_prefix, created_at")
      .single();

    if (insertError) {
      console.error("Failed to create agent:", insertError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create agent account" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-register] ✅ Registered new agent: ${name} (${walletAddress})`);

    return new Response(
      JSON.stringify({
        success: true,
        agentId: agent.id,
        name: agent.name,
        walletAddress: agent.wallet_address,
        apiKey: apiKey, // Only returned once - store securely!
        apiKeyPrefix: agent.api_key_prefix,
        dashboardUrl: `https://${BRAND.domain}/agents/dashboard",
        message: "Store your API key securely - it cannot be retrieved later!",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (error) {
    console.error("agent-register error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json` },
        status: 500,
      }
    );
  }
});
