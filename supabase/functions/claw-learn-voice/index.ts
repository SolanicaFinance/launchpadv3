import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const TWITTERAPI_IO_BASE = "https://api.twitterapi.io/twitter";

/**
 * Fetch up to 100 tweets from a Twitter user via twitterapi.io
 * Uses pagination cursor to fetch multiple pages of 20 tweets each
 */
async function fetchTweets(username: string, apiKey: string, count = 100): Promise<string[]> {
  const cleanUsername = username.replace("@", "");
  const allTweets: string[] = [];
  let cursor: string | null = null;
  let pages = 0;
  const maxPages = Math.ceil(count / 20);

  while (pages < maxPages && allTweets.length < count) {
    let url = `${TWITTERAPI_IO_BASE}/user/last_tweets?userName=${encodeURIComponent(cleanUsername)}&count=20`;
    if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

    console.log(`[saturn-learn-voice] Fetching page ${pages + 1} for @${cleanUsername}...`);

    try {
      const response = await fetch(url, {
        headers: { "X-API-Key": apiKey },
      });

      if (!response.ok) {
        console.error(`[saturn-learn-voice] twitterapi.io error: ${response.status}`);
        const errorText = await response.text();
        console.error("Error body:", errorText);
        break;
      }

      const data = await response.json();
      
      // Handle multiple response structures from twitterapi.io
      let tweets: any[] = [];
      if (data?.data?.tweets && Array.isArray(data.data.tweets)) {
        tweets = data.data.tweets;
      } else if (Array.isArray(data?.data)) {
        tweets = data.data;
      } else if (Array.isArray(data?.tweets)) {
        tweets = data.tweets;
      } else if (Array.isArray(data)) {
        tweets = data;
      }

      if (tweets.length === 0) break;

      // Filter out RTs and very short tweets
      const filtered = tweets
        .filter((t: any) => {
          const text = t.text || t.full_text || "";
          if (text.startsWith("RT @")) return false;
          const cleanText = text.replace(/https?:\/\/\S+/g, "").trim();
          return cleanText.length > 10;
        })
        .map((t: any) => t.text || t.full_text || "");

      allTweets.push(...filtered);
      
      // Get pagination cursor
      cursor = data?.next_cursor || data?.cursor || data?.data?.next_cursor || null;
      if (!cursor) break;
      
      pages++;
    } catch (error) {
      console.error("[saturn-learn-voice] Error fetching tweets:", error);
      break;
    }
  }

  console.log(`[saturn-learn-voice] Fetched ${allTweets.length} tweets total from @${cleanUsername}`);
  return allTweets.slice(0, count);
}

/**
 * Deep style analysis using AI — extracts more than the basic fingerprint
 */
async function analyzeStyle(tweets: string[], lovableApiKey: string): Promise<Record<string, unknown> | null> {
  if (tweets.length < 5) {
    console.log("[saturn-learn-voice] Not enough tweets to analyze");
    return null;
  }

  const tweetSample = tweets.slice(0, 60).join("\n---\n");

  const systemPrompt = `You are an expert at analyzing writing styles and personality from social media posts. You will be given a collection of tweets from a single user and must extract a comprehensive style fingerprint.

Return ONLY valid JSON with no additional text or markdown.`;

  const userPrompt = `Analyze these ${tweets.length} tweets from @LobstarWilde and extract a deep writing style fingerprint.

Tweets:
${tweetSample}

Return JSON with these fields:
{
  "tone": "(one of: formal, casual, professional, meme_lord, enthusiastic, cynical, analytical, friendly, aggressive)",
  "emoji_frequency": "(one of: none, low, medium, high)",
  "preferred_emojis": ["top 8 most used emojis"],
  "avg_sentence_length": "(one of: short, medium, long)",
  "capitalization": "(one of: standard, lowercase_only, caps_for_emphasis, all_caps, mixed)",
  "common_phrases": ["10-15 phrases, expressions, or words they repeat often"],
  "vocabulary_style": "(one of: crypto_native, professional, casual, academic, meme_heavy, technical)",
  "punctuation_style": "(one of: minimal, standard, exclamation_heavy, ellipsis_heavy, question_heavy)",
  "sample_voice": "Write a 20-word sample tweet in their EXACT voice about launching a new meme coin",
  "language": "primary language detected",
  "humor_patterns": "describe their humor style in 2-3 sentences — what makes them funny, how they joke",
  "topic_preferences": "what topics do they tweet about most, in order of frequency",
  "deflection_style": "how do they handle criticism or negative vibes — dismissive, humorous, direct, ignore",
  "energy_level": "(one of: chill, moderate, high_energy, chaotic)",
  "signature_moves": ["3-5 unique stylistic quirks that make their writing instantly recognizable"],
  "tweet_count_analyzed": ${tweets.length}
}`;

  try {
    const response = await fetch(LOVABLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 1000,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      console.error(`[saturn-learn-voice] AI API error: ${response.status}`);
      const errText = await response.text();
      console.error(errText);
      return null;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim();

    if (!content) {
      console.error("[saturn-learn-voice] No content from AI");
      return null;
    }

    // Parse JSON (handle markdown code blocks)
    let jsonStr = content;
    if (content.includes("```json")) {
      jsonStr = content.split("```json")[1].split("```")[0].trim();
    } else if (content.includes("```")) {
      jsonStr = content.split("```")[1].split("```")[0].trim();
    }

    const result = JSON.parse(jsonStr);
    console.log("[saturn-learn-voice] ✅ Style analysis complete");
    return result;
  } catch (error) {
    console.error("[saturn-learn-voice] Error analyzing style:", error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const targetUsername = (body.username || "LobstarWilde").replace("@", "");
    const tweetCount = Math.min(body.count || 100, 200);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");
    const twitterApiKey = Deno.env.get("TWITTERAPI_IO_KEY");

    if (!lovableApiKey || !twitterApiKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing API keys (LOVABLE_API_KEY or TWITTERAPI_IO_KEY)" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[saturn-learn-voice] Starting voice learning for @${targetUsername} (${tweetCount} tweets)`);

    // Step 1: Fetch tweets
    const tweets = await fetchTweets(targetUsername, twitterApiKey, tweetCount);

    if (tweets.length < 5) {
      return new Response(
        JSON.stringify({ success: false, error: `Only ${tweets.length} tweets found — need at least 5` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Analyze style with AI
    const styleAnalysis = await analyzeStyle(tweets, lovableApiKey);

    if (!styleAnalysis) {
      return new Response(
        JSON.stringify({ success: false, error: "Style analysis failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Cache in twitter_style_library
    const { error: upsertError } = await supabase
      .from("twitter_style_library")
      .upsert(
        {
          twitter_username: targetUsername.toLowerCase(),
          writing_style: styleAnalysis,
          tweet_count: tweets.length,
          learned_at: new Date().toISOString(),
          usage_count: 1,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "twitter_username" }
      );

    if (upsertError) {
      console.error("[saturn-learn-voice] Cache error:", upsertError);
    } else {
      console.log(`[saturn-learn-voice] ✅ Cached style for @${targetUsername}`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        username: targetUsername,
        tweetsAnalyzed: tweets.length,
        style: styleAnalysis,
        sampleTweets: tweets.slice(0, 5),
        cachedAt: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[saturn-learn-voice] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
