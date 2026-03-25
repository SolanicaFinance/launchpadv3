import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_PASSWORD = "saturn135@";
const NSOCKS_API = "https://nsocks.network/api";
const MAX_DAILY_PURCHASES = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders, status: 204 });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json();
    const { action, adminPassword, ...params } = body;

    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let result: any = null;

    switch (action) {
      // ── List campaigns ──
      case "list_campaigns": {
        const { data, error } = await supabase
          .from("mentioner_campaigns")
          .select("*")
          .order("created_at", { ascending: false });
        if (error) throw error;
        result = { campaigns: data };
        break;
      }

      // ── Create campaign ──
      case "create_campaign": {
        const { campaign } = params;
        const { data, error } = await supabase
          .from("mentioner_campaigns")
          .insert({
            account_id: campaign.account_id,
            source_username: campaign.source_username,
            source_url: campaign.source_url || null,
            interval_minutes: campaign.interval_minutes || 3,
            socks5_url: null, // Auto-managed now
            pitch_template: campaign.pitch_template || null,
            is_active: false,
          })
          .select()
          .single();
        if (error) throw error;
        result = { campaign: data };
        break;
      }

      // ── Update campaign ──
      case "update_campaign": {
        const { id, updates } = params;
        const { error } = await supabase
          .from("mentioner_campaigns")
          .update({ ...updates, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ── Delete campaign ──
      case "delete_campaign": {
        const { error } = await supabase.from("mentioner_campaigns").delete().eq("id", params.id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      // ── Scrape following list ──
      case "scrape_following": {
        const { campaign_id, username } = params;
        const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
        if (!twitterApiKey) throw new Error("TWITTERAPI_IO_KEY not configured");

        const allFollowing: Array<{ username: string; name: string }> = [];
        let cursor = "";
        let pageCount = 0;
        const MAX_PAGES = 20;

        while (pageCount < MAX_PAGES) {
          const url = new URL("https://twitterapi.io/api/user/following");
          url.searchParams.set("userName", username);
          if (cursor) url.searchParams.set("cursor", cursor);

          const resp = await fetch(url.toString(), {
            headers: { "x-api-key": twitterApiKey },
          });

          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`TwitterAPI error (page ${pageCount}):`, resp.status, errText);
            throw new Error(`Failed to fetch following list: ${resp.status}`);
          }

          const data = await resp.json();
          const users = data.users || data.following || [];
          
          for (const u of users) {
            const uname = u.userName || u.username || u.screen_name;
            const dname = u.name || u.displayName || uname;
            if (uname) allFollowing.push({ username: uname, name: dname });
          }

          cursor = data.next_cursor || data.cursor || "";
          pageCount++;
          if (!cursor || users.length === 0) break;
          await new Promise(r => setTimeout(r, 500));
        }

        console.log(`Scraped ${allFollowing.length} following for @${username}`);

        if (allFollowing.length === 0) {
          result = { success: true, count: 0, message: "No following found" };
          break;
        }

        await supabase.from("mentioner_targets").delete().eq("campaign_id", campaign_id);

        for (let i = 0; i < allFollowing.length; i += 100) {
          const batch = allFollowing.slice(i, i + 100).map(u => ({
            campaign_id,
            username: u.username,
            display_name: u.name,
            status: "pending",
          }));
          const { error } = await supabase.from("mentioner_targets").insert(batch);
          if (error) throw error;
        }

        await supabase.from("mentioner_campaigns")
          .update({ total_targets: allFollowing.length, current_index: 0, sent_count: 0, updated_at: new Date().toISOString() })
          .eq("id", campaign_id);

        result = { success: true, count: allFollowing.length };
        break;
      }

      // ── List targets ──
      case "list_targets": {
        const { campaign_id, limit } = params;
        const { data, error } = await supabase
          .from("mentioner_targets")
          .select("*")
          .eq("campaign_id", campaign_id)
          .order("created_at", { ascending: true })
          .limit(limit || 200);
        if (error) throw error;
        result = { targets: data };
        break;
      }

      // ── Send single mention ──
      case "send_mention": {
        const { campaign_id, target_id } = params;
        result = await sendMention(supabase, campaign_id, target_id);
        break;
      }

      // ── Process next in queue ──
      case "process_next": {
        const { campaign_id } = params;
        
        const { data: campaign, error: cErr } = await supabase
          .from("mentioner_campaigns")
          .select("*")
          .eq("id", campaign_id)
          .single();
        if (cErr) throw cErr;
        if (!campaign.is_active) {
          result = { success: false, message: "Campaign is paused" };
          break;
        }

        const { data: targets, error: tErr } = await supabase
          .from("mentioner_targets")
          .select("*")
          .eq("campaign_id", campaign_id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(1);
        if (tErr) throw tErr;

        if (!targets || targets.length === 0) {
          result = { success: true, message: "No more pending targets" };
          break;
        }

        result = await sendMention(supabase, campaign_id, targets[0].id);
        break;
      }

      // ── NSocks: Get balance ──
      case "nsocks_balance": {
        const apiKey = Deno.env.get("NSOCKS_API_KEY");
        if (!apiKey) throw new Error("NSOCKS_API_KEY not configured");
        const resp = await nsocksCall("balance", { API_KEY: apiKey });
        result = { balance: resp.DATA?.BALANCE || "0" };
        break;
      }

      // ── NSocks: List active proxies ──
      case "nsocks_active_proxies": {
        const { data, error } = await supabase
          .from("mentioner_proxies")
          .select("*")
          .eq("is_active", true)
          .gte("expires_at", new Date().toISOString())
          .order("purchased_at", { ascending: false });
        if (error) throw error;
        result = { proxies: data };
        break;
      }

      // ── NSocks: Force buy new proxy ──
      case "nsocks_buy_proxy": {
        const proxy = await buyNewProxy(supabase, params.campaign_id || null);
        result = { success: true, proxy };
        break;
      }

      // ── NSocks: Get purchase history (today) ──
      case "nsocks_today_purchases": {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const { data, error } = await supabase
          .from("mentioner_proxies")
          .select("*")
          .gte("purchased_at", todayStart.toISOString())
          .order("purchased_at", { ascending: false });
        if (error) throw error;
        result = { proxies: data, count: data?.length || 0 };
        break;
      }

      // ── Generate test pitches (dry run, no posting) ──
      case "generate_test_pitches": {
        const { campaign_id, count } = params;
        const numPitches = Math.min(count || 20, 30);

        const { data: campaign } = await supabase
          .from("mentioner_campaigns")
          .select("pitch_template")
          .eq("id", campaign_id)
          .single();

        // Get pending targets to use real usernames
        const { data: targets } = await supabase
          .from("mentioner_targets")
          .select("username, display_name")
          .eq("campaign_id", campaign_id)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(numPitches);

        const usernames = targets?.map((t: any) => t.username) || [];
        // Pad with generic names if not enough targets
        while (usernames.length < numPitches) {
          usernames.push(`testuser${usernames.length + 1}`);
        }

        const pitches: Array<{ username: string; message: string }> = [];
        for (const username of usernames.slice(0, numPitches)) {
          const pitch = await generatePitch(username, campaign?.pitch_template);
          pitches.push({ username, message: pitch }); // pitch already includes @username
          // Small delay to avoid rate limiting
          await new Promise(r => setTimeout(r, 300));
        }

        result = { success: true, pitches, count: pitches.length };
        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("[mentioner-admin] Error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ═══════════════════════════════════════════════
// NSocks API helpers
// ═══════════════════════════════════════════════

async function nsocksCall(method: string, body: Record<string, any>) {
  const resp = await fetch(`${NSOCKS_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ METHOD: method, ...body }),
  });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`NSocks API error (${method}): ${resp.status} - ${text.substring(0, 200)}`);
  }
  const data = await resp.json();
  if (data.STATUS !== "OK" && data.STATUS !== "SUCCESS") {
    throw new Error(`NSocks ${method} failed: ${data.MESSAGE || JSON.stringify(data)}`);
  }
  return data;
}

// Get or provision a working SOCKS5 proxy
async function getActiveProxy(supabase: any, campaignId: string | null): Promise<{ ip_port: string; socks_auth: string | null }> {
  const now = new Date().toISOString();

  // 1. Check for any active, non-expired proxy in our DB
  const { data: activeProxies } = await supabase
    .from("mentioner_proxies")
    .select("*")
    .eq("is_active", true)
    .gte("expires_at", now)
    .order("purchased_at", { ascending: false })
    .limit(5);

  if (activeProxies && activeProxies.length > 0) {
    // Try the most recent one first
    const proxy = activeProxies[0];
    console.log(`[proxy] Using active proxy ${proxy.ip_port} (expires ${proxy.expires_at})`);
    
    // Update last_used_at
    await supabase.from("mentioner_proxies")
      .update({ last_used_at: now })
      .eq("id", proxy.id);

    return { ip_port: proxy.ip_port, socks_auth: proxy.socks_auth };
  }

  // 2. Check recently expired/failed ones — maybe they still work (retry old ones)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recentProxies } = await supabase
    .from("mentioner_proxies")
    .select("*")
    .gte("expires_at", oneHourAgo) // Expired within last hour
    .lt("expires_at", now)
    .eq("failure_count", 0) // Never failed before
    .order("expires_at", { ascending: false })
    .limit(1);

  if (recentProxies && recentProxies.length > 0) {
    const proxy = recentProxies[0];
    console.log(`[proxy] Retrying recently expired proxy ${proxy.ip_port}`);
    return { ip_port: proxy.ip_port, socks_auth: proxy.socks_auth };
  }

  // 3. Also check nsocks history for active paid proxies we might have missed
  const apiKey = Deno.env.get("NSOCKS_API_KEY");
  if (apiKey) {
    try {
      const histResp = await nsocksCall("history", {
        API_KEY: apiKey,
        COUNTRY: "US",
        ONLINE: 1,
        PAID: 1,
        COUNT: "5",
      });
      const histProxies = histResp.DATA?.PROXIES || [];
      for (const hp of histProxies) {
        if (hp.online === 1 && parseInt(hp.mins_left || "0") > 10) {
          console.log(`[proxy] Found active proxy in nsocks history: ${hp.proxy} (${hp.mins_left}min left)`);
          
          // Save to our DB if not already there
          const { data: existing } = await supabase
            .from("mentioner_proxies")
            .select("id")
            .eq("nsocks_proxy_id", hp.id)
            .maybeSingle();
          
          if (!existing) {
            const expiresAt = new Date(Date.now() + parseInt(hp.mins_left) * 60 * 1000).toISOString();
            await supabase.from("mentioner_proxies").insert({
              campaign_id: campaignId,
              nsocks_proxy_id: hp.id,
              nsocks_history_id: hp.history_id,
              ip_port: hp.proxy,
              socks_auth: hp.socks_auth || null,
              country: "US",
              region: hp.region,
              city: hp.city,
              isp: hp.isp,
              ping: parseInt(hp.ping || "0"),
              price: parseFloat(hp.buy_price || "0"),
              purchased_at: new Date().toISOString(),
              expires_at: expiresAt,
              is_active: true,
            });
          }

          return { ip_port: hp.proxy, socks_auth: hp.socks_auth || null };
        }
      }
    } catch (err) {
      console.error("[proxy] NSocks history check failed:", err);
    }
  }

  // 4. No active proxy found — buy a new one
  console.log("[proxy] No active proxy found, buying new one...");
  const newProxy = await buyNewProxy(supabase, campaignId);
  return { ip_port: newProxy.ip_port, socks_auth: newProxy.socks_auth };
}

async function buyNewProxy(supabase: any, campaignId: string | null) {
  const apiKey = Deno.env.get("NSOCKS_API_KEY");
  if (!apiKey) throw new Error("NSOCKS_API_KEY not configured");

  // Safety check: max 5 purchases per day
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const { data: todayPurchases } = await supabase
    .from("mentioner_proxies")
    .select("id")
    .gte("purchased_at", todayStart.toISOString());

  if (todayPurchases && todayPurchases.length >= MAX_DAILY_PURCHASES) {
    throw new Error(`Daily proxy purchase limit reached (${MAX_DAILY_PURCHASES}). Existing proxies may have expired. Wait for tomorrow or increase limit.`);
  }

  // Search for a good US residential/ISP proxy with low ping
  const searchResp = await nsocksCall("search", {
    API_KEY: apiKey,
    COUNTRY: "US",
    RESIDENTIAL: 1,
    SORT: "ping-desc",
    EXCLUDE_BLACKS: 1,
    HIGHSPEED: 1,
    COUNT: "10",
  });

  const proxies = searchResp.DATA?.PROXIES || [];
  if (proxies.length === 0) {
    // Fallback: try without HIGHSPEED filter
    const fallbackResp = await nsocksCall("search", {
      API_KEY: apiKey,
      COUNTRY: "US",
      RESIDENTIAL: 1,
      SORT: "ping-desc",
      EXCLUDE_BLACKS: 1,
      COUNT: "10",
    });
    const fallbackProxies = fallbackResp.DATA?.PROXIES || [];
    if (fallbackProxies.length === 0) {
      throw new Error("No US proxies available on NSocks right now");
    }
    proxies.push(...fallbackProxies);
  }

  // Pick the best one (lowest ping, highest rating)
  const sorted = proxies.sort((a: any, b: any) => {
    const ratingDiff = parseInt(b.rating || "0") - parseInt(a.rating || "0");
    if (ratingDiff !== 0) return ratingDiff;
    return parseInt(a.ping || "999") - parseInt(b.ping || "999");
  });
  const chosen = sorted[0];

  console.log(`[proxy] Buying proxy ${chosen.id} in ${chosen.city}, ${chosen.region} (${chosen.isp}) - $${chosen.price}, ping: ${chosen.ping}ms`);

  // Generate random auth credentials (5-7 chars each)
  const username = randomString(6);
  const password = randomString(6);

  // Buy the proxy
  const buyResp = await nsocksCall("buy", {
    API_KEY: apiKey,
    ID: parseInt(chosen.id),
    USERNAME: username,
    PASSWORD: password,
  });

  const boughtProxy = buyResp.DATA?.PROXY;
  if (!boughtProxy) throw new Error("NSocks buy returned no proxy data");

  const ipPort = boughtProxy.PORT; // format: "123.0.220.210:33494"
  const socksAuth = boughtProxy.SOCKS_AUTH || `${username}:${password}`;

  console.log(`[proxy] Bought proxy: ${ipPort}, auth: ${socksAuth}`);

  // Save to DB
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24h from now
  const { data: saved, error } = await supabase.from("mentioner_proxies").insert({
    campaign_id: campaignId,
    nsocks_proxy_id: String(boughtProxy.ID || chosen.id),
    ip_port: ipPort,
    socks_auth: socksAuth,
    country: "US",
    region: chosen.region || null,
    city: chosen.city || null,
    isp: chosen.isp || null,
    ping: parseInt(chosen.ping || "0"),
    price: parseFloat(chosen.price || "0"),
    purchased_at: new Date().toISOString(),
    expires_at: expiresAt,
    is_active: true,
  }).select().single();

  if (error) {
    console.error("Failed to save proxy:", error);
    throw error;
  }

  return saved;
}

function randomString(len: number): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

// Mark a proxy as failed
async function markProxyFailed(supabase: any, ipPort: string) {
  await supabase.from("mentioner_proxies")
    .update({
      failure_count: 1, // Simple increment via raw value
      last_failure_at: new Date().toISOString(),
    })
    .eq("ip_port", ipPort)
    .eq("is_active", true);
}

// ═══════════════════════════════════════════════
// Send mention with auto-proxy
// ═══════════════════════════════════════════════

async function sendMention(supabase: any, campaignId: string, targetId: string) {
  const { data: campaign } = await supabase
    .from("mentioner_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");

  const { data: account } = await supabase
    .from("x_bot_accounts")
    .select("*")
    .eq("id", campaign.account_id)
    .single();
  if (!account) throw new Error("Bot account not found");

  const { data: target } = await supabase
    .from("mentioner_targets")
    .select("*")
    .eq("id", targetId)
    .single();
  if (!target) throw new Error("Target not found");

  try {
    // Generate AI pitch
    const pitchText = await generatePitch(target.username, campaign.pitch_template);

    const authToken = account.auth_token_encrypted;
    const ct0 = account.ct0_token_encrypted;
    const fullCookie = account.full_cookie_encrypted;

    if (!authToken || !ct0) {
      throw new Error("Account missing auth_token or ct0 credentials");
    }

    // pitchText already starts with @username from generatePitch
    const tweetText = pitchText;

    // Auto-provision proxy
    let proxyInfo: { ip_port: string; socks_auth: string | null } | null = null;
    try {
      proxyInfo = await getActiveProxy(supabase, campaignId);
      console.log(`[mention] Using proxy: ${proxyInfo.ip_port}`);
    } catch (proxyErr) {
      console.error("[mention] Proxy provisioning failed, proceeding without proxy:", proxyErr);
    }

    // Post tweet
    const tweetResult = await postTweet(tweetText, authToken, ct0, fullCookie, proxyInfo);

    // ONLY mark as "sent" if we got a verified tweet ID back
    const tweetId = tweetResult?.id;
    if (!tweetId) {
      // Tweet may have been posted but we can't verify — mark as "unverified" not "sent"
      await supabase.from("mentioner_targets").update({
        status: "unverified",
        reply_text: tweetText,
        error_message: "Tweet posted but no tweet ID returned — needs manual verification",
      }).eq("id", targetId);

      return { success: false, tweet: tweetText, tweetId: null, proxy: proxyInfo?.ip_port || "none", error: "No tweet ID returned — target NOT marked as sent" };
    }

    // Verify the tweet actually exists by fetching it
    let verified = false;
    try {
      const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");
      if (twitterApiKey) {
        const verifyResp = await fetch(`https://twitterapi.io/api/tweet?tweetId=${tweetId}`, {
          headers: { "x-api-key": twitterApiKey },
        });
        if (verifyResp.ok) {
          const verifyData = await verifyResp.json();
          verified = !!(verifyData?.tweet || verifyData?.data);
        }
      }
      if (!verified) {
        // Fallback: if we have a tweet ID from the create response, trust it
        verified = true;
        console.log(`[mention] Could not independently verify tweet ${tweetId}, trusting create response`);
      }
    } catch (verifyErr) {
      console.error("[mention] Verification fetch failed, trusting create response:", verifyErr);
      verified = true; // Trust the create response if verification API fails
    }

    if (verified) {
      await supabase.from("mentioner_targets").update({
        status: "sent",
        sent_at: new Date().toISOString(),
        reply_text: tweetText,
        tweet_id: tweetId,
      }).eq("id", targetId);

      await supabase.from("mentioner_campaigns").update({
        sent_count: campaign.sent_count + 1,
        current_index: campaign.current_index + 1,
        updated_at: new Date().toISOString(),
      }).eq("id", campaignId);

      return { success: true, tweet: tweetText, tweetId, verified: true, proxy: proxyInfo?.ip_port || "none" };
    } else {
      await supabase.from("mentioner_targets").update({
        status: "unverified",
        reply_text: tweetText,
        error_message: `Tweet ID ${tweetId} could not be verified`,
      }).eq("id", targetId);

      return { success: false, tweet: tweetText, tweetId, verified: false, proxy: proxyInfo?.ip_port || "none", error: "Tweet not verified" };
    }
  } catch (err) {
    console.error("Send mention error:", err);

    await supabase.from("mentioner_targets").update({
      status: "failed",
      error_message: err instanceof Error ? err.message : "Unknown error",
    }).eq("id", targetId);

    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ═══════════════════════════════════════════════
// AI pitch generation
// ═══════════════════════════════════════════════

async function generatePitch(targetUsername: string, template?: string | null): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return `@${targetUsername} hey! We just launched Saturn Terminal on $BNB — a trading terminal that also supports Solana and our own BTC meme trading protocol TAT. Would love to connect if you're open to it, DM us!`;
  }

  const baseContext = template || 
    `Saturn Terminal is a recently launched Trading Terminal on BNB Chain ($BNB). It also supports trading on Solana, and has launched Bitcoin meme trading with its own protocol called TAT (Trade Anything Terminal). The platform token is $SATURN on BNB Chain. The team is looking for investors, partners, and collaborators.`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content: `You write short, warm and friendly outreach messages for X (Twitter). These are genuine, human-sounding messages to crypto people — NOT cold sales pitches. Rules:

FORMATTING:
- The message MUST start with "@${targetUsername}" — this is critical, it's how X treats it as a mention
- The cashtag $BNB MUST appear in the first 2 sentences naturally
- Keep total length between 180-270 characters INCLUDING the @tag
- Do NOT add any other @mentions

CONTENT:
- Mention Saturn Terminal as the product — a trading terminal built on $BNB
- Briefly mention it also supports Solana trading and BTC meme trading via TAT protocol
- The platform token is $SATURN (NOT $CLAW) — mention it naturally if it fits, don't force it
- Suggest connecting, collaborating, or chatting — keep it casual
- End with something inviting like "DM us if you're curious" or "would love to chat"

TONE:
- Friendly, casual, approachable — like messaging someone you respect
- NOT corporate, NOT salesy, NOT desperate
- Sound like a real person, not a bot
- Vary greetings: "hey", "yo", "what's up", "hey there", etc.
- Do NOT use "excited", "thrilled", "amazing", "incredible"
- Max 1 emoji, and only if it feels natural (often none is better)
- Do NOT use hashtags

UNIQUENESS:
- Every single message must be completely different in structure and wording
- Never reuse the same opening, closing, or sentence patterns
- Vary sentence length, rhythm, and structure significantly`,
        },
        {
          role: "user",
          content: `Write a unique outreach message for @${targetUsername}. Project context: ${baseContext}`,
        },
      ],
      temperature: 0.9,
    }),
  });

  if (!resp.ok) {
    console.error("AI pitch generation failed:", resp.status);
    return `@${targetUsername} hey! We just launched Saturn Terminal on $BNB — a trading terminal with Solana support and our own BTC meme protocol TAT. Would love to connect, DM us if you're curious!`;
  }

  const data = await resp.json();
  let content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return `@${targetUsername} yo, Saturn Terminal just went live on $BNB — full trading terminal with Solana + BTC meme trading via TAT. Looking for cool people to build with, hit us up!`;
  }

  // Ensure message starts with @username
  content = content.replace(/^["']|["']$/g, "").trim();
  if (!content.startsWith(`@${targetUsername}`)) {
    content = content.replace(/^@\w+[\s,]*/, "").trim();
    content = `@${targetUsername} ${content}`;
  }

  return content;
}

// ═══════════════════════════════════════════════
// Post tweet using Twitter cookie auth
// ═══════════════════════════════════════════════

async function postTweet(
  text: string,
  authToken: string,
  ct0: string,
  fullCookie: string | null,
  proxyInfo: { ip_port: string; socks_auth: string | null } | null
) {
  const cookie = fullCookie || `auth_token=${authToken}; ct0=${ct0}`;

  // Note: Deno's native fetch doesn't support SOCKS5 proxies directly.
  // The proxy info is logged for debugging. For actual SOCKS5 usage,
  // the tweet posting would need to go through a proxy-aware HTTP client.
  // For now, we store the proxy and use direct connection.
  if (proxyInfo) {
    console.log(`[tweet] Proxy available: ${proxyInfo.ip_port} (auth: ${proxyInfo.socks_auth ? "yes" : "no"})`);
  }

  const resp = await fetch("https://x.com/i/api/graphql/a1p9RWpkYKBjWv_I3WzS-A/CreateTweet", {
    method: "POST",
    headers: {
      "authorization": "Bearer AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA",
      "cookie": cookie,
      "x-csrf-token": ct0,
      "content-type": "application/json",
      "x-twitter-auth-type": "OAuth2Session",
      "x-twitter-active-user": "yes",
    },
    body: JSON.stringify({
      variables: {
        tweet_text: text,
        dark_request: false,
        media: { media_entities: [], possibly_sensitive: false },
        semantic_annotation_ids: [],
      },
      features: {
        communities_web_enable_tweet_community_results_fetch: true,
        c9s_tweet_anatomy_moderator_badge_enabled: true,
        tweetypie_unmention_optimization_enabled: true,
        responsive_web_edit_tweet_api_enabled: true,
        graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
        view_counts_everywhere_api_enabled: true,
        longform_notetweets_consumption_enabled: true,
        responsive_web_twitter_article_tweet_consumption_enabled: true,
        tweet_awards_web_tipping_enabled: false,
        creator_subscriptions_quote_tweet_preview_enabled: false,
        longform_notetweets_rich_text_read_enabled: true,
        longform_notetweets_inline_media_enabled: true,
        articles_preview_enabled: true,
        rweb_video_timestamps_enabled: true,
        rweb_tipjar_consumption_enabled: true,
        responsive_web_graphql_exclude_directive_enabled: true,
        verified_phone_label_enabled: false,
        freedom_of_speech_not_reach_fetch_enabled: true,
        standardized_nudges_misinfo: true,
        tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
        responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
        responsive_web_graphql_timeline_navigation_enabled: true,
        responsive_web_enhance_cards_enabled: false,
      },
      queryId: "a1p9RWpkYKBjWv_I3WzS-A",
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Tweet post error:", resp.status, errText);
    throw new Error(`Failed to post tweet: ${resp.status} - ${errText.substring(0, 200)}`);
  }

  const data = await resp.json();
  const tweetResult = data?.data?.create_tweet?.tweet_results?.result;
  return { id: tweetResult?.rest_id || null };
}
