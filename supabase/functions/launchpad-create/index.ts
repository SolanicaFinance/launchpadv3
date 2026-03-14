import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Platform fee wallet - receives 50% of trading fees
const PLATFORM_FEE_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Blocked patterns for spam/exploit names
const BLOCKED_PATTERNS = [
  /exploit/i,
  /hack/i,
  /0xh1ve/i,
  /fix\s*(ur|your)\s*site/i,
  /dm\s*@/i,
  /found\s*(an?|the)?\s*exploit/i,
  /vulnerability/i,
  /security\s*issue/i,
  /into\s*(ur|your)\s*db/i,
];

function isBlockedName(name: string): boolean {
  if (!name) return false;
  return BLOCKED_PATTERNS.some(pattern => pattern.test(name));
}

// UUID v5 implementation for Privy ID to UUID mapping
const UUID_V5_NAMESPACE_DNS = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, "");
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, "0"));
  }
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
}

async function sha1(data: Uint8Array): Promise<Uint8Array> {
  const buffer = new Uint8Array(data).buffer as ArrayBuffer;
  const hashBuffer = await crypto.subtle.digest("SHA-1", buffer);
  return new Uint8Array(hashBuffer);
}

async function uuidV5(name: string, namespaceUuid: string): Promise<string> {
  const namespaceBytes = uuidToBytes(namespaceUuid);
  const nameBytes = new TextEncoder().encode(name);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);
  const hash = await sha1(combined);
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  return bytesToUuid(hash.slice(0, 16));
}

async function privyUserIdToUuid(privyUserId: string): Promise<string> {
  return uuidV5(privyUserId, UUID_V5_NAMESPACE_DNS);
}

// Generate a pseudo-random base58 address for development
function generateMockMintAddress(): string {
  const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Get client IP from headers
  const clientIP = 
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-real-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";

  try {
    // Create Supabase client with service role FIRST for rate limiting
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ===== SERVER-SIDE RATE LIMIT ENFORCEMENT =====
    const MAX_LAUNCHES_PER_HOUR = 2;
    const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
    const oneHourAgo = new Date(Date.now() - RATE_LIMIT_WINDOW_MS).toISOString();

    const { data: recentLaunches, error: rlError } = await supabase
      .from("launch_rate_limits")
      .select("launched_at")
      .eq("ip_address", clientIP)
      .gte("launched_at", oneHourAgo);

    if (!rlError && recentLaunches && recentLaunches.length >= MAX_LAUNCHES_PER_HOUR) {
      const oldestLaunch = new Date(recentLaunches[0].launched_at);
      const expiresAt = new Date(oldestLaunch.getTime() + RATE_LIMIT_WINDOW_MS);
      const waitSeconds = Math.ceil((expiresAt.getTime() - Date.now()) / 1000);
      
      console.log(`launchpad-create ❌ Rate limit exceeded for IP: ${clientIP} (${recentLaunches.length} launches)`);
      return new Response(
        JSON.stringify({ 
          error: `You've already launched ${recentLaunches.length} coins in the last 60 minutes. Please wait ${Math.ceil(waitSeconds / 60)} minutes.`,
          rateLimited: true,
          waitSeconds: Math.max(0, waitSeconds)
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    // ===== END RATE LIMIT ENFORCEMENT =====

    const {
      creatorWallet,
      privyUserId,
      name,
      ticker,
      description,
      imageUrl,
      websiteUrl,
      twitterUrl,
      telegramUrl,
      discordUrl,
      initialBuySol,
    } = await req.json();

    console.log("launchpad-create received:", { creatorWallet, name, ticker, clientIP });

    if (!creatorWallet || !name || !ticker) {
      return new Response(
        JSON.stringify({ error: "creatorWallet, name, and ticker are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Block spam/exploit names and tickers
    if (isBlockedName(name) || isBlockedName(ticker) || isBlockedName(description || "")) {
      console.log("launchpad-create ❌ Blocked spam token attempt:", { name, ticker });
      return new Response(
        JSON.stringify({ error: "Token name or ticker contains blocked content" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get creator profile ID if privyUserId provided
    let creatorId: string | null = null;
    if (privyUserId) {
      creatorId = await privyUserIdToUuid(privyUserId);
    }

    // Generate mock mint address for development
    // In production, this would come from the Meteora SDK via a Vercel API
    // The Meteora SDK is a Node.js package and can't run in Deno edge functions
    // You would need to deploy a separate Vercel project with endpoints like:
    // - POST /api/pool/create - Creates token + DBC pool
    // - POST /api/swap/execute - Executes buy/sell swaps
    // - POST /api/fees/claim - Claims trading fees from pools
    const mintAddress = generateMockMintAddress();
    const dbcPoolAddress: string | null = null; // Would be set by Meteora API

    console.log("Generated mock mint address:", mintAddress);
    console.log("NOTE: For production, deploy Meteora SDK to Vercel and set METEORA_API_URL");

    // Calculate initial price (virtual reserves / virtual tokens)
    const virtualSol = 30;
    const virtualToken = 1_000_000_000;
    const initialPrice = virtualSol / virtualToken;

    // Create token record
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .insert({
        mint_address: mintAddress,
        name,
        ticker: ticker.toUpperCase(),
        description: description || null,
        image_url: imageUrl || null,
        website_url: websiteUrl || null,
        twitter_url: twitterUrl || null,
        telegram_url: telegramUrl || null,
        discord_url: discordUrl || null,
        creator_wallet: creatorWallet,
        creator_id: creatorId,
        dbc_pool_address: dbcPoolAddress,
        virtual_sol_reserves: virtualSol,
        virtual_token_reserves: virtualToken,
        real_sol_reserves: initialBuySol || 0,
        price_sol: initialPrice,
        market_cap_sol: virtualSol,
        status: "bonding",
        migration_status: "pending", // Would be "dbc_active" with real Meteora integration
        holder_count: initialBuySol > 0 ? 1 : 0,
      })
      .select()
      .single();

    if (tokenError) {
      console.error("Token insert error:", tokenError);
      throw tokenError;
    }

    console.log("Token created:", token.id);

    // Create fee earners (creator gets 50%, system/platform gets 50%)
    const { error: earnerError } = await supabase.from("fee_earners").insert([
      {
        token_id: token.id,
        wallet_address: creatorWallet,
        profile_id: creatorId,
        earner_type: "creator",
        share_bps: 5000, // 50%
      },
      {
        token_id: token.id,
        wallet_address: PLATFORM_FEE_WALLET,
        earner_type: "system",
        share_bps: 5000, // 50%
      },
    ]);

    if (earnerError) {
      console.error("Fee earner insert error:", earnerError);
    }

    // If initial buy, record the holding
    if (initialBuySol > 0) {
      const tokensReceived = calculateBuyOutput(initialBuySol, virtualSol, virtualToken);
      
      await supabase.from("token_holdings").insert({
        token_id: token.id,
        wallet_address: creatorWallet,
        profile_id: creatorId,
        balance: tokensReceived,
      });

      // Update token reserves
      await supabase.from("tokens").update({
        real_sol_reserves: initialBuySol,
        bonding_curve_progress: (initialBuySol / 85) * 100,
        holder_count: 1,
      }).eq("id", token.id);
    }

    // Record this launch for rate limiting (ignore errors)
    try {
      await supabase.from("launch_rate_limits").insert({
        ip_address: clientIP,
        token_id: token.id,
      });
      console.log("launchpad-create 📊 Rate limit recorded for IP:", clientIP);
    } catch (rlErr) {
      console.warn("launchpad-create ⚠️ Failed to record rate limit:", rlErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenId: token.id,
        mintAddress: token.mint_address,
        dbcPoolAddress: token.dbc_pool_address,
        message: "Token created in development mode. For real Solana tokens, deploy Meteora SDK to Vercel.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("launchpad-create error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Helper function to calculate buy output using constant product formula
function calculateBuyOutput(solIn: number, virtualSol: number, virtualToken: number): number {
  const k = virtualSol * virtualToken;
  const newVirtualSol = virtualSol + solIn;
  const newVirtualToken = k / newVirtualSol;
  return virtualToken - newVirtualToken;
}
