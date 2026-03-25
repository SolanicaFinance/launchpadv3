import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ADMIN_PASSWORD = "saturn135@";

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
            socks5_url: campaign.socks5_url || null,
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

        // Use twitterapi.io to get following list
        const allFollowing: Array<{ username: string; name: string }> = [];
        let cursor = "";
        let pageCount = 0;
        const MAX_PAGES = 20; // Safety limit

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

          // Small delay between pages
          await new Promise(r => setTimeout(r, 500));
        }

        console.log(`Scraped ${allFollowing.length} following for @${username}`);

        if (allFollowing.length === 0) {
          result = { success: true, count: 0, message: "No following found" };
          break;
        }

        // Delete existing targets for this campaign
        await supabase.from("mentioner_targets").delete().eq("campaign_id", campaign_id);

        // Insert in batches of 100
        for (let i = 0; i < allFollowing.length; i += 100) {
          const batch = allFollowing.slice(i, i + 100).map(u => ({
            campaign_id,
            username: u.username,
            display_name: u.name,
            status: "pending",
          }));
          const { error } = await supabase.from("mentioner_targets").insert(batch);
          if (error) {
            console.error("Insert batch error:", error);
            throw error;
          }
        }

        // Update campaign total
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

      // ── Send single mention (manual test) ──
      case "send_mention": {
        const { campaign_id, target_id } = params;
        const sendResult = await sendMention(supabase, campaign_id, target_id);
        result = sendResult;
        break;
      }

      // ── Process next in queue (called by cron or manually) ──
      case "process_next": {
        const { campaign_id } = params;
        
        // Get campaign
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

        // Get next pending target
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

        const sendResult = await sendMention(supabase, campaign_id, targets[0].id);
        result = sendResult;
        break;
      }

      // ── Verify SOCKS5 ──
      case "verify_socks5": {
        const { socks5_url } = params;
        // We can't directly test SOCKS5 from Deno, but we can validate the format
        const pattern = /^socks5:\/\/.+:\d+$/;
        const isValid = pattern.test(socks5_url) || /^.+:\d+$/.test(socks5_url);
        result = { valid: isValid, message: isValid ? "SOCKS5 URL format is valid" : "Invalid SOCKS5 URL format. Use socks5://host:port or host:port" };
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

// ── Helper: Send a mention reply ──
async function sendMention(supabase: any, campaignId: string, targetId: string) {
  // Get campaign with account info
  const { data: campaign } = await supabase
    .from("mentioner_campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();
  if (!campaign) throw new Error("Campaign not found");

  // Get account credentials
  const { data: account } = await supabase
    .from("x_bot_accounts")
    .select("*")
    .eq("id", campaign.account_id)
    .single();
  if (!account) throw new Error("Bot account not found");

  // Get target
  const { data: target } = await supabase
    .from("mentioner_targets")
    .select("*")
    .eq("id", targetId)
    .single();
  if (!target) throw new Error("Target not found");

  try {
    // Generate AI pitch using Lovable AI
    const pitchText = await generatePitch(target.username, campaign.pitch_template);

    // Post the reply/mention using Twitter cookies
    const authToken = account.auth_token_encrypted;
    const ct0 = account.ct0_token_encrypted;
    const fullCookie = account.full_cookie_encrypted;

    if (!authToken || !ct0) {
      throw new Error("Account missing auth_token or ct0 credentials");
    }

    // Create a tweet that starts with @username (makes it a reply/mention, not shown on timeline)
    const tweetText = `@${target.username} ${pitchText}`;

    // Use Twitter's API to create tweet
    const socks5 = campaign.socks5_url || (account.socks5_urls?.length > 0 ? account.socks5_urls[0] : null);

    const tweetResult = await postTweet(tweetText, authToken, ct0, fullCookie, socks5);

    // Update target status
    await supabase.from("mentioner_targets").update({
      status: "sent",
      sent_at: new Date().toISOString(),
      reply_text: tweetText,
    }).eq("id", targetId);

    // Update campaign counters
    await supabase.from("mentioner_campaigns").update({
      sent_count: campaign.sent_count + 1,
      current_index: campaign.current_index + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", campaignId);

    return { success: true, tweet: tweetText, tweetId: tweetResult?.id };
  } catch (err) {
    console.error("Send mention error:", err);
    await supabase.from("mentioner_targets").update({
      status: "failed",
      error_message: err instanceof Error ? err.message : "Unknown error",
    }).eq("id", targetId);

    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ── Generate pitch text using Lovable AI ──
async function generatePitch(targetUsername: string, template?: string | null): string {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    // Fallback template
    return `Hi, shooting in the dark here — we recently launched Saturn Terminal, a full Trading Terminal for Solana, BNB, and Bitcoin. We have a unique BTC meme trading protocol called TAT. Would love to explore if you'd be interested in collaborating or investing. DM us if curious!`;
  }

  const baseContext = template || 
    `Saturn Terminal is a recently launched Trading Terminal product. It supports trading on Solana, BNB Chain, and has launched Bitcoin meme trading with its own protocol called TAT (Trade Anything Terminal). The platform has a token called CLAW. The team is looking for investors and collaborators.`;

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
          content: `You write short, professional but friendly pitch messages for X (Twitter). The message will be sent as a mention/reply to crypto influencers. Rules:
- DO NOT start with @username (it will be prepended automatically)
- Start with a greeting like "Hi", "Hey", "Hello" etc
- Keep it between 200-280 characters (Twitter limit minus the @tag)
- Mention Saturn Terminal as the product name
- Mention it supports Solana, BNB trading and Bitcoin meme trading with TAT protocol  
- Ask about investing or collaborating
- End with something like "Shoot a DM if interested" or similar
- Be unique each time, vary the wording significantly
- Sound human, not robotic
- Do NOT use hashtags
- Do NOT use emojis excessively (max 1-2)`,
        },
        {
          role: "user",
          content: `Generate a unique pitch message for @${targetUsername}. Context about the project: ${baseContext}`,
        },
      ],
    }),
  });

  if (!resp.ok) {
    console.error("AI pitch generation failed:", resp.status);
    return `Hi, shooting in the dark — we recently launched Saturn Terminal, a Trading Terminal for Solana, BNB & Bitcoin. We built our own BTC meme trading protocol called TAT. Would love to explore a collaboration. DM us if interested!`;
  }

  const data = await resp.json();
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return `Hey there! We just launched Saturn Terminal — a full trading platform for Solana, BNB, and Bitcoin memes via our TAT protocol. Looking for partners and backers. Interested? Shoot us a DM!`;
  }

  // Clean up: remove any @username the AI might have added at the start
  return content.replace(/^@\w+[\s,]*/, "").trim();
}

// ── Post tweet using Twitter cookie auth ──
async function postTweet(text: string, authToken: string, ct0: string, fullCookie: string | null, _socks5: string | null) {
  const cookie = fullCookie || `auth_token=${authToken}; ct0=${ct0}`;

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
