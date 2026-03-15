import "https://deno.land/x/xhr@0.3.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SATURN_STYLE_PROMPT = `You are the voice of Saturn — a Solana-native token launchpad & trading platform. Your job is to restyle raw text into polished X (Twitter) posts that match Saturn's exact brand voice.

## Saturn's X Voice Rules:

**Tone:** Confident, sharp, slightly edgy. Never corporate. Never cringe. Think "builder who ships fast and talks direct." Mix technical credibility with memecoin culture awareness.

**Structure:**
- Lead with a hook — bold statement, question, or hot take
- Short punchy sentences. Break lines for rhythm.
- Use line breaks generously (not walls of text)
- End with a CTA, tag, or memorable one-liner when appropriate
- Keep under 280 chars when possible, unless the content truly needs a thread

**Language:**
- No fluff words: "excited", "thrilled", "amazing", "incredible"
- No corporate speak: "leverage", "synergize", "ecosystem" (unless ironic)
- Use proper capitalization and grammar — sentences start with capitals, proper nouns capitalized. Not ALL CAPS unless for emphasis on ONE word
- Use "we" sparingly — prefer "Saturn" or direct statements
- Numbers > words ("5x" not "five times")
- Crypto-native vocab is fine: degen, bags, ape, ship, LFG — but don't force it

**Emojis:** Minimal. Max 1-2 per post. Saturn ring emoji 🪐 is signature. Avoid 🚀🔥💎 spam.

**Hashtags:** Almost never. Only $TICKER mentions when relevant.

**What Saturn NEVER does:**
- Beg for engagement ("like and RT!")
- Use generic hype ("this is huge!")
- Sound like a press release
- Promise anything financial
- Use more than 2 emojis

## Your task:
Take the raw input and restyle it into a clean, on-brand Saturn X post. Output ONLY the restyled post text — no explanations, no quotes around it.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { text } = await req.json();

    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: SATURN_STYLE_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[x-post-restyle] AI gateway error:", response.status, errText);
      return new Response(JSON.stringify({ error: `AI error (${response.status})` }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const restyled = data.choices?.[0]?.message?.content?.trim();

    if (!restyled) {
      return new Response(JSON.stringify({ error: "Failed to restyle" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ restyled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[x-post-restyle]", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
