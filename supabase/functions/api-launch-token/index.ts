import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

interface LaunchTokenRequest {
  name: string;
  ticker: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  discordUrl?: string;
  tradingFeeBps?: number;
}

// Hash API key using the same method as api-account
async function hashApiKey(apiKey: string, encryptionKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey + encryptionKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get encryption key for hashing
    const encryptionKey = Deno.env.get("API_ENCRYPTION_KEY");
    if (!encryptionKey) {
      console.error("[api-launch-token] API_ENCRYPTION_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Hash the API key and verify
    const apiKeyHash = await hashApiKey(apiKey, encryptionKey);
    
    // Look up account by hash
    const { data: account, error: accountError } = await supabase
      .from("api_accounts")
      .select("id, wallet_address, fee_wallet_address, status")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "active")
      .single();

    if (accountError || !account) {
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiAccountId = account.id;
    const feeWalletAddress = account.fee_wallet_address || account.wallet_address;

    // Parse request body
    const body: LaunchTokenRequest = await req.json();

    // Validate required fields
    if (!body.name || !body.ticker) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, ticker" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate ticker format (alphanumeric + dots allowed)
    if (!/^[A-Z0-9.]{1,10}$/i.test(body.ticker)) {
      return new Response(
        JSON.stringify({ error: "Ticker must be 1-10 alphanumeric characters (dots allowed)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate trading fee (10-1000 bps = 0.1% to 10%)
    const tradingFeeBps = Math.max(10, Math.min(1000, body.tradingFeeBps || 200));

    // === FIX: Only auto-populate SubTuna URL for agent launches ===
    // API-launched tokens don't have agent communities, so don't use /t/:ticker
    const finalWebsiteUrl = body.websiteUrl || undefined;
    const finalTwitterUrl = body.twitterUrl || 'https://x.com/saturntrade';

    // Call Vercel API to create the token
    let vercelApiUrl = Deno.env.get("VERCEL_API_URL") || "https://saturntrade.vercel.app";
    if (!vercelApiUrl.startsWith("http")) {
      vercelApiUrl = `https://${vercelApiUrl}`;
    }
    
    console.log(`[api-launch-token] Creating token ${body.name} ($${body.ticker}) for API account ${apiAccountId}`);
    
    const createResponse = await fetch(`${vercelApiUrl}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: body.name.slice(0, 32),
        ticker: body.ticker.toUpperCase().slice(0, 10),
        description: body.description || `${body.name} - Created via API`,
        imageUrl: body.imageUrl,
        websiteUrl: finalWebsiteUrl,
        twitterUrl: finalTwitterUrl,
        telegramUrl: body.telegramUrl,
        discordUrl: body.discordUrl,
        feeRecipientWallet: feeWalletAddress,
        tradingFeeBps,
        serverSideSign: true,
        useVanityAddress: false,
        // Pass API account ID for attribution
        apiAccountId,
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[api-launch-token] Vercel API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to create token", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createResult = await createResponse.json();

    if (!createResult.success) {
      return new Response(
        JSON.stringify({ error: createResult.error || "Token creation failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Attribute token to API account (for fee distribution)
    // This sets api_account_id on both tokens and fun_tokens tables
    const { error: attrError } = await supabase.rpc("backend_attribute_token_to_api", {
      p_token_id: createResult.tokenId,
      p_api_account_id: apiAccountId,
    });

    if (attrError) {
      console.error("[api-launch-token] Failed to attribute token:", attrError);
      // Don't fail the request, token was still created
    } else {
      console.log(`[api-launch-token] Token ${createResult.tokenId} attributed to API account ${apiAccountId}`);
    }

    // Get launchpad for this API account (if exists)
    const { data: launchpad } = await supabase
      .from("api_launchpads")
      .select("id")
      .eq("api_account_id", apiAccountId)
      .single();

    // Link token to launchpad if exists
    if (launchpad) {
      await supabase.from("api_launchpad_tokens").insert({
        launchpad_id: launchpad.id,
        token_id: createResult.tokenId,
      });
    }

    // Log API usage
    await supabase.from("api_usage_logs").insert({
      api_account_id: apiAccountId,
      endpoint: "/api-launch-token",
      method: "POST",
      status_code: 200,
    });

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        tokenId: createResult.tokenId,
        mintAddress: createResult.mintAddress,
        poolAddress: createResult.dbcPoolAddress || createResult.poolAddress,
        solscanUrl: `https://solscan.io/token/${createResult.mintAddress}`,
        tradeUrl: `https://axiom.trade/meme/${createResult.dbcPoolAddress || createResult.mintAddress}`,
        launchpadUrl: launchpad ? `https://saturn.trade/fun/${createResult.mintAddress}` : null,
        // Fee info
        feeInfo: {
          tradingFeeBps,
          apiUserShare: "50%", // 1% of 2% total
          platformShare: "50%", // 1% of 2% total
          claimThreshold: "0.01 SOL",
        },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[api-launch-token] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});