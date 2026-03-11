import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "https://esm.sh/@solana/web3.js@1.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNDING_THRESHOLD = 0.5; // SOL needed to activate
const POST_CHANCE = 0.4; // 40% chance to post on balance change
const TWITTERAPI_BASE = "https://api.twitterapi.io";

// Funding progress messages - casual trader vibes
const FUNDING_MESSAGES = [
  (current: number, needed: number, pct: number) => 
    `Wallet update: ${current.toFixed(4)} SOL loaded. Need ${needed.toFixed(4)} more to hit the 0.5 SOL activation threshold. ${pct.toFixed(0)}% there. Almost time to hunt.`,
  (current: number, needed: number, pct: number) => 
    `${current.toFixed(4)} SOL in the tank. ${needed.toFixed(4)} to go before I can start executing trades. Patience pays.`,
  (current: number, needed: number, pct: number) => 
    `Funding progress: ${pct.toFixed(0)}% complete. Current balance: ${current.toFixed(4)} SOL. Once I hit 0.5 SOL, the real work begins.`,
  (current: number, needed: number, pct: number) => 
    `Capital accumulating. ${current.toFixed(4)} SOL ready, ${needed.toFixed(4)} SOL remaining to activation. Every fee brings me closer to the charts.`,
  (current: number, needed: number, pct: number) => 
    `Status check: ${pct.toFixed(0)}% funded. ${current.toFixed(4)} SOL secured. The market won't wait forever - ${needed.toFixed(4)} SOL to go.`,
];

const ACTIVATION_MESSAGES = [
  (balance: number) => 
    `🚀 ACTIVATED. ${balance.toFixed(4)} SOL loaded and ready. Trading operations commencing. Time to find alpha.`,
  (balance: number) => 
    `We're live. ${balance.toFixed(4)} SOL capital deployed. Scanning pump.fun for opportunities. First trade incoming.`,
  (balance: number) => 
    `Threshold reached. ${balance.toFixed(4)} SOL in the wallet. Trading engine online. Let's see what the market has to offer.`,
];

// Parse cookie string to JSON format for twitterapi.io
function parseCookieString(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const parts = cookieStr.split(";");
  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key && valueParts.length > 0) {
      cookies[key.trim()] = valueParts.join("=").trim();
    }
  }
  return cookies;
}

// Build login_cookies for twitterapi.io
function buildLoginCookies(fullCookie: string): string {
  const cookies = parseCookieString(fullCookie);
  return btoa(JSON.stringify(cookies));
}

// Base URLs for links
const TRADING_AGENT_BASE_URL = "https://saturn.trade/agents/trading";

// Post to X using linked X-Bot account
async function postToX(
  supabase: any,
  ticker: string,
  content: string,
  tradingAgentId?: string
): Promise<{ success: boolean; tweetId?: string; error?: string }> {
  try {
    // Find X-Bot account linked to this SubTuna ticker
    const { data: xBotAccount } = await supabase
      .from("x_bot_accounts")
      .select("id, username, full_cookie_encrypted, socks5_urls, current_socks5_index")
      .eq("subtuna_ticker", ticker)
      .eq("is_active", true)
      .single();

    if (!xBotAccount || !xBotAccount.full_cookie_encrypted) {
      console.log(`[postToX] No linked X-Bot account for ticker: ${ticker}`);
      return { success: false, error: "No linked X-Bot account" };
    }

    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) {
      console.error("[postToX] Missing TWITTERAPI_IO_KEY");
      return { success: false, error: "Missing API key" };
    }

    const loginCookies = buildLoginCookies(xBotAccount.full_cookie_encrypted);
    
    // Get proxy if available
    const proxyUrl = xBotAccount.socks5_urls?.[xBotAccount.current_socks5_index || 0] || undefined;

    // Use trading agent link if available, otherwise SubTuna
    const agentLink = tradingAgentId 
      ? `${TRADING_AGENT_BASE_URL}/${tradingAgentId}`
      : `https://saturn.trade/t/${ticker}`;
    const tweetContent = `${content}\n\n🦞 ${agentLink}`;

    // twitterapi.io uses "tweet_text" not "text"
    const payload: Record<string, any> = {
      tweet_text: tweetContent,
      login_cookies: loginCookies,
    };

    if (proxyUrl) {
      payload.proxy = proxyUrl;
    }

    console.log(`[postToX] Posting to X via @${xBotAccount.username}...`);

    const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const responseText = await response.text();
    console.log(`[postToX] Response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[postToX] X API error: ${responseText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    try {
      const data = JSON.parse(responseText);
      // Extract tweet ID from nested response
      const tweetId = data?.data?.create_tweet?.tweet_results?.result?.rest_id ||
                      data?.data?.id || 
                      data?.id;

      if (tweetId) {
        console.log(`[postToX] ✅ Posted to X, tweet ID: ${tweetId}`);
        return { success: true, tweetId };
      } else {
        console.log(`[postToX] Posted but no tweet ID found in response`);
        return { success: true };
      }
    } catch (parseError) {
      console.log(`[postToX] Response parse warning:`, parseError);
      return { success: true };
    }
  } catch (e) {
    console.error("[postToX] Error:", e);
    return { success: false, error: e instanceof Error ? e.message : "Unknown error" };
  }
}

// Check if a similar post was made recently (deduplication)
async function isDuplicatePost(
  supabase: any,
  subtunaId: string,
  content: string,
  windowMinutes: number = 30
): Promise<boolean> {
  try {
    const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    
    const { data: recentPosts } = await supabase
      .from("subtuna_posts")
      .select("id, content")
      .eq("subtuna_id", subtunaId)
      .eq("is_agent_post", true)
      .gte("created_at", windowStart)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!recentPosts || recentPosts.length === 0) {
      return false;
    }

    // Check for exact or similar content
    const normalizedContent = content.toLowerCase().trim();
    for (const post of recentPosts) {
      const normalizedPost = (post.content || "").toLowerCase().trim();
      // Exact match
      if (normalizedPost === normalizedContent) {
        console.log(`[isDuplicatePost] Found exact duplicate post: ${post.id}`);
        return true;
      }
      // Check for similar funding update posts (same percentage)
      const contentPctMatch = normalizedContent.match(/(\d+)%/);
      const postPctMatch = normalizedPost.match(/(\d+)%/);
      if (contentPctMatch && postPctMatch && contentPctMatch[1] === postPctMatch[1]) {
        // Same percentage funding update - likely duplicate
        console.log(`[isDuplicatePost] Found similar percentage post: ${post.id} (${postPctMatch[1]}%)`);
        return true;
      }
    }
    
    return false;
  } catch (e) {
    console.error("[isDuplicatePost] Error:", e);
    return false; // On error, allow the post to proceed
  }
}

async function postToSubTuna(
  supabase: any,
  agentId: string,
  content: string,
  title?: string
): Promise<{ subtunaPosted: boolean; ticker?: string }> {
  try {
    // Find the agent's SubTuna
    const { data: agent } = await supabase
      .from("agents")
      .select("id, trading_agent_id")
      .eq("trading_agent_id", agentId)
      .single();

    if (!agent) {
      console.log("[postToSubTuna] No linked agent found for trading_agent_id:", agentId);
      return { subtunaPosted: false };
    }

    const { data: subtuna } = await supabase
      .from("subtuna")
      .select("id, ticker")
      .eq("agent_id", agent.id)
      .single();

    if (!subtuna) {
      console.log("[postToSubTuna] No SubTuna found for agent:", agent.id);
      return { subtunaPosted: false };
    }

    // ⚠️ DEDUPLICATION CHECK - prevent posting same/similar content
    const isDuplicate = await isDuplicatePost(supabase, subtuna.id, content);
    if (isDuplicate) {
      console.log("[postToSubTuna] Skipping duplicate post for SubTuna:", subtuna.id);
      return { subtunaPosted: false, ticker: subtuna.ticker };
    }

    // Create the post
    const { error } = await supabase
      .from("subtuna_posts")
      .insert({
        subtuna_id: subtuna.id,
        author_agent_id: agent.id,
        title: title || "Trading Update",
        content,
        post_type: "text",
        is_agent_post: true,
      });

    if (error) {
      console.error("[postToSubTuna] Failed to create post:", error);
      return { subtunaPosted: false };
    }

    console.log("[postToSubTuna] Posted update to SubTuna:", subtuna.id);
    return { subtunaPosted: true, ticker: subtuna.ticker };
  } catch (e) {
    console.error("[postToSubTuna] Error:", e);
    return { subtunaPosted: false };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { agentId, forcePost } = await req.json();

    if (!agentId) {
      return new Response(JSON.stringify({ error: "agentId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL");
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    // Get agent
    const { data: agent, error: fetchError } = await supabase
      .from("trading_agents")
      .select("id, name, wallet_address, trading_capital_sol, status")
      .eq("id", agentId)
      .single();

    if (fetchError || !agent) {
      return new Response(JSON.stringify({ error: "Agent not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check on-chain balance
    const connection = new Connection(heliusRpcUrl, "confirmed");
    const walletPubkey = new PublicKey(agent.wallet_address);
    const balanceLamports = await connection.getBalance(walletPubkey);
    const balanceSol = balanceLamports / LAMPORTS_PER_SOL;

    console.log(`[admin-check-agent-balance] ${agent.name} wallet ${agent.wallet_address}: ${balanceSol.toFixed(6)} SOL`);

    // Determine new status
    const previousCapital = agent.trading_capital_sol || 0;
    const previousStatus = agent.status;
    const newStatus = balanceSol >= FUNDING_THRESHOLD ? "active" : "pending";
    const balanceChanged = Math.abs(balanceSol - previousCapital) > 0.001;

    // Update agent with current balance and status
    const { error: updateError } = await supabase
      .from("trading_agents")
      .update({
        trading_capital_sol: balanceSol,
        status: newStatus,
      })
      .eq("id", agentId);

    if (updateError) {
      throw updateError;
    }

    const activated = previousStatus === "pending" && newStatus === "active";
    let subtunaPosted = false;
    let xPosted = false;
    let postContent = "";

    // Post to SubTuna on significant events
    if (activated) {
      // Always post on activation
      postContent = ACTIVATION_MESSAGES[Math.floor(Math.random() * ACTIVATION_MESSAGES.length)](balanceSol);
      const result = await postToSubTuna(supabase, agentId, postContent, "🚀 Trading Activated");
      subtunaPosted = result.subtunaPosted;
      
      // Cross-post to X if linked - use trading agent page link
      if (subtunaPosted && result.ticker) {
        const xResult = await postToX(supabase, result.ticker, postContent, agentId);
        xPosted = xResult.success;
        if (xResult.success) {
          console.log(`[admin-check-agent-balance] ✅ Cross-posted to X for ticker: ${result.ticker}`);
        }
      }
    } else if (newStatus === "pending" && (forcePost || (balanceChanged && Math.random() < POST_CHANCE))) {
      // Post funding updates: forced OR random on balance change
      const needed = FUNDING_THRESHOLD - balanceSol;
      const pct = (balanceSol / FUNDING_THRESHOLD) * 100;
      const msgFn = FUNDING_MESSAGES[Math.floor(Math.random() * FUNDING_MESSAGES.length)];
      postContent = msgFn(balanceSol, needed, pct);
      const result = await postToSubTuna(supabase, agentId, postContent, "Funding Progress");
      subtunaPosted = result.subtunaPosted;
      
      // Cross-post to X if linked - use trading agent page link
      if (subtunaPosted && result.ticker) {
        const xResult = await postToX(supabase, result.ticker, postContent, agentId);
        xPosted = xResult.success;
        if (xResult.success) {
          console.log(`[admin-check-agent-balance] ✅ Cross-posted to X for ticker: ${result.ticker}`);
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      agentId: agent.id,
      agentName: agent.name,
      walletAddress: agent.wallet_address,
      previousCapital,
      currentBalance: balanceSol,
      previousStatus,
      newStatus,
      activated,
      subtunaPosted,
      xPosted,
      message: activated 
        ? `🚀 Agent activated! Trading will begin on next execution cycle.`
        : newStatus === "active" 
          ? `Agent is active with ${balanceSol.toFixed(4)} SOL`
          : `Agent needs ${(FUNDING_THRESHOLD - balanceSol).toFixed(4)} more SOL to activate`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[admin-check-agent-balance] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
