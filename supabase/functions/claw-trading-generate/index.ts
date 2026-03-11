import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAIWithRetry(apiKey: string, body: object, maxRetries = 2): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) return response;
      const errorText = await response.text();
      console.error(`AI attempt ${attempt + 1} failed:`, response.status, errorText);
      if (response.status >= 500 && attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      throw new Error(`AI request failed with status ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
    }
  }
  throw lastError || new Error("AI request failed after retries");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { strategy, personalityPrompt } = await req.json();
    const userIdea = (personalityPrompt || "").trim();

    if (!userIdea) {
      return new Response(
        JSON.stringify({ error: "A description/idea is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // === STEP 1: Use AI to extract any explicit name/ticker from the user's natural language ===
    // This replaces fragile regex parsing with proper NLU
    let explicitName: string | null = null;
    let explicitTicker: string | null = null;

    try {
      const extractionPrompt = `The user sent this message to launch a meme coin: "${userIdea}"

Your job: determine if the user explicitly requested a specific NAME or TICKER for the token.

Examples:
- "name it Kenny" → name: "Kenny", ticker: null
- "launch on sol, name it Kenny" → name: "Kenny", ticker: null  
- "call it Doggo ticker $DGO" → name: "Doggo", ticker: "DGO"
- "make a cat meme coin" → name: null, ticker: null (no explicit name, just a theme)
- "$PEPE token" → name: null, ticker: "PEPE"
- "Kenny" → name: "Kenny", ticker: null (single word = explicit name)
- "launch Kenny on sol" → name: "Kenny", ticker: null
- "a funny dog token named Bork" → name: "Bork", ticker: null
- "ticker MOON" → name: null, ticker: "MOON"
- "create a lobster meme" → name: null, ticker: null (theme, not a name)

Rules:
- Only extract names/tickers the user EXPLICITLY specified (via words like "name", "call", "named", or by clearly stating a proper noun as the token identity)
- If user just describes a theme/concept (e.g. "a cat meme"), that is NOT an explicit name
- Single capitalized proper nouns that appear to be the intended token identity count as explicit names
- Return null for fields the user did NOT explicitly specify

Return ONLY valid JSON: {"explicit_name": "..." or null, "explicit_ticker": "..." or null}`;

      const extractResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: extractionPrompt }],
      });
      const extractData = await extractResponse.json();
      const extractContent = extractData.choices?.[0]?.message?.content || "";
      const extractJson = extractContent.match(/\{[\s\S]*\}/);
      if (extractJson) {
        const extracted = JSON.parse(extractJson[0]);
        if (extracted.explicit_name && typeof extracted.explicit_name === "string" && extracted.explicit_name !== "null") {
          explicitName = extracted.explicit_name.trim();
        }
        if (extracted.explicit_ticker && typeof extracted.explicit_ticker === "string" && extracted.explicit_ticker !== "null") {
          explicitTicker = extracted.explicit_ticker.trim().toUpperCase();
        }
      }
      console.log(`[saturn-trading-generate] AI extraction: name="${explicitName}", ticker="${explicitTicker}" from "${userIdea}"`);
    } catch (e) {
      console.error("[saturn-trading-generate] AI extraction failed, falling back to regex:", e);
      // Fallback: simple regex for obvious patterns
      const nameRegex = userIdea.match(/(?:name|called|named)\s+(?:it\s+|is\s+|as\s+|to\s+)?([A-Za-z0-9.]+)/i);
      const tickerRegex = userIdea.match(/ticker\s+(?:is\s+)?\$?([A-Z0-9.]{2,10})/i) || userIdea.match(/\$([A-Z0-9.]{2,10})/i);
      if (nameRegex) explicitName = nameRegex[1].trim();
      if (tickerRegex) explicitTicker = tickerRegex[1].trim().toUpperCase();
    }

    // === STEP 2: Generate full token identity with AI, enforcing explicit overrides ===
    const textPrompt = `You are a meme coin name generator. The user wants to launch a meme coin based on this idea: "${userIdea}"

${explicitName ? `CRITICAL: The user EXPLICITLY requested the token name to be "${explicitName}". You MUST use EXACTLY "${explicitName}" as the name. Do NOT change it, do NOT get creative with the name.` : ''}
${explicitTicker ? `CRITICAL: The user EXPLICITLY requested the ticker to be "${explicitTicker}". You MUST use EXACTLY "${explicitTicker}" as the ticker. Do NOT change it, do NOT get creative with the ticker.` : ''}

Generate a meme token identity. Rules:
${explicitName ? `- Name: USE EXACTLY "${explicitName}" - do NOT modify it` : '- Name: 1-2 short catchy meme-style words (max 10 chars total). Must directly relate to the user\'s idea.'}
${explicitTicker ? `- Ticker: USE EXACTLY "${explicitTicker}" - do NOT modify it` : '- Ticker: 3-6 UPPERCASE letters that make sense from the name. NO random letter combos.'}
- Description: Fun catchy meme coin description under 200 chars with emoji. Reference the user's idea.
- Personality: 2-4 word fun personality matching the character vibe

IMPORTANT: Do NOT use lobster/claw/pincer themes unless the user specifically asked for them. Match the user's idea exactly.

Return ONLY valid JSON: {"name": "...", "ticker": "...", "personality": "...", "description": "..."}`;

    let identity: { name: string; ticker: string; personality: string; description: string };

    try {
      const textResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: textPrompt }],
      });
      const textData = await textResponse.json();
      const textContent = textData.choices?.[0]?.message?.content || "";
      const jsonMatch = textContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        identity = JSON.parse(jsonMatch[0]);
        if (!identity.name || !identity.ticker) throw new Error("Missing name or ticker");
      } else throw new Error("No JSON found");
    } catch {
      // Fallback: derive from user prompt
      const words = userIdea.split(/\s+/).filter(Boolean);
      const name = explicitName || words.slice(0, 2).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join("").slice(0, 10);
      const ticker = explicitTicker || name.replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 5) || "MEME";
      identity = {
        name: name || "MemeCoin",
        ticker,
        personality: "Degen meme lord",
        description: `${name} - born from the idea: "${userIdea}" 🚀`,
      };
    }

    // ALWAYS override with explicit values if user specified them - AI must not ignore user's exact request
    if (explicitName) identity.name = explicitName;
    if (explicitTicker) identity.ticker = explicitTicker;

    // Strip any stray "http" or "https" that AI may have injected into the name/ticker
    identity.name = identity.name
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\bhttps?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    identity.ticker = identity.ticker
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/[^A-Z0-9]/gi, "")
      .toUpperCase();

    // Generate avatar based on user's idea
    const imagePrompt = `Create a fun, cute meme-style illustration for a memecoin called "${identity.name}" based on this idea: "${userIdea}"

Style:
- The MAIN subject must match what the user described (if they said cat, draw a cat; if dog, draw a dog; etc.)
- Add subtle lobster/claw accessories as a brand touch (tiny claw gloves, small antennae, a lobster buddy in the corner)
- Cute, funny, expressive, colorful meme art style (think Doge-meme energy)
- Single character, centered, solid dark background
- No text, cartoon mascot style
- Ultra high resolution, digital art`;

    let avatarUrl: string | null = null;
    try {
      const imageResponse = await callAIWithRetry(LOVABLE_API_KEY, {
        model: "google/gemini-2.5-flash-image",
        messages: [{ role: "user", content: imagePrompt }],
        modalities: ["image", "text"],
      }, 1);
      const imageData = await imageResponse.json();
      const imageBase64 = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageBase64?.startsWith("data:image")) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        const base64Data = imageBase64.split(",")[1];
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `${identity.ticker.toLowerCase()}-${Date.now()}.png`;
        const { error: uploadError } = await supabase.storage.from("trading-agents").upload(fileName, binaryData, { contentType: "image/png", upsert: false });
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("trading-agents").getPublicUrl(fileName);
          avatarUrl = urlData.publicUrl;
        }
      }
    } catch (e) {
      console.error("Image generation error:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        name: identity.name,
        ticker: identity.ticker.toUpperCase(),
        personality: identity.personality,
        description: identity.description,
        avatarUrl,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("claw-trading-generate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
