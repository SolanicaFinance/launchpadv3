import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SATURN_CONCEPTS = [
  { theme: "astronaut", description: "LOBSTER in a spacesuit floating among stars" },
  { theme: "cyberpunk", description: "Neon-lit LOBSTER with glowing claws and tech accessories" },
  { theme: "samurai", description: "LOBSTER wielding a katana in feudal Japan style" },
  { theme: "wizard", description: "LOBSTER with a magical staff and wizard hat" },
  { theme: "DJ", description: "LOBSTER at a DJ booth with headphones on antennae" },
  { theme: "pirate", description: "LOBSTER captain with eye patch and treasure" },
  { theme: "detective", description: "LOBSTER with magnifying glass and detective hat" },
  { theme: "superhero", description: "Caped LOBSTER flying through the city with glowing claws" },
  { theme: "chef", description: "LOBSTER in a chef hat cooking with its claws" },
  { theme: "gamer", description: "LOBSTER with VR headset and gaming setup" },
  { theme: "rockstar", description: "LOBSTER with electric guitar on stage" },
  { theme: "pharaoh", description: "Ancient Egyptian LOBSTER with golden shell accessories" },
  { theme: "ninja", description: "Stealthy LOBSTER with throwing stars in its claws" },
  { theme: "viking", description: "LOBSTER warrior with horned helmet and battle claws" },
  { theme: "scientist", description: "LOBSTER in lab coat with bubbling potions" },
];

const COLOR_PALETTES = [
  { primary: "#FF3333", secondary: "#FF6B6B" },
  { primary: "#CC0000", secondary: "#FF4444" },
  { primary: "#E84393", secondary: "#FD79A8" },
  { primary: "#D63031", secondary: "#E17055" },
  { primary: "#C0392B", secondary: "#E74C3C" },
  { primary: "#A93226", secondary: "#CD6155" },
  { primary: "#922B21", secondary: "#CB4335" },
  { primary: "#B71C1C", secondary: "#F44336" },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { prompt } = await req.json().catch(() => ({}));
    const randomConcept = SATURN_CONCEPTS[Math.floor(Math.random() * SATURN_CONCEPTS.length)];
    const randomPalette = COLOR_PALETTES[Math.floor(Math.random() * COLOR_PALETTES.length)];
    const themeToUse = prompt?.trim() || randomConcept.theme;
    const descriptionContext = prompt?.trim()
      ? `User's idea: "${prompt}"`
      : `Theme: ${randomConcept.theme} - ${randomConcept.description}`;

    console.log("[saturn-idea-generate] Generating concept:", themeToUse);

    const conceptPrompt = `Create a meme token concept based on a LOBSTER mascot (NOT tuna, NOT sushi).

${descriptionContext}

The LOBSTER mascot is a fierce but cute red lobster character with:
- Bright red shell with powerful claws
- Cute anime-style eyes with determined expression
- Strong posture showing dominance

Create a UNIQUE variation of this LOBSTER character for the given theme/idea.

Return ONLY a JSON object (no markdown):
{
  "name": "Creative single-word token name (max 10 chars)",
  "ticker": "3-4 letter ticker in CAPS",
  "description": "Catchy description with 🦞 emoji (max 80 chars)",
  "imagePrompt": "Detailed image prompt describing the LOBSTER mascot in the themed style",
  "tweetText": "Viral tweet announcing this token (include @Saturn mention, 🦞 emojis, max 280 chars)"
}`;

    const conceptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages: [{ role: "user", content: conceptPrompt }] }),
    });

    if (!conceptResponse.ok) throw new Error("Failed to generate concept");
    const conceptData = await conceptResponse.json();
    const rawContent = conceptData.choices?.[0]?.message?.content || "";

    let concept: any;
    try {
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith("```")) jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      concept = JSON.parse(jsonStr);
    } catch {
      concept = {
        name: "ClawMax",
        ticker: "CMAX",
        description: "The ultimate LOBSTER experience! 🦞🚀",
        imagePrompt: `Cute fierce lobster character as a ${themeToUse}`,
        tweetText: `Introducing $CMAX - The ultimate LOBSTER experience! 🦞🚀\n\nPowered by @Saturn\n\n#Solana #Memecoins`,
      };
    }

    console.log("[saturn-idea-generate] Concept generated:", concept.name);

    const imagePrompt = `Create a meme token logo featuring a fierce but cute LOBSTER mascot character.

The character MUST be based on this design:
- A bright red lobster with powerful oversized claws
- Cute anime-style eyes with fierce determined expression
- Red shell with detailed texture
- Strong dominant posture

Theme/Variation: ${concept.imagePrompt || themeToUse}
Background: Solid color gradient using ${randomPalette.primary} and ${randomPalette.secondary}

Style: Cartoon/anime style, clean vector-like illustration, lobster as main focus, square format, centered, NO text/letters, vibrant colors.`;

    const imageResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "google/gemini-2.5-flash-image", messages: [{ role: "user", content: imagePrompt }], modalities: ["image", "text"] }),
    });

    if (!imageResponse.ok) throw new Error("Failed to generate image");
    const imageData = await imageResponse.json();
    const imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!imageUrl) throw new Error("No image generated");

    return new Response(
      JSON.stringify({
        success: true,
        meme: {
          name: concept.name?.replace(/[^a-zA-Z]/g, "").slice(0, 10) || "ClawMax",
          ticker: concept.ticker?.replace(/[^A-Z]/g, "").slice(0, 5) || "CMAX",
          description: concept.description || "LOBSTER to the moon! 🦞🚀",
          imageUrl,
          tweetText: concept.tweetText || `Introducing $${concept.ticker} - ${concept.description}\n\nPowered by @Saturn 🦞`,
          theme: themeToUse,
          palette: randomPalette,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[saturn-idea-generate] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
