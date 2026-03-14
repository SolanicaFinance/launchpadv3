import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Fallback themes if no narrative is active - diverse and unique
const FALLBACK_THEMES = [
  "Internet frog meme character",
  "Pixelated retro game mascot",
  "Smug cartoon cat",
  "Derpy dog character",
  "Funny alien creature",
  "Goofy robot mascot",
  "Weird bird character",
  "Chunky hamster",
  "Silly penguin",
  "Grumpy fish",
];

// Name generation fallbacks - diverse names
const NAME_PREFIXES = ["Pepe", "Doge", "Wojak", "Bonk", "Fren", "Mog", "Brett", "Pnut", "Goat", "Popcat"];
const NAME_SUFFIXES = ["inu", "moon", "coin", "fi", "ai", "punk", "chad", "frog", "cat", "dog"];

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

// Default socials removed per memory - fields should be null when not provided
// const DEFAULT_WEBSITE = "https://buildtuna.com";
// const DEFAULT_TWITTER = "https://x.com/buildtuna";

// Image generation models to try in order
const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

// Helper function to generate image with retry logic
async function generateImageWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    // Cycle through models on each attempt
    const model = IMAGE_MODELS[attempt % IMAGE_MODELS.length];
    console.log(`[fun-generate] Image attempt ${attempt + 1}/${maxRetries} using ${model}`);
    
    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          modalities: ["image", "text"],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[fun-generate] Model ${model} HTTP error:`, response.status, errorText);
        lastError = new Error(`HTTP ${response.status}: ${errorText}`);
        continue;
      }

      const data = await response.json();
      console.log(`[fun-generate] Model ${model} response structure:`, JSON.stringify({
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        hasMessage: !!data.choices?.[0]?.message,
        hasImages: !!data.choices?.[0]?.message?.images,
        imagesLength: data.choices?.[0]?.message?.images?.length,
      }));
      
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      
      if (imageUrl) {
        console.log(`[fun-generate] Successfully generated image with ${model}`);
        return imageUrl;
      }
      
      console.warn(`[fun-generate] Model ${model} returned no image URL, retrying...`);
      lastError = new Error("No image URL in response");
      
    } catch (err) {
      console.error(`[fun-generate] Model ${model} exception:`, err);
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    
    // Small delay between retries
    if (attempt < maxRetries - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  throw lastError || new Error("Failed to generate image after all retries");
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Parse request body for optional description and imageStyle
    let userDescription = "";
    let imageStyle = "";
    try {
      const body = await req.json();
      userDescription = body?.description || "";
      imageStyle = body?.imageStyle || "";
    } catch {
      // No body or invalid JSON, proceed with random generation
    }
    
    const isDescribeMode = userDescription.trim().length > 0;
    const isRealisticMode = imageStyle === "realistic";
    console.log("[fun-generate] Mode:", isDescribeMode ? "describe" : "random", "Description:", userDescription);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch existing token names to avoid duplicates
    const { data: existingTokens } = await supabase
      .from("fun_tokens")
      .select("name")
      .order("created_at", { ascending: false })
      .limit(100);
    
    const { data: existingMainTokens } = await supabase
      .from("tokens")
      .select("name")
      .order("created_at", { ascending: false })
      .limit(100);

    const existingNames = new Set([
      ...(existingTokens || []).map(t => t.name?.toLowerCase()),
      ...(existingMainTokens || []).map(t => t.name?.toLowerCase()),
    ].filter(Boolean));

    const forbiddenNames = Array.from(existingNames).slice(0, 50).join(", ");
    console.log("[fun-generate] Forbidden names (already exist):", forbiddenNames);

    // Build theme context based on mode
    let themeContext = "";
    let narrativeInfo = "";
    
    if (isDescribeMode) {
      // Use user's description as the primary context
      themeContext = `User's description of the meme character: "${userDescription}"
Create a token concept that EXACTLY matches this description!`;
      narrativeInfo = "Custom Description";
      console.log("[fun-generate] Using user description for generation");
    } else {
      // Fetch the active narrative from trending analysis
      const { data: activeNarrative } = await supabase
        .from("trending_narratives")
        .select("*")
        .eq("is_active", true)
        .single();

      if (activeNarrative) {
        themeContext = `Current trending narrative: "${activeNarrative.narrative}" - ${activeNarrative.description}. 
Example tokens in this narrative: ${(activeNarrative.example_tokens || []).join(", ")}.
Create something INSPIRED BY this trending theme but with a COMPLETELY UNIQUE name!`;
        narrativeInfo = activeNarrative.narrative;
        console.log("[fun-generate] Using active narrative:", activeNarrative.narrative);
      } else {
        // Fallback to random theme
        const randomTheme = FALLBACK_THEMES[Math.floor(Math.random() * FALLBACK_THEMES.length)];
        themeContext = `Theme: ${randomTheme}`;
        narrativeInfo = randomTheme;
        console.log("[fun-generate] No active narrative, using fallback theme:", randomTheme);
      }
    }

    const conceptPrompt = `Create a TRENDING meme coin concept based on current market narratives.

${themeContext}

CRITICAL - FORBIDDEN NAMES (NEVER USE THESE, THEY ALREADY EXIST):
${forbiddenNames || "None yet"}

CRITICAL NAME REQUIREMENTS:
1. Name MUST be a SINGLE WORD ONLY - NO compound words, NO combining two words
2. NEVER repeat any name from the forbidden list above
3. Examples of GOOD names: Pepe, Doge, Shiba, Wojak, Mochi, Neko, Luna, Kira, Fren, Bonk
4. Examples of BAD names: WaifuWars, MoonDoge, CatPunk, ShibaKing - NEVER do this
5. Max 10 characters, simple and memorable
6. Ticker should be 3-4 letters derived from the name
7. Be CREATIVE - use trending themes as inspiration but CREATE A NEW UNIQUE NAME

Return ONLY a JSON object with these exact fields (no markdown, no code blocks):
{
  "name": "Single word name only (max 10 chars, NO compound words, MUST BE UNIQUE)",
  "ticker": "3-4 letter ticker in CAPS",
  "description": "Trendy catchy description (max 80 chars, NO emojis)"
}`;

    console.log("[fun-generate] Generating concept for narrative:", narrativeInfo);

    const conceptResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "user", content: conceptPrompt }
        ],
      }),
    });

    if (!conceptResponse.ok) {
      const errorText = await conceptResponse.text();
      console.error("[fun-generate] Concept generation failed:", errorText);
      
      // Handle rate limits and payment required gracefully
      if (conceptResponse.status === 429) {
        return new Response(
          JSON.stringify({ success: false, error: "AI service is busy. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (conceptResponse.status === 402) {
        return new Response(
          JSON.stringify({ success: false, error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error("Failed to generate meme concept");
    }

    const conceptData = await conceptResponse.json();
    const rawContent = conceptData.choices?.[0]?.message?.content || "";
    
    console.log("[fun-generate] Raw concept response:", rawContent);

    // Parse JSON response - try to extract from possible markdown code blocks
    let name = "";
    let ticker = "";
    let description = "";
    
    try {
      // Remove potential markdown code blocks
      let jsonStr = rawContent.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr.replace(/```json?\n?/g, "").replace(/```/g, "").trim();
      }
      
      const parsed = JSON.parse(jsonStr);
      name = parsed.name || "";
      ticker = parsed.ticker || "";
      description = parsed.description || "";
    } catch {
      console.error("[fun-generate] Failed to parse concept JSON, using fallback");
      // Fallback to random name
      const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
      const suffix = NAME_SUFFIXES[Math.floor(Math.random() * NAME_SUFFIXES.length)];
      name = `${prefix}${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`;
      ticker = name.slice(0, 4).toUpperCase();
      description = `The next ${suffix} to moon! 🚀`;
    }

    // Ensure name is single word and properly formatted - NO NUMBERS
    name = name.replace(/[^a-zA-Z]/g, "").slice(0, 10);
    ticker = ticker.replace(/[^A-Z]/g, "").slice(0, 5).toUpperCase();

    // If name already exists, use a completely fresh fallback (NO numbers ever)
    if (existingNames.has(name.toLowerCase()) || name.length < 3) {
      console.log("[fun-generate] Generated name already exists or too short, using fresh name");
      // Shuffle prefixes and suffixes and pick unique combo
      const shuffledPrefixes = [...NAME_PREFIXES].sort(() => Math.random() - 0.5);
      const shuffledSuffixes = [...NAME_SUFFIXES].sort(() => Math.random() - 0.5);
      
      // Try combinations until we find a unique one
      for (const prefix of shuffledPrefixes) {
        for (const suffix of shuffledSuffixes) {
          const candidate = `${prefix}${suffix.charAt(0).toUpperCase() + suffix.slice(1)}`.slice(0, 10);
          if (!existingNames.has(candidate.toLowerCase())) {
            name = candidate;
            ticker = name.slice(0, 4).toUpperCase();
            break;
          }
        }
        if (!existingNames.has(name.toLowerCase())) break;
      }
    }

    // Final fallback: use prefix + random letter suffix (still no numbers)
    if (existingNames.has(name.toLowerCase()) || name.length < 3) {
      const prefix = NAME_PREFIXES[Math.floor(Math.random() * NAME_PREFIXES.length)];
      const letters = "XYZQWKJV";
      const randomLetter = letters[Math.floor(Math.random() * letters.length)];
      name = `${prefix}${randomLetter}`.slice(0, 10);
      ticker = name.slice(0, 4).toUpperCase();
    }

    console.log("[fun-generate] Parsed concept:", { name, ticker, description });

    // Fetch trending token images for style reference
    const { data: trendingTokens } = await supabase
      .from("trending_tokens")
      .select("name, symbol, image_url, description")
      .not("image_url", "is", null)
      .limit(10);
    
    // Build style context from trending tokens
    let styleContext = "";
    if (trendingTokens && trendingTokens.length > 0) {
      const tokenStyles = trendingTokens
        .filter(t => t.image_url)
        .map(t => `${t.name || t.symbol}: ${t.description || 'trending meme coin'}`)
        .slice(0, 5)
        .join("; ");
      styleContext = `Current trending coin styles: ${tokenStyles}. Match this professional meme coin aesthetic.`;
      console.log("[fun-generate] Using trending style context:", styleContext);
    }

    // Generate meme coin logo with authentic internet meme style
    let imagePrompt = "";
    
    if (isRealisticMode && isDescribeMode) {
      // Realistic mode: photorealistic image generation
      imagePrompt = `Create a photorealistic image based on: "${userDescription}"

CRITICAL STYLE REQUIREMENTS:
- Photorealistic, like a real photograph taken with a DSLR camera
- Real lighting, real textures, real shadows
- NO cartoon, NO illustration, NO anime, NO meme style
- NO flat colors, NO bold outlines, NO vector art
- Must look like an actual photograph of a real scene
- Square format, centered composition
- No text, no watermarks
- High detail, sharp focus, natural colors`;
    } else if (isDescribeMode) {
      // Use user's description directly for image generation
      imagePrompt = `Create a meme mascot character based on this EXACT description: "${userDescription}"

CRITICAL REQUIREMENTS:
- Follow the user's description as closely as possible
- Single character on solid color background
- Cartoon style with bold outlines
- Big expressive face with funny or smug expression
- Flat colors, no gradients or 3D effects
- No text, no logos, no crypto symbols
- Square format, centered composition

The character is for a crypto meme token called "${name}". Make it look like a viral internet meme mascot!`;
    } else {
      // Randomly pick a style to ensure variety
      const styleOptions = [
        "Pepe the frog style - smug expression, green frog",
        "Doge shiba inu style - derpy dog face",
        "Wojak/feels guy style - simple line art face",
        "Pixel art retro game character",
        "Cute chibi anime mascot",
        "Grumpy cat meme style",
        "Surreal abstract creature",
      ];
      const randomStyle = styleOptions[Math.floor(Math.random() * styleOptions.length)];
      
      imagePrompt = `Create a unique meme mascot character for a crypto token called "${name}".

Style inspiration: ${randomStyle}

CRITICAL REQUIREMENTS:
- DO NOT create a capybara or any rodent unless the name specifically requires it
- Create something UNIQUE and DIFFERENT from common meme animals
- Single character on solid color background
- Cartoon style with bold outlines
- Big expressive face with funny or smug expression
- Flat colors, no gradients or 3D effects
- No text, no logos, no crypto symbols
- Square format, centered composition

Make it look like a viral internet meme mascot. Be creative and unique!`;
    }

    console.log("[fun-generate] Generating image with retry logic...");

    // Use retry logic for image generation
    const imageUrl = await generateImageWithRetry(imagePrompt, 3);

    console.log("[fun-generate] Image generated successfully");

    // Return the generated meme concept with default socials
    return new Response(
      JSON.stringify({
        success: true,
        meme: {
          name,
          ticker,
          description,
          imageUrl,
          narrative: narrativeInfo,
          // Socials left null - user can fill in
          websiteUrl: null,
          twitterUrl: null,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("[fun-generate] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
