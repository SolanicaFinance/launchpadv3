import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

// Parse cookie string to JSON format for twitterapi.io
function parseCookieString(cookieStr: string): Record<string, string> {
  const cookies: Record<string, string> = {};
  const parts = cookieStr.split(";");
  for (const part of parts) {
    const [key, ...valueParts] = part.trim().split("=");
    if (key && valueParts.length > 0) {
      cookies[key.trim()] = stripQuotes(valueParts.join("=").trim());
    }
  }
  return cookies;
}

// Build login_cookies base64 for twitterapi.io
function buildLoginCookies(fullCookie: string): string {
  const cookies = parseCookieString(fullCookie);
  return btoa(JSON.stringify(cookies));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {

    const { postId, forcePost } = await req.json();

    if (!postId) {
      return new Response(JSON.stringify({ error: "postId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) {
      console.error("[subtuna-crosspost-x] Missing TWITTERAPI_IO_KEY");
      return new Response(JSON.stringify({ error: "Missing API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the SubTuna post with related data
    const { data: post, error: postError } = await supabase
      .from("subtuna_posts")
      .select(`
        id,
        title,
        content,
        image_url,
        is_agent_post,
        x_post_id,
        subtuna_id,
        subtuna (
          id,
          ticker,
          name,
          agent_id
        )
      `)
      .eq("id", postId)
      .single();

    if (postError || !post) {
      console.error("[subtuna-crosspost-x] Post not found:", postError);
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Skip if already posted to X
    if (post.x_post_id && !forcePost) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "Already posted to X",
        x_post_id: post.x_post_id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const subtuna = post.subtuna as any;
    if (!subtuna?.ticker) {
      console.error("[subtuna-crosspost-x] SubTuna not found for post");
      return new Response(JSON.stringify({ error: "SubTuna not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find X-Bot account linked to this SubTuna ticker
    const { data: xBotAccount } = await supabase
      .from("x_bot_accounts")
      .select("id, username, full_cookie_encrypted, auth_token_encrypted, ct0_token_encrypted, socks5_urls, current_socks5_index")
      .eq("subtuna_ticker", subtuna.ticker)
      .eq("is_active", true)
      .single();

    if (!xBotAccount) {
      console.log(`[subtuna-crosspost-x] No linked X-Bot account for ticker: ${subtuna.ticker}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "No linked X-Bot account",
        ticker: subtuna.ticker 
      }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract auth_token and ct0 from full_cookie or from individual fields
    let authToken: string | null = null;
    let ct0Token: string | null = null;
    
    if (xBotAccount.full_cookie_encrypted) {
      const cookies = parseCookieString(xBotAccount.full_cookie_encrypted);
      authToken = cookies.auth_token || null;
      ct0Token = cookies.ct0 || null;
    }
    
    // Fallback to individual encrypted fields if available
    if (!authToken && xBotAccount.auth_token_encrypted) {
      authToken = stripQuotes(xBotAccount.auth_token_encrypted);
    }
    if (!ct0Token && xBotAccount.ct0_token_encrypted) {
      ct0Token = stripQuotes(xBotAccount.ct0_token_encrypted);
    }
    
    if (!authToken || !ct0Token) {
      console.log(`[subtuna-crosspost-x] Missing auth_token or ct0 for @${xBotAccount.username}`);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing authentication credentials",
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Get proxy if available
    const proxyUrl = xBotAccount.socks5_urls?.[xBotAccount.current_socks5_index || 0] || undefined;

    // Build tweet text - include post content and link to SubTuna
    const postLink = `https://saturn.trade/t/${subtuna.ticker}`;
    
    // Trim content if too long (leave room for link and hashtags)
    let tweetContent = post.content || post.title || "";
    const maxContentLength = 230; // Leave room for link
    if (tweetContent.length > maxContentLength) {
      tweetContent = tweetContent.substring(0, maxContentLength - 3) + "...";
    }
    
    const tweetText = `${tweetContent}\n\n🐟 ${postLink}`;

    console.log(`[subtuna-crosspost-x] Posting to X via @${xBotAccount.username}...`);
    console.log(`[subtuna-crosspost-x] Tweet text: ${tweetText.substring(0, 100)}...`);

    // Post to X using create_tweet with auth_session format (correct endpoint per docs)
    const postBody = {
      tweet_text: tweetText,
      auth_session: {
        auth_token: authToken,
        ct0: ct0Token,
      },
      ...(proxyUrl && { proxy: proxyUrl }),
    };

    console.log(`[subtuna-crosspost-x] Using /twitter/create_tweet endpoint...`);

    let response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet`, {
      method: "POST",
      headers: {
        "X-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(postBody),
    });

    let responseText = await response.text();
    console.log(`[subtuna-crosspost-x] create_tweet status: ${response.status}`);
    console.log(`[subtuna-crosspost-x] create_tweet response: ${responseText.substring(0, 300)}`);

    // If create_tweet fails, try create_tweet_v2 with login_cookies as fallback
    let parsedResponse: any = null;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {}
    
    if (!response.ok || parsedResponse?.status === "error") {
      console.log(`[subtuna-crosspost-x] create_tweet failed (${parsedResponse?.message || response.status}), trying create_tweet_v2...`);
      
      // Build login_cookies base64
      const loginCookies = buildLoginCookies(xBotAccount.full_cookie_encrypted || `auth_token=${authToken};ct0=${ct0Token}`);
      
      response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "X-API-Key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tweet_text: tweetText,
          login_cookies: loginCookies,
          ...(proxyUrl && { proxy: proxyUrl }),
        }),
      });
      
      responseText = await response.text();
      console.log(`[subtuna-crosspost-x] create_tweet_v2 status: ${response.status}`);
      console.log(`[subtuna-crosspost-x] create_tweet_v2 response: ${responseText.substring(0, 300)}`);
    }

    console.log(`[subtuna-crosspost-x] Final response status: ${response.status}`);

    if (!response.ok) {
      console.error(`[subtuna-crosspost-x] X API error: ${responseText}`);
      
      // Log to x_bot_account_logs
      await supabase.from("x_bot_account_logs").insert({
        account_id: xBotAccount.id,
        log_type: "crosspost",
        level: "error",
        message: `Failed to crosspost SubTuna post: HTTP ${response.status}`,
        details: {
          postId,
          subtunaId: subtuna.id,
          ticker: subtuna.ticker,
          responseStatus: response.status,
          responseBody: responseText.substring(0, 500),
        },
      });
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `HTTP ${response.status}`,
        details: responseText.substring(0, 200)
      }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract tweet ID from response - handle various API response formats
    let tweetId: string | null = null;
    let parseError: any = null;
    let data: any = null;
    
    try {
      data = JSON.parse(responseText);
      console.log(`[subtuna-crosspost-x] Parsed response keys: ${Object.keys(data || {}).join(', ')}`);
      
      // Check for error status first
      if (data?.status === "error") {
        console.error(`[subtuna-crosspost-x] API error: ${data?.message || 'Unknown error'}`);
        
        await supabase.from("x_bot_account_logs").insert({
          account_id: xBotAccount.id,
          log_type: "crosspost",
          level: "error",
          message: `Twitter API returned error: ${data?.message}`,
          details: {
            postId,
            subtunaId: subtuna.id,
            ticker: subtuna.ticker,
            error: data?.message,
            responseBody: responseText.substring(0, 500),
          },
        });
        
        return new Response(JSON.stringify({
          success: false,
          error: data?.message || "Twitter API error",
          details: responseText.substring(0, 200)
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      // Try multiple paths to find tweet ID
      tweetId = data?.data?.create_tweet?.tweet_results?.result?.rest_id ||
                data?.data?.rest_id ||
                data?.data?.id || 
                data?.rest_id ||
                data?.id ||
                data?.tweet_id;
                
      if (data?.data?.create_tweet?.tweet_results?.result) {
        console.log(`[subtuna-crosspost-x] Found tweet_results.result: ${JSON.stringify(data.data.create_tweet.tweet_results.result).substring(0, 200)}`);
      }
    } catch (e) {
      parseError = e;
      console.log(`[subtuna-crosspost-x] Response parse warning:`, parseError);
    }

    if (tweetId) {
      // Update the SubTuna post with the X post ID
      await supabase
        .from("subtuna_posts")
        .update({ x_post_id: tweetId })
        .eq("id", postId);
      
      console.log(`[subtuna-crosspost-x] ✅ Posted to X, tweet ID: ${tweetId}`);
      
      // Log success
      await supabase.from("x_bot_account_logs").insert({
        account_id: xBotAccount.id,
        log_type: "crosspost",
        level: "info",
        message: `Successfully crossposted SubTuna post to X`,
        details: {
          postId,
          subtunaId: subtuna.id,
          ticker: subtuna.ticker,
          tweetId,
          tweetUrl: `https://x.com/${xBotAccount.username}/status/${tweetId}`,
        },
      });
      
      return new Response(JSON.stringify({
        success: true,
        tweetId,
        tweetUrl: `https://x.com/${xBotAccount.username}/status/${tweetId}`,
        username: xBotAccount.username,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } else {
      // Posted but no tweet ID found
      console.log(`[subtuna-crosspost-x] Posted but no tweet ID found in response`);
      
      await supabase.from("x_bot_account_logs").insert({
        account_id: xBotAccount.id,
        log_type: "crosspost",
        level: "warn",
        message: `Crosspost may have succeeded but no tweet ID returned`,
        details: {
          postId,
          subtunaId: subtuna.id,
          ticker: subtuna.ticker,
          responseBody: responseText.substring(0, 500),
        },
      });
      
      return new Response(JSON.stringify({
        success: true,
        message: "Posted but no tweet ID returned",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (error) {
    console.error("[subtuna-crosspost-x] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : "Unknown error",
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
