const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITTERAPI_BASE = "https://api.twitterapi.io";

const safeJsonParse = (text: string): any => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const stripQuotes = (v: string) => v.replace(/^['"]+|['"]+$/g, "").trim();

const parseCookieString = (raw: string): Record<string, string> => {
  const out: Record<string, string> = {};
  const parts = raw.split(";");
  for (const part of parts) {
    const [k, ...rest] = part.trim().split("=");
    if (!k) continue;
    const val = rest.join("=");
    if (val) out[k.trim()] = stripQuotes(val);
  }
  return out;
};

const normalizeCookieValue = (raw: string, key: string): { value: string; cookies: Record<string, string> } => {
  const trimmed = stripQuotes(raw);
  const looksLikeCookieString = trimmed.includes(";") || trimmed.includes("=");
  if (looksLikeCookieString) {
    const cookies = parseCookieString(trimmed);
    const val = cookies[key] ?? trimmed;
    return { value: stripQuotes(val), cookies };
  }
  return { value: trimmed, cookies: {} };
};

const buildLoginCookies = (cookies: Record<string, string>) => JSON.stringify(cookies);

const buildLoginCookiesBase64 = (cookies: Record<string, string>) =>
  btoa(buildLoginCookies(cookies));

async function twitterApiRequest(args: {
  apiKey: string;
  path: string;
  method?: "GET" | "POST";
  query?: Record<string, string | undefined>;
  body?: unknown;
}): Promise<{ status: number; text: string; json: any }>{
  const method = args.method ?? "GET";
  const url = new URL(`${TWITTERAPI_BASE}${args.path}`);
  if (args.query) {
    for (const [k, v] of Object.entries(args.query)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: {
      "X-API-Key": args.apiKey,
      ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
    },
    body: method === "POST" ? JSON.stringify(args.body ?? {}) : undefined,
  });
  const text = await res.text();
  return { status: res.status, text, json: safeJsonParse(text) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tweet_id } = await req.json();
    
    if (!tweet_id) {
      return new Response(
        JSON.stringify({ success: false, error: "tweet_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    const proxyUrl = Deno.env.get("TWITTER_PROXY");
    const xFullCookie = Deno.env.get("X_FULL_COOKIE"); // NEW: full cookie header from browser
    const xAuthToken = Deno.env.get("X_AUTH_TOKEN");
    const xCt0 = Deno.env.get("X_CT0_TOKEN") || Deno.env.get("X_CT0");
    const xUsername = Deno.env.get("X_ACCOUNT_USERNAME");

    // Require API key and proxy; auth can come from X_FULL_COOKIE OR individual tokens
    const hasAuth = !!xFullCookie || (!!xAuthToken && !!xCt0);
    if (!twitterApiKey || !proxyUrl || !hasAuth) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing credentials",
          has_api_key: !!twitterApiKey,
          has_proxy: !!proxyUrl,
          has_full_cookie: !!xFullCookie,
          has_auth_token: !!xAuthToken,
          has_ct0: !!xCt0,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const marker = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const tweetText = `🦞 Saturn test ${marker}`;
    const results: Record<string, any> = { marker };

    // Build cookie object - prioritize X_FULL_COOKIE if available
    let mergedCookies: Record<string, string>;
    if (xFullCookie) {
      // Full cookie header from browser (preferred)
      mergedCookies = parseCookieString(xFullCookie);
      results.cookie_source = "X_FULL_COOKIE";
    } else {
      // Fallback to individual tokens
      const authNorm = normalizeCookieValue(xAuthToken!, "auth_token");
      const ct0Norm = normalizeCookieValue(xCt0!, "ct0");
      mergedCookies = { ...authNorm.cookies, ...ct0Norm.cookies };
      mergedCookies.auth_token = authNorm.value;
      mergedCookies.ct0 = ct0Norm.value;
      results.cookie_source = "individual_tokens";
    }

    results.normalized = {
      has_auth_token: !!mergedCookies.auth_token,
      has_ct0: !!mergedCookies.ct0,
      has_guest_id: !!mergedCookies.guest_id,
      has_twid: !!mergedCookies.twid,
      auth_token_len: mergedCookies.auth_token?.length ?? 0,
      ct0_len: mergedCookies.ct0?.length ?? 0,
      cookie_keys: Object.keys(mergedCookies).slice(0, 20),
    };

    const loginCookiesB64 = buildLoginCookiesBase64(mergedCookies);

    // 0) (Sanity) Check twitterapi.io account credits endpoint (not auth-related, but confirms API key works)
    const myInfo = await twitterApiRequest({
      apiKey: twitterApiKey,
      path: "/oapi/my/info",
      method: "GET",
    });
    results.api_key_ok = { status: myInfo.status, response: myInfo.json ?? myInfo.text };

    // 1) Post reply using create_tweet_v2 with base64 login_cookies
    const post = await twitterApiRequest({
      apiKey: twitterApiKey,
      path: "/twitter/create_tweet_v2",
      method: "POST",
      body: {
        login_cookies: loginCookiesB64,
        tweet_text: tweetText,
        reply_to_tweet_id: tweet_id,
        proxy: proxyUrl,
      },
    });
    results.post_v2 = { status: post.status, response: post.json ?? post.text };
    let createdTweetId: string | undefined = post.json?.tweet_id;

    // 3) Verify we can see the created tweet ourselves
    if (createdTweetId) {
      const verifyTweet = await twitterApiRequest({
        apiKey: twitterApiKey,
        path: "/twitter/tweets",
        method: "GET",
        query: { tweet_ids: createdTweetId },
      });
      results.verify_tweet = {
        status: verifyTweet.status,
        response: verifyTweet.json ?? verifyTweet.text,
      };

      // Optional: also verify it shows up in our recent tweets
      if (xUsername) {
        const lastTweets = await twitterApiRequest({
          apiKey: twitterApiKey,
          path: "/twitter/user/last_tweets",
          method: "GET",
          query: { userName: xUsername },
        });
        results.verify_last_tweets = {
          status: lastTweets.status,
          response: lastTweets.json ?? lastTweets.text,
        };
      }

      // Optional: check replies for the original tweet (best evidence of reply)
      const replies = await twitterApiRequest({
        apiKey: twitterApiKey,
        path: "/twitter/tweet/replies",
        method: "GET",
        query: { tweetId: tweet_id },
      });
      results.verify_replies = {
        status: replies.status,
        response: replies.json ?? replies.text,
      };
    }

    return new Response(
      JSON.stringify({ success: true, tweet_id, created_tweet_id: createdTweetId ?? null, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[test] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
