import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_API_URL = "https://pumpportal.fun/api/trade";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

async function generateImageWithRetry(prompt: string, maxRetries = 3): Promise<string> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const model = IMAGE_MODELS[attempt % IMAGE_MODELS.length];
    console.log(`[meteorite-launch] Image attempt ${attempt + 1}/${maxRetries} using ${model}`);
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
        lastError = new Error(`HTTP ${response.status}`);
        continue;
      }
      const data = await response.json();
      const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      if (imageUrl) return imageUrl;
      lastError = new Error("No image URL in response");
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
    if (attempt < maxRetries - 1) await new Promise(r => setTimeout(r, 1000));
  }
  throw lastError || new Error("Failed to generate image");
}

async function generateTokenConcept(tweetContent: string): Promise<{ name: string; ticker: string; description: string }> {
  const prompt = `Based on this tweet, create a meme coin concept:
"${tweetContent}"

Create a token name and ticker INSPIRED by the tweet's content/topic. Be creative and memetic.

RULES:
- Name: single word, max 10 chars, catchy and memetic
- Ticker: 3-5 letters uppercase
- Description: max 80 chars, witty reference to the tweet

Return ONLY JSON (no markdown): {"name":"...","ticker":"...","description":"..."}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) throw new Error("Failed to generate concept");

  const data = await response.json();
  let raw = data.choices?.[0]?.message?.content || "";
  raw = raw.replace(/```json?\n?/g, "").replace(/```/g, "").trim();

  try {
    const parsed = JSON.parse(raw);
    return {
      name: (parsed.name || "Meteor").replace(/[^a-zA-Z]/g, "").slice(0, 10),
      ticker: (parsed.ticker || "METR").replace(/[^A-Z]/g, "").slice(0, 5),
      description: parsed.description || "Tokenized tweet on Meteorite",
    };
  } catch {
    return { name: "Meteor", ticker: "METR", description: "Tokenized tweet on Meteorite" };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tokenId } = await req.json();
    if (!tokenId) throw new Error("tokenId required");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const pumpPortalApiKey = Deno.env.get("PUMPPORTAL_API_KEY");
    if (!pumpPortalApiKey) throw new Error("PUMPPORTAL_API_KEY not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get token record with private key
    const { data: token, error } = await supabase
      .from("meteorite_tokens")
      .select("*")
      .eq("id", tokenId)
      .single();

    if (error || !token) throw new Error("Token not found");
    if (token.status === "live") {
      return new Response(
        JSON.stringify({ success: true, alreadyLive: true, mintAddress: token.mint_address, pumpfunUrl: token.pumpfun_url }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update status to generating_image
    await supabase.from("meteorite_tokens").update({ status: "generating_image", updated_at: new Date().toISOString() }).eq("id", tokenId);

    // Use tweet content (or URL) to generate concept
    const tweetContent = token.tweet_content || token.tweet_url;
    console.log(`[meteorite-launch] Generating concept from tweet: "${tweetContent}"`);

    const concept = await generateTokenConcept(tweetContent);
    console.log(`[meteorite-launch] Concept: ${concept.name} ($${concept.ticker})`);

    // Generate meme image based on tweet context
    const imagePrompt = `Create a meme mascot character inspired by this tweet: "${tweetContent}"

The character should visually represent the tweet's topic/sentiment.
- Single character on a solid color background
- Cartoon style with bold outlines, like a crypto meme token mascot
- Big expressive face, funny or smug expression
- Flat colors, no gradients or 3D effects
- No text, no logos
- Square format, centered composition
Make it look like a viral internet meme mascot for a token called "${concept.name}"!`;

    const imageDataUrl = await generateImageWithRetry(imagePrompt, 3);
    console.log("[meteorite-launch] Image generated successfully");

    // Convert data URL to blob for IPFS upload
    const base64Data = imageDataUrl.split(",")[1];
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

    // Update status to launching
    await supabase.from("meteorite_tokens").update({
      status: "launching",
      token_name: concept.name,
      token_ticker: concept.ticker,
      token_description: concept.description,
      image_url: imageDataUrl,
      tweet_content: tweetContent,
      updated_at: new Date().toISOString(),
    }).eq("id", tokenId);

    // Upload to pump.fun IPFS
    const formData = new FormData();
    formData.append("file", new Blob([imageBytes], { type: "image/png" }), "image.png");
    formData.append("name", concept.name);
    formData.append("symbol", concept.ticker);
    formData.append("description", concept.description);
    formData.append("twitter", token.tweet_url); // The monetized tweet URL as the X link
    formData.append("showName", "true");

    const ipfsRes = await fetch("https://pump.fun/api/ipfs", { method: "POST", body: formData });
    if (!ipfsRes.ok) throw new Error(`IPFS upload failed: ${ipfsRes.status}`);

    const ipfsData = await ipfsRes.json();
    const metadataUri = ipfsData.metadataUri;
    if (!metadataUri) throw new Error("No metadata URI from IPFS");

    console.log(`[meteorite-launch] IPFS metadata: ${metadataUri}`);

    // Generate mint keypair
    const mintKeypair = Keypair.generate();
    const mintSecretBase58 = bs58.encode(mintKeypair.secretKey);
    const mintAddress = mintKeypair.publicKey.toBase58();

    // Parse deployer from dev wallet
    const deployerKeypair = Keypair.fromSecretKey(bs58.decode(token.dev_wallet_private_key));
    const deployerPublicKey = deployerKeypair.publicKey.toBase58();

    // Create via PumpPortal - use the 0.1 SOL as initial dev buy
    const createPayload = {
      publicKey: deployerPublicKey,
      action: "create",
      tokenMetadata: {
        name: concept.name,
        symbol: concept.ticker,
        uri: metadataUri,
      },
      mint: mintSecretBase58,
      denominatedInSol: "true",
      amount: 0.08, // Use 0.08 SOL for buy (keep some for fees)
      slippage: 10,
      priorityFee: 0.0005,
      pool: "pump",
    };

    const createRes = await fetch(`${PUMPPORTAL_API_URL}?api-key=${pumpPortalApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload),
    });

    if (!createRes.ok) {
      const errText = await createRes.text();
      throw new Error(`PumpPortal error: ${createRes.status} - ${errText}`);
    }

    const createResult = await createRes.json();
    const pumpfunUrl = `https://pump.fun/${mintAddress}`;

    // Update token as live
    await supabase.from("meteorite_tokens").update({
      status: "live",
      mint_address: mintAddress,
      pumpfun_url: pumpfunUrl,
      updated_at: new Date().toISOString(),
    }).eq("id", tokenId);

    console.log(`[meteorite-launch] ✅ Token launched: ${concept.name} ($${concept.ticker}) - ${mintAddress}`);

    // Fire-and-forget: announce on the original tweet
    try {
      const announceUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/meteorite-tweet-announce`;
      fetch(announceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ tokenId }),
      }).catch(e => console.error("[meteorite-launch] Announce fire-and-forget error:", e));
    } catch (e) {
      console.error("[meteorite-launch] Failed to trigger announcement:", e);
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenName: concept.name,
        tokenTicker: concept.ticker,
        mintAddress,
        pumpfunUrl,
        signature: createResult.signature,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[meteorite-launch] Error:", e);

    // Try to mark as failed
    try {
      const { tokenId } = await req.clone().json().catch(() => ({ tokenId: null }));
      if (tokenId) {
        const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
        await supabase.from("meteorite_tokens").update({
          status: "failed",
          error_message: e instanceof Error ? e.message : String(e),
          updated_at: new Date().toISOString(),
        }).eq("id", tokenId);
      }
    } catch { /* ignore cleanup errors */ }

    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
