// Test Twitter Community Join & Post
// Community: TUNALISHOUS (ID: 2018885865972367523)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";
const COMMUNITY_ID = "2033946750424437104"; // MoonDexo community

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) {
      throw new Error("TWITTERAPI_IO_KEY not configured");
    }

    const fullCookie = Deno.env.get("X_FULL_COOKIE");
    if (!fullCookie) {
      throw new Error("X_FULL_COOKIE not configured");
    }

    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    if (!proxyUrl) {
      throw new Error("TWITTER_PROXY not configured");
    }

    // Parse cookies into object then base64 encode
    const loginCookiesObj: Record<string, string> = {};
    fullCookie.split(";").forEach((cookie) => {
      const [key, ...rest] = cookie.trim().split("=");
      if (key && rest.length > 0) {
        loginCookiesObj[key.trim()] = rest.join("=").trim();
      }
    });
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

    // ===== ACTION: Join Community (V2 endpoint) =====
    if (action === "join") {
      console.log(`[test-community] Joining community ${COMMUNITY_ID}...`);
      console.log(`[test-community] Cookie keys: ${Object.keys(loginCookiesObj).join(', ')}`);
      console.log(`[test-community] Has auth_token: ${!!loginCookiesObj.auth_token}`);
      console.log(`[test-community] Has ct0: ${!!loginCookiesObj.ct0}`);
      
      const response = await fetch(`${TWITTERAPI_BASE}/twitter/join_community_v2`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKey,
        },
        body: JSON.stringify({
          login_cookies: loginCookies,
          community_id: COMMUNITY_ID,
          proxy: proxyUrl,
        }),
      });

      const responseText = await response.text();
      console.log(`[test-community] Join response: ${response.status} - ${responseText.slice(0, 500)}`);
      
      results.status = response.status;
      results.response = JSON.parse(responseText);
      results.cookieFormat = "base64_json";
      results.cookieKeys = Object.keys(loginCookiesObj);
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
