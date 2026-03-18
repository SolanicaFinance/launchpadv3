// Test Twitter Community Join & Post
// Community: TUNALISHOUS (ID: 2018885865972367523)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const COMMUNITY_ID = "2033946750424437104"; // MoonDexo community

function parseCookieString(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of raw.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = val.replace(/^["']|["']$/g, "");
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) throw new Error("TWITTERAPI_IO_KEY not configured");

    // Get MoonDexo cookies from x_bot_accounts table
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    
    const { data: xBot, error: xBotErr } = await supabase
      .from("x_bot_accounts")
      .select("full_cookie_encrypted, socks5_urls, current_socks5_index")
      .eq("username", "MoonDexo")
      .single();
    
    if (xBotErr || !xBot?.full_cookie_encrypted) {
      throw new Error("MoonDexo x_bot_account not found or missing cookies");
    }

    const fullCookie = xBot.full_cookie_encrypted;
    const proxyUrl = xBot.socks5_urls?.[xBot.current_socks5_index || 0] || Deno.env.get("TWITTER_PROXY");
    
    const loginCookiesObj = parseCookieString(fullCookie);
    const loginCookies = btoa(JSON.stringify(loginCookiesObj));

    const { action = "info" } = await req.json().catch(() => ({}));
    const results: Record<string, unknown> = { action, communityId: COMMUNITY_ID };

    // ===== ACTION: Get Community Info =====
    if (action === "info") {
      console.log(`[test-community] Getting info for community ${COMMUNITY_ID}...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/community/info?community_id=${COMMUNITY_ID}`, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      const responseText = await response.text();
      console.log(`[test-community] Info response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: V2 Login (get fresh login cookie) =====
    if (action === "login") {
      const username = Deno.env.get("X_ACCOUNT_USERNAME");
      const email = Deno.env.get("X_ACCOUNT_EMAIL");
      const password = Deno.env.get("X_ACCOUNT_PASSWORD");
      const totpSecret = Deno.env.get("X_TOTP_SECRET");
      
      console.log(`[test-community] Performing V2 login for ${username}...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          user_name: username,
          email: email,
          password: password,
          proxy: proxyUrl,
          totp_secret: totpSecret,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-community] Login response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: Join Community (dynamic login first, then join) =====
    if (action === "join") {
      // Step 1: Login via API to get fresh cookies
      const { data: xBotFull } = await supabase
        .from("x_bot_accounts")
        .select("username, email, password_encrypted, totp_secret_encrypted, socks5_urls, current_socks5_index")
        .eq("username", "MoonDexo")
        .single();
      
      if (!xBotFull) throw new Error("MoonDexo account not found");
      
      console.log(`[test-community] Step 1: Logging in as ${xBotFull.username}...`);
      
      const loginResponse = await fetch(`${TWITTERAPI_BASE}/twitter/user_login_v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          user_name: xBotFull.username,
          email: xBotFull.email,
          password: xBotFull.password_encrypted,
          proxy: proxyUrl,
          ...(xBotFull.totp_secret_encrypted ? { totp_secret: xBotFull.totp_secret_encrypted } : {}),
        }),
      });
      
      const loginData = await loginResponse.json();
      console.log(`[test-community] Login response: ${loginResponse.status} - ${JSON.stringify(loginData).slice(0, 500)}`);
      
      const dynamicCookies = loginData.login_cookies || loginData.cookies || loginData.cookie || loginData?.data?.login_cookies;
      
      if (!dynamicCookies) {
        results.status = loginResponse.status;
        results.response = { error: "Login failed - no cookies returned", loginData };
        return new Response(JSON.stringify(results, null, 2), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      console.log(`[test-community] Step 2: Joining community ${COMMUNITY_ID} with fresh cookies...`);
      
      // Step 2: Join with the fresh API-issued cookies
      const joinResponse = await fetch(`${TWITTERAPI_BASE}/twitter/join_community_v2`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({
          login_cookies: dynamicCookies,
          community_id: COMMUNITY_ID,
          proxy: proxyUrl,
        }),
      });
      
      const joinText = await joinResponse.text();
      console.log(`[test-community] Join response: ${joinResponse.status} - ${joinText.slice(0, 500)}`);
      
      results.status = joinResponse.status;
      results.response = JSON.parse(joinText);
      results.loginSuccess = true;
    }

    // ===== ACTION: Join Community (raw cookie format test) =====
    if (action === "join_raw") {
      console.log(`[test-community] Joining with raw cookie format...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/join_community_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: fullCookie,  // Try raw cookie string
          community_id: COMMUNITY_ID,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-community] Join raw response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
      results.cookieFormat = "raw_string";
    }

    // ===== ACTION: Post to Community =====
    if (action === "post") {
      const body = await req.json().catch(() => ({}));
      const text = body.text || "🎣 Testing TUNA community posting! This should only appear in the community, not on the main timeline.";
      
      console.log(`[test-community] Posting to community ${COMMUNITY_ID}...`);
      console.log(`[test-community] Tweet text: ${text}`);
      
      // Post to community with share_with_followers=false to prevent main wall appearance
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/create_tweet_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: loginCookies,
          tweet_text: text,
          community_id: COMMUNITY_ID,
          share_with_followers: false, // Prevents post from appearing on main timeline
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-community] Post response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: Get Community Tweets =====
    if (action === "tweets") {
      console.log(`[test-community] Fetching tweets from community ${COMMUNITY_ID}...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/community/tweets?community_id=${COMMUNITY_ID}&cursor=`, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      const responseText = await response.text();
      console.log(`[test-community] Tweets response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
    }

    // ===== ACTION: Check if BuildTuna is a member =====
    if (action === "check_member") {
      console.log(`[test-community] Checking if BuildTuna is a community member...`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/community/members?community_id=${COMMUNITY_ID}`, {
        method: "GET",
        headers: {
          "X-API-Key": apiKey,
        },
      });

      const data = await response.json();
      const members = data.members || [];
      const buildTuna = members.find((m: { screen_name: string }) => 
        m.screen_name?.toLowerCase() === "buildtuna"
      );
      
      results.status = response.status;
      results.isMember = !!buildTuna;
      results.buildTunaData = buildTuna || null;
      results.totalMembersInPage = members.length;
    }

    // ===== ACTION: List all endpoints (discovery) =====
    if (action === "discover") {
      console.log(`[test-community] Testing various community endpoints...`);
      
      const endpoints = [
        { name: "community/info", url: `/twitter/community/info?community_id=${COMMUNITY_ID}`, method: "GET" },
        { name: "community/tweets", url: `/twitter/community/tweets?community_id=${COMMUNITY_ID}`, method: "GET" },
        { name: "community/members", url: `/twitter/community/members?community_id=${COMMUNITY_ID}`, method: "GET" },
        { name: "community/moderators", url: `/twitter/community/moderators?community_id=${COMMUNITY_ID}`, method: "GET" },
      ];
      
      const endpointResults: Record<string, { status: number; sample: string }> = {};
      
      for (const ep of endpoints) {
        try {
          const response = await fetch(`${TWITTERAPI_BASE}${ep.url}`, {
            method: ep.method,
            headers: { "X-API-Key": apiKey },
          });
          const text = await response.text();
          endpointResults[ep.name] = { status: response.status, sample: text.slice(0, 200) };
        } catch (e) {
          endpointResults[ep.name] = { status: 0, sample: String(e) };
        }
      }
      
      results.endpoints = endpointResults;
    }

    return new Response(JSON.stringify(results, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("[test-community] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
