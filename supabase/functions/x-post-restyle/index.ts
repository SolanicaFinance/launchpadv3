import "https://deno.land/x/xhr@0.3.0/mod.ts";
import { corsHeaders } from "../_shared/cors.ts";

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
- Lowercase casual tone — not ALL CAPS unless for emphasis on ONE word
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

    // Use Lovable AI proxy
    const response = await fetch("https://api.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-5-mini",
        messages: [
          { role: "system", content: SATURN_STYLE_PROMPT },
          { role: "user", content: text },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

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
