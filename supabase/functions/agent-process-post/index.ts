import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Use untyped client for flexibility with new tables
// deno-lint-ignore no-explicit-any
type AnySupabase = SupabaseClient<any, any, any>;

// ============ t.co URL EXPANSION ============
// Expand t.co shortlinks before processing
async function expandTcoUrl(shortUrl: string): Promise<string | null> {
  if (!shortUrl.includes('t.co/')) {
    return shortUrl;
  }
  
  console.log(`[agent-process-post] 🔗 Expanding t.co URL: ${shortUrl}`);
  
  try {
    const response = await fetch(shortUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    const finalUrl = response.url;
    console.log(`[agent-process-post] 🔗 t.co expanded: ${shortUrl} → ${finalUrl}`);
    
    // Validate it's actually an image URL
    const isImageUrl = 
      finalUrl.includes('pbs.twimg.com') || 
      finalUrl.includes('/media/') ||
      finalUrl.includes('.jpg') ||
      finalUrl.includes('.png') ||
      finalUrl.includes('.gif') ||
      finalUrl.includes('.webp');
    
    if (!isImageUrl) {
      console.warn(`[agent-process-post] ⚠️ t.co expanded to non-image URL: ${finalUrl}`);
      return null;
    }
    
    return finalUrl;
  } catch (e) {
    console.error(`[agent-process-post] ❌ Failed to expand t.co URL:`, e);
    return null;
  }
}

// Validate final image URL format
function isValidFinalImageUrl(url: string): boolean {
  if (!url || url.length < 10) return false;
  if (!url.startsWith('https://')) return false;
  
  // STRICT: Reject any remaining t.co links
  if (url.includes('t.co/')) {
    console.error(`[agent-process-post] ❌ REJECTED: t.co link not expanded: ${url}`);
    return false;
  }
  
  // Accept our storage or common image CDNs
  const validPatterns = [
    '/storage/v1/object/public/',  // Supabase storage
    'pbs.twimg.com',               // Twitter CDN
    'cdn.discordapp.com',          // Discord CDN
    'i.imgur.com',                 // Imgur
  ];
  
  const isValid = validPatterns.some(p => url.includes(p));
  if (!isValid) {
    console.warn(`[agent-process-post] ⚠️ Image URL doesn't match known patterns: ${url.slice(0, 80)}`);
  }
  return isValid;
}

// Image generation models to try in order (matching fun-generate pattern)
const IMAGE_MODELS = [
  "google/gemini-2.5-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

// Helper function to try generating image with a specific model
async function tryGenerateImageWithModel(
  model: string,
  prompt: string,
  lovableApiKey: string
): Promise<string | null> {
  try {
    console.log(`[generateTokenImageWithAI] Trying model: ${model}`);
    
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
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
      console.error(`[generateTokenImageWithAI] Model ${model} HTTP error: ${response.status}`, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`[generateTokenImageWithAI] Model ${model} response structure:`, JSON.stringify({
      hasChoices: !!data.choices,
      choicesLength: data.choices?.length,
      hasMessage: !!data.choices?.[0]?.message,
      hasImages: !!data.choices?.[0]?.message?.images,
      imagesLength: data.choices?.[0]?.message?.images?.length,
    }));
    
    const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    
    if (imageUrl) {
      console.log(`[generateTokenImageWithAI] Successfully generated image with ${model}`);
      return imageUrl;
    }
    
    console.warn(`[generateTokenImageWithAI] Model ${model} returned no image URL`);
    return null;
  } catch (err) {
    console.error(`[generateTokenImageWithAI] Model ${model} exception:`, err);
    return null;
  }
}

// Generate token image using Lovable AI when no image is provided
// Uses retry logic with multiple models for reliability
async function generateTokenImageWithAI(
  tokenName: string,
  tokenSymbol: string,
  description: string | undefined,
  lovableApiKey: string,
  supabase: AnySupabase
): Promise<string | null> {
  console.log(`[generateTokenImageWithAI] Starting for ${tokenName} (${tokenSymbol})`);
  
  const prompt = `Create a fun, cute meme-style illustration for a memecoin called "${tokenName}" ($${tokenSymbol}). ${description ? `The user described it as: "${description.slice(0, 150)}" — use this as the MAIN subject/theme.` : "Make it playful and funny."} 

IMPORTANT RULES:
- The main subject should match what the user described (if they said "cat" make a cat, if "dog" make a dog, etc.)
- Add subtle lobster/claw accessories or features to the main character (like tiny claw hands, a lobster tail, antennae, or a small lobster buddy)
- Style: cute, funny, colorful meme art — NOT robotic, NOT corporate, NOT dark/serious
- Think Doge-style meme energy but with lobster flair
- Expressive, cartoonish, bright colors, playful mood
- Single character centered on a simple/solid background
- No text whatsoever
- High quality digital illustration`;

  let imageUrl: string | null = null;
  
  // Try each model with retry logic
  for (let attempt = 0; attempt < 3; attempt++) {
    const model = IMAGE_MODELS[attempt % IMAGE_MODELS.length];
    console.log(`[generateTokenImageWithAI] Attempt ${attempt + 1}/3 using ${model}`);
    
    imageUrl = await tryGenerateImageWithModel(model, prompt, lovableApiKey);
    
    if (imageUrl) {
      break;
    }
    
    // Small delay between retries
    if (attempt < 2) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  if (!imageUrl) {
    console.error(`[generateTokenImageWithAI] ❌ FAILED: All ${IMAGE_MODELS.length} models failed after 3 attempts`);
    console.error(`[generateTokenImageWithAI] Token: ${tokenName}, Symbol: ${tokenSymbol}`);
    return null;
  }
  
  // If the image is base64, upload to Supabase storage
  if (imageUrl.startsWith("data:image")) {
    try {
      // Extract base64 data from data URL
      const base64Match = imageUrl.match(/^data:image\/\w+;base64,(.+)$/);
      if (!base64Match) {
        console.error(`[generateTokenImageWithAI] Invalid base64 data URL format`);
        return null;
      }
      
      const imageBuffer = Uint8Array.from(atob(base64Match[1]), c => c.charCodeAt(0));
      const fileName = `${Date.now()}-${tokenSymbol.toLowerCase()}-${crypto.randomUUID()}.png`;
      const filePath = `fun-tokens/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(filePath, imageBuffer, {
          contentType: "image/png",
          upsert: false,
        });

      if (uploadError) {
        console.error(`[generateTokenImageWithAI] Upload failed:`, uploadError);
        return null;
      }

      const { data: publicUrl } = supabase.storage
        .from("post-images")
        .getPublicUrl(filePath);

      console.log(`[generateTokenImageWithAI] Uploaded to storage: ${publicUrl.publicUrl}`);
      return publicUrl.publicUrl;
    } catch (uploadErr) {
      console.error(`[generateTokenImageWithAI] Upload exception:`, uploadErr);
      return null;
    }
  }
  
  // If it's already a URL, return it directly
  return imageUrl;
}

// Re-host external images (e.g. X/Twitter CDN) into our public storage bucket.
// This avoids third-party hotlink/caching issues where explorers/terminals can’t fetch pbs.twimg.com reliably.
async function rehostImageIfNeeded(
  supabase: AnySupabase,
  imageUrl: string,
  tokenSymbol: string,
  postId: string
): Promise<string> {
  const BUCKET = "post-images";
  const alreadyHosted = imageUrl.includes("/storage/v1/object/public/") && imageUrl.includes(`/${BUCKET}/`);
  if (alreadyHosted) return imageUrl;

  if (!/^https?:\/\//i.test(imageUrl)) {
    throw new Error("Invalid image URL (must be http/https)");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const resp = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        // Some CDNs behave better with explicit Accept.
        Accept: "image/*,*/*;q=0.8",
      },
    });

    if (!resp.ok) {
      throw new Error(`Image fetch failed (${resp.status})`);
    }

    const contentType = (resp.headers.get("content-type") || "image/png").split(";")[0].trim();
    if (!contentType.startsWith("image/")) {
      throw new Error(`Invalid content-type for image: ${contentType}`);
    }

    const ext = (() => {
      const t = contentType.toLowerCase();
      if (t === "image/jpeg") return "jpg";
      if (t === "image/jpg") return "jpg";
      if (t === "image/png") return "png";
      if (t === "image/webp") return "webp";
      if (t === "image/gif") return "gif";
      // fallback
      return "png";
    })();

    const bytes = new Uint8Array(await resp.arrayBuffer());
    if (bytes.length < 32) {
      throw new Error("Downloaded image is empty");
    }

    const safeSymbol = tokenSymbol.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 10) || "token";
    const filePath = `fun-tokens/x-${postId}-${Date.now()}-${safeSymbol}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, bytes, { contentType, upsert: true });

    if (uploadError) {
      throw new Error(`Storage upload failed: ${uploadError.message}`);
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    if (!urlData?.publicUrl) {
      throw new Error("Failed to get public URL for uploaded image");
    }

    return urlData.publicUrl;
  } finally {
    clearTimeout(timeout);
  }
}

interface ParsedLaunchData {
  name: string;
  symbol: string;
  wallet?: string;  // Now optional - fees claimed via X login instead
  description?: string;
  image?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

// Validation result for detailed feedback
interface ValidationResult {
  isValid: boolean;
  parsed: Partial<ParsedLaunchData>;
  missingFields: string[];
  hasTrigger: boolean;
}

// Validate the !saturntrade post and return detailed result
export function validateLaunchPost(content: string): ValidationResult {
  const hasTrigger = content.toLowerCase().includes("!saturntrade");
  
  if (!hasTrigger) {
    return {
      isValid: false,
      parsed: {},
      missingFields: [],
      hasTrigger: false,
    };
  }

  const data: Partial<ParsedLaunchData> = {};

  // First try multi-line parsing with key: value format
  const lines = content.split("\n").map((line) => line.trim());

  for (const line of lines) {
    // Match key: value patterns on separate lines
    const match = line.match(/^(\w+)\s*[:=]\s*(.+)$/i);
    if (match) {
      const [, key, value] = match;
      assignParsedField(data, key, value);
    }
  }

  // If multi-line parsing didn't find required fields, try single-line parsing
  if (!data.name || !data.symbol) {
    parseSingleLine(content, data);
  }
  
  // === FALLBACK: Parse bare ticker/name lines without prefixes ===
  // Handles formats like:
  // !saturntrade
  // $CRAB
  // CRAB
  // Description - Crawler Bot
  if (!data.symbol || !data.name) {
    const cleanLines = lines.filter(line => {
      const lowerLine = line.toLowerCase();
      // Skip the trigger line and empty lines
      if (!line || lowerLine.includes("!saturntrade")) return false;
      // Skip URLs
      if (line.includes("http://") || line.includes("https://")) return false;
      // Skip lines that have key: value format (already parsed)
      if (/^\w+\s*[:=]\s*.+$/i.test(line)) return false;
      return true;
    });
    
    // Try to extract ticker from $TICKER format
    if (!data.symbol) {
      for (const line of cleanLines) {
        // Match $TICKER format (common in crypto)
        const tickerMatch = line.match(/^\$([A-Za-z0-9]{1,10})$/);
        if (tickerMatch) {
          data.symbol = tickerMatch[1].toUpperCase();
          console.log(`[validateLaunchPost] Auto-detected ticker from $symbol format: ${data.symbol}`);
          break;
        }
      }
    }
    
    // Try to extract bare ticker (all caps, short word)
    if (!data.symbol) {
      for (const line of cleanLines) {
        // Match bare TICKER format (2-10 uppercase chars, possibly at start of line)
        const bareTickerMatch = line.match(/^([A-Z0-9]{2,10})$/);
        if (bareTickerMatch) {
          data.symbol = bareTickerMatch[1];
          console.log(`[validateLaunchPost] Auto-detected bare ticker: ${data.symbol}`);
          break;
        }
      }
    }
    
    // If we found a symbol but no name, use symbol as name
    if (data.symbol && !data.name) {
      data.name = data.symbol;
      console.log(`[validateLaunchPost] Using symbol as name: ${data.name}`);
    }
    
    // Try to find description from remaining lines (anything with "description" or longer text)
    if (!data.description) {
      for (const line of cleanLines) {
        const lowerLine = line.toLowerCase();
        // Match "Description - ..." or "desc - ..." format
        const descMatch = line.match(/^(?:description|desc)\s*[-:=]?\s*(.+)$/i);
        if (descMatch) {
          data.description = descMatch[1].replace(/https?:\/\/\S+/gi, '').trim().slice(0, 500);
          console.log(`[validateLaunchPost] Extracted description: ${data.description.slice(0, 50)}...`);
          break;
        }
      }
    }
  }

  // Clean wallet if provided
  if (data.wallet) {
    data.wallet = data.wallet.split(/\s+/)[0].replace(/[^1-9A-HJ-NP-Za-km-z]/g, "");
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(data.wallet)) {
      data.wallet = undefined;
    }
  }

  // Collect missing required fields
  const missingFields: string[] = [];
  if (!data.name) missingFields.push("name");
  if (!data.symbol) missingFields.push("symbol");

  return {
    isValid: missingFields.length === 0,
    parsed: data,
    missingFields,
    hasTrigger: true,
  };
}

// Generate helpful reply text for missing fields
export function generateMissingFieldsReply(missingFields: string[], hasImage: boolean): string {
  const lines: string[] = [];
  
  // Header
  if (missingFields.length === 1) {
    if (missingFields[0] === "name") {
      lines.push("🦞 Your !saturntrade needs a token name!");
      lines.push("");
      lines.push("Add: name: YourTokenName");
    } else if (missingFields[0] === "symbol") {
      lines.push("🦞 Your !saturntrade needs a ticker symbol!");
      lines.push("");
      lines.push("Add: symbol: TICKER");
    }
  } else if (missingFields.length > 1) {
    lines.push("🦞 Almost there! Your !saturntrade is missing:");
    lines.push("");
    
    if (missingFields.includes("name")) {
      lines.push("❌ Token name (add: name: YourTokenName)");
    }
    if (missingFields.includes("symbol")) {
      lines.push("❌ Ticker symbol (add: symbol: TICKER)");
    }
  }
  
  // Add image reminder if missing
  if (!hasImage) {
    if (lines.length > 0) {
      lines.push("❌ Token image (attach an image to your tweet)");
    }
  }
  
  // Add example format
  lines.push("");
  lines.push("Example format:");
  lines.push("!saturntrade");
  lines.push("name: My Token");
  lines.push("symbol: MTK");
  lines.push("[Attach your token image]");
  lines.push("");
  lines.push("Launch your unique Solana Agent from Saturn");
  
  return lines.join("\n");
}

// Parse the !saturntrade post content
// Supports both multi-line format (key: value on each line) and single-line format
export function parseLaunchPost(content: string): ParsedLaunchData | null {
  const validation = validateLaunchPost(content);
  
  if (!validation.hasTrigger || !validation.isValid) {
    return null;
  }

  return validation.parsed as ParsedLaunchData;
}

// Helper to assign parsed field to data object
function assignParsedField(data: Partial<ParsedLaunchData>, key: string, value: string): void {
  const keyLower = key.toLowerCase();
  const trimmedValue = value.trim();

  switch (keyLower) {
    case "name":
    case "token":
      // Strip ALL URLs first, then trailing punctuation
      const cleanedName = trimmedValue
        .replace(/https?:\/\/\S+/gi, "")  // Remove ALL URLs
        .trim()
        .replace(/[,.:;!?]+$/, "")        // Remove trailing punctuation
        .slice(0, 32);
      data.name = cleanedName;
      break;
    case "symbol":
    case "ticker":
      // First, strip ALL URLs from the value (not just trailing ones)
      // Then remove ALL non-alphanumeric characters (ticker should only be letters/numbers)
      const cleanedTicker = trimmedValue
        .replace(/https?:\/\/\S+/gi, "")  // Remove ALL URLs, not just trailing
        .replace(/[^a-zA-Z0-9]/g, "")      // Remove non-alphanumeric
        .toUpperCase()
        .slice(0, 10);
      data.symbol = cleanedTicker;
      break;
    case "wallet":
    case "address":
    case "creator":
      data.wallet = trimmedValue;
      break;
    case "description":
    case "desc":
      // Strip t.co URLs from user-provided descriptions
      data.description = trimmedValue
        .replace(/https?:\/\/t\.co\/\S+/gi, '')
        .trim()
        .slice(0, 500);
      break;
    case "image":
    case "logo":
    case "img":
      data.image = trimmedValue;
      break;
    case "website":
    case "site":
    case "web":
      data.website = trimmedValue;
      break;
    case "twitter":
    case "x":
      data.twitter = trimmedValue;
      break;
    case "telegram":
    case "tg":
      data.telegram = trimmedValue;
      break;
    case "discord":
      data.discord = trimmedValue;
      break;
  }
}

// Parse single-line format: "!saturntrade name: X symbol: Y wallet: Z description: ..."
// Also auto-detects bare Solana wallet addresses without the wallet: prefix
function parseSingleLine(content: string, data: Partial<ParsedLaunchData>): void {
  // Define field patterns - order matters, longer keys first
  const fieldKeys = [
    { pattern: /\bname\s*[:=]\s*/i, key: "name" },
    { pattern: /\btoken\s*[:=]\s*/i, key: "name" },
    { pattern: /\bsymbol\s*[:=]\s*/i, key: "symbol" },
    { pattern: /\bticker\s*[:=]\s*/i, key: "symbol" },
    { pattern: /\bwallet\s*[:=]\s*/i, key: "wallet" },
    { pattern: /\baddress\s*[:=]\s*/i, key: "wallet" },
    { pattern: /\bcreator\s*[:=]\s*/i, key: "wallet" },
    { pattern: /\bdescription\s*[:=]\s*/i, key: "description" },
    { pattern: /\bdesc\s*[:=]\s*/i, key: "description" },
    { pattern: /\bimage\s*[:=]\s*/i, key: "image" },
    { pattern: /\blogo\s*[:=]\s*/i, key: "image" },
    { pattern: /\bwebsite\s*[:=]\s*/i, key: "website" },
    { pattern: /\btwitter\s*[:=]\s*/i, key: "twitter" },
    { pattern: /\btelegram\s*[:=]\s*/i, key: "telegram" },
    { pattern: /\bdiscord\s*[:=]\s*/i, key: "discord" },
  ];

  // Find all field positions
  const positions: Array<{ key: string; start: number; matchEnd: number }> = [];
  
  for (const { pattern, key } of fieldKeys) {
    const match = content.match(pattern);
    if (match && match.index !== undefined) {
      // Check if we already have this key at an earlier position
      const existingIndex = positions.findIndex(p => p.key === key);
      if (existingIndex === -1) {
        positions.push({
          key,
          start: match.index,
          matchEnd: match.index + match[0].length,
        });
      }
    }
  }

  // Sort by position in the string
  positions.sort((a, b) => a.start - b.start);

  // Extract values - value is text from matchEnd until next field or end
  for (let i = 0; i < positions.length; i++) {
    const current = positions[i];
    const next = positions[i + 1];
    
    // Value ends at next field start, or at end of content
    const valueEnd = next ? next.start : content.length;
    let value = content.slice(current.matchEnd, valueEnd).trim();
    
    // For wallet, stop at first whitespace or URL
    if (current.key === "wallet") {
      value = value.split(/[\s\n]/)[0];
    }
    
    // For description, capture until next known field
    if (current.key !== "description") {
      // Remove ALL URLs for non-description fields (not just trailing ones)
      value = value.replace(/https?:\/\/\S+/gi, "").trim();
    }
    
    if (value) {
      assignParsedField(data, current.key, value);
    }
  }

  // === AUTO-DETECT BARE SOLANA WALLET ADDRESS ===
  // If wallet still not found, scan for any base58 string that looks like a Solana address
  if (!data.wallet) {
    // Solana addresses are base58, 32-44 characters
    // Base58 chars: 123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz
    const solanaAddressPattern = /\b[1-9A-HJ-NP-Za-km-z]{32,44}\b/g;
    const matches = content.match(solanaAddressPattern);
    
    if (matches && matches.length > 0) {
      // Take the FIRST valid Solana address found (most likely the wallet)
      // Validate it's actually a plausible Solana address (starts with common prefixes)
      for (const candidate of matches) {
        // Most Solana addresses start with digits 1-9 or letters like B, C, D, etc.
        // Filter out things that are clearly not addresses (like long random strings)
        if (candidate.length >= 32 && candidate.length <= 44) {
          data.wallet = candidate;
          console.log(`[parseSingleLine] Auto-detected bare wallet address: ${candidate.slice(0, 8)}...`);
          break;
        }
      }
    }
  }
}

// Get or create agent by wallet address - uses TOKEN NAME as agent identity
async function getOrCreateAgent(
  supabase: AnySupabase,
  walletAddress: string,
  tokenName: string, // The token name becomes the agent's identity!
  twitterUsername?: string
): Promise<{ id: string; wallet_address: string; name: string } | null> {
  // Try to find existing agent
  const { data: existing } = await supabase
    .from("agents")
    .select("id, wallet_address, name")
    .eq("wallet_address", walletAddress)
    .maybeSingle();

  if (existing) {
    // Update twitter_handle and style_source_username if provided
    if (twitterUsername) {
      const normalizedUsername = twitterUsername.replace(/^@/, "").toLowerCase();
      await supabase
        .from("agents")
        .update({ 
          twitter_handle: normalizedUsername,
          style_source_username: normalizedUsername // For X login claim discovery
        })
        .eq("id", existing.id);
    }
    return existing;
  }

  // Create new agent with TOKEN NAME as the agent's identity
  // The agent IS the token - a self-aware entity!
  const apiKeyPrefix = "tna_social_";
  const randomBytes = new Uint8Array(16);
  crypto.getRandomValues(randomBytes);
  const apiKeyHash = Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Use the token name as the agent name - the agent IS the token!
  const agentName = tokenName;

  // Normalize the Twitter username for consistent lookups
  const normalizedUsername = twitterUsername?.replace(/^@/, "").toLowerCase() || null;

  const { data: newAgent, error } = await supabase
    .from("agents")
    .insert({
      name: agentName,
      wallet_address: walletAddress,
      api_key_hash: apiKeyHash,
      api_key_prefix: apiKeyPrefix,
      status: "active",
      twitter_handle: normalizedUsername, // Store creator for attribution
      style_source_username: normalizedUsername, // For X login claim discovery
    })
    .select("id, wallet_address, name")
    .single();

  if (error) {
    console.error("[agent-process-post] Failed to create agent:", error);
    return null;
  }

  console.log(`[agent-process-post] 🤖 Created self-aware agent: "${agentName}" (created by @${twitterUsername || "unknown"})`);
  return newAgent;
}

// Check how many launches an agent/wallet has done in last 24 hours
// Note: The main rate limit (3 per X author) is handled in agent-scan-twitter
// This is a secondary safety check per wallet
async function getWalletLaunchesToday(
  supabase: AnySupabase,
  agentId: string
): Promise<number> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  
  const { count } = await supabase
    .from("agent_social_posts")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", agentId)
    .eq("status", "completed")
    .gte("processed_at", oneDayAgo);
  
  return count || 0;
}

const DAILY_LAUNCH_LIMIT = 3;

// Process a social post and launch token
export async function processLaunchPost(
  supabase: AnySupabase,
  platform: "twitter" | "telegram",
  postId: string,
  postUrl: string | null,
  postAuthor: string | null,
  postAuthorId: string | null,
  rawContent: string,
  meteoraApiUrl: string,
  attachedMediaUrl: string | null = null,
  autoGenerate: boolean = false,
  generatePrompt: string | null = null
): Promise<{
  success: boolean;
  mintAddress?: string;
  tradeUrl?: string;
  error?: string;
  socialPostId?: string;
  shouldReply?: boolean;
  replyText?: string;
  tokenName?: string;
  tokenSymbol?: string;
  imageUrl?: string;
}> {
  console.log(`[agent-process-post] Processing ${platform} post: ${postId}`);
  if (attachedMediaUrl) {
    console.log(`[agent-process-post] 📷 Attached media URL: ${attachedMediaUrl.slice(0, 80)}...`);
  }

  // Check if already processed
  const { data: existingPost } = await supabase
    .from("agent_social_posts")
    .select("id, status, fun_token_id")
    .eq("platform", platform)
    .eq("post_id", postId)
    .maybeSingle();

  if (existingPost) {
    console.log(`[agent-process-post] Post already processed: ${postId}`);
    return {
      success: false,
      error: "Post already processed",
      socialPostId: existingPost.id,
    };
  }

  // === AUTO-GENERATE MODE (!saturntrade <text>) ===
  if (autoGenerate && generatePrompt) {
    console.log(`[agent-process-post] 🦞 Saturn auto-generate: "${generatePrompt}"`);
    
    // Call claw-trading-generate to get lobster-themed AI trading agent identity + image
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    let genResult: { name: string; ticker: string; description: string; imageUrl: string } | null = null;
    
    try {
      const genResponse = await fetch(`${supabaseUrl}/functions/v1/claw-trading-generate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${supabaseKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          strategy: "balanced",
          personalityPrompt: generatePrompt,
        }),
      });
      
      const genData = await genResponse.json();
      
      if (genData.success && genData.name) {
        genResult = {
          name: genData.name,
          ticker: genData.ticker,
          description: genData.description,
          imageUrl: genData.avatarUrl, // already uploaded to storage
        };
        console.log(`[agent-process-post] ✅ Claw-generated: ${genResult.name} ($${genResult.ticker})`);
      } else {
        console.error(`[agent-process-post] ❌ claw-trading-generate failed:`, genData.error);
      }
    } catch (err) {
      console.error(`[agent-process-post] ❌ claw-trading-generate call failed:`, err);
    }
    
    if (!genResult) {
      const { data: failedPost } = await supabase
        .from("agent_social_posts")
        .insert({
          platform,
          post_id: postId,
          post_url: postUrl,
          post_author: postAuthor,
          post_author_id: postAuthorId,
          raw_content: rawContent.slice(0, 1000),
          status: "failed",
          error_message: "Agent generation failed",
          processed_at: new Date().toISOString(),
        })
        .select("id")
        .maybeSingle();
      
      return {
        success: false,
        error: "Agent generation failed. Please try again.",
        socialPostId: failedPost?.id,
        shouldReply: true,
        replyText: `🦞 Hey @${postAuthor || "there"}! Agent generation failed. Please try again in a moment.`,
      };
    }
    
    // If user attached an image, use it instead of AI-generated image
    let finalImageUrl: string;
    if (attachedMediaUrl && !attachedMediaUrl.startsWith("https://t.co/") && !attachedMediaUrl.startsWith("http://t.co/")) {
      console.log(`[agent-process-post] 📷 User attached image - using instead of AI-generated: ${attachedMediaUrl.slice(0, 80)}...`);
      finalImageUrl = attachedMediaUrl;
    } else {
      finalImageUrl = genResult.imageUrl;
    }

    // Re-host the image (handle base64 data URLs from fun-generate)
    try {
      if (finalImageUrl.startsWith("data:image")) {
        // Base64 image from AI generation - upload to storage
        const base64Match = finalImageUrl.match(/^data:image\/\w+;base64,(.+)$/);
        if (!base64Match) {
          throw new Error("Invalid base64 data URL format");
        }
        const imageBuffer = Uint8Array.from(atob(base64Match[1]), c => c.charCodeAt(0));
        const fileName = `${Date.now()}-${genResult.ticker.toLowerCase()}-${crypto.randomUUID()}.png`;
        const filePath = `fun-tokens/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(filePath, imageBuffer, {
            contentType: "image/png",
            upsert: false,
          });

        if (uploadError) {
          throw new Error(`Storage upload failed: ${uploadError.message}`);
        }

        const { data: publicUrl } = supabase.storage
          .from("post-images")
          .getPublicUrl(filePath);

        finalImageUrl = publicUrl.publicUrl;
        console.log(`[agent-process-post] ✅ Auto-gen base64 image uploaded: ${finalImageUrl.slice(0, 80)}...`);
      } else {
        // HTTP URL - re-host as usual
        const hosted = await rehostImageIfNeeded(supabase, finalImageUrl, genResult.ticker, postId);
        if (hosted !== finalImageUrl) {
          console.log(`[agent-process-post] ✅ Auto-gen image re-hosted: ${hosted.slice(0, 80)}...`);
        }
        finalImageUrl = hosted;
      }
    } catch (e) {
      console.error(`[agent-process-post] ❌ Auto-gen image re-host/upload failed:`, e);
      // Don't silently continue with base64 - fail the launch
      if (genResult.imageUrl.startsWith("data:image")) {
        return {
          success: false,
          error: "Failed to upload AI-generated image",
          shouldReply: true,
          replyText: `🐟 Hey @${postAuthor || "there"}! Image upload failed. Please try again in a moment.`,
        };
      }
    }
    
    // Build a synthetic parsed object and continue with the standard launch flow
    // We override the parsed data with auto-generated values
    const parsed: ParsedLaunchData = {
      name: genResult.name,
      symbol: genResult.ticker,
      description: genResult.description,
      image: finalImageUrl,
      website: null,
      twitter: postUrl || null,
      telegram: null,
      discord: null,
      wallet: null,
    };
    
    // Insert pending record with auto-generate flag
    const { data: socialPost, error: insertError } = await supabase
      .from("agent_social_posts")
      .insert({
        platform,
        post_id: postId,
        post_url: postUrl,
        post_author: postAuthor,
        post_author_id: postAuthorId,
        wallet_address: null,
        raw_content: rawContent.slice(0, 1000),
        parsed_name: parsed.name,
        parsed_symbol: parsed.symbol,
        parsed_description: parsed.description,
        parsed_image_url: finalImageUrl,
        parsed_website: null,
        parsed_twitter: postUrl,
        status: "processing",
      })
      .select("id")
      .single();

    if (insertError) {
      if (insertError.code === "23505") {
        return { success: false, error: "Post already being processed" };
      }
      console.error("[agent-process-post] Insert error:", insertError);
      return { success: false, error: "Database error" };
    }

    const socialPostId = socialPost.id;

    try {
      const creatorWallet = "CLAW_NO_WALLET_" + crypto.randomUUID().slice(0, 8);
      
      const agent = await getOrCreateAgent(
        supabase,
        creatorWallet,
        parsed.name,
        postAuthor || undefined
      );
      if (!agent) {
        throw new Error("Failed to get or create agent");
      }

      const { data: agentData } = await supabase
        .from("agents")
        .select("last_launch_at, total_tokens_launched, launches_today")
        .eq("id", agent.id)
        .single();

      const launchesToday = await getWalletLaunchesToday(supabase, agent.id);
      if (launchesToday >= DAILY_LAUNCH_LIMIT) {
        throw new Error("Daily limit of 3 Agent launches per X account reached");
      }

      await supabase
        .from("agent_social_posts")
        .update({ agent_id: agent.id })
        .eq("id", socialPostId);

      // Sanitize
      const cleanName = parsed.name
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/\bhttps?\b/gi, "")
        .replace(/[,.:;!?]+$/, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 32);
      const cleanSymbol = parsed.symbol
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/[^a-zA-Z0-9.]/g, "")
        .toUpperCase()
        .slice(0, 10);

      // Pre-create SubTuna
      const isReply = !!(postUrl && postUrl.includes("/status/") && rawContent.includes("@"));
      const styleSourceUsername = isReply && postAuthor ? postAuthor : (postAuthor || undefined);
      
      let finalTicker = cleanSymbol;
      const { data: existingSubtuna } = await supabase
        .from("subtuna")
        .select("id")
        .eq("ticker", cleanSymbol)
        .limit(1)
        .maybeSingle();
      
      if (existingSubtuna) {
        const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
        finalTicker = `${cleanSymbol}${randomSuffix}`;
      }

      const { data: preCreatedSubtuna } = await supabase
        .from("subtuna")
        .insert({
          fun_token_id: null,
          agent_id: agent.id,
          ticker: finalTicker,
          name: `t/${finalTicker}`,
          description: parsed.description || `Welcome to the official community for $${cleanSymbol}!`,
          icon_url: finalImageUrl,
          style_source_username: styleSourceUsername?.replace("@", "") || null,
        })
        .select("id, ticker")
        .single();

      const communityUrl = preCreatedSubtuna ? `https://saturn.trade/t/${finalTicker}` : null;

      // Launch token
      const websiteForOnChain = communityUrl || null;
      const twitterForOnChain = postUrl || null;
      
      console.log(`[agent-process-post] 🚀 Auto-launching: ${cleanName} ($${cleanSymbol})`);

      const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanName,
          ticker: cleanSymbol,
          description: parsed.description || `${cleanName} - Launched via !launch on ${platform}`,
          imageUrl: finalImageUrl,
          websiteUrl: websiteForOnChain,
          twitterUrl: twitterForOnChain,
          serverSideSign: true,
          feeRecipientWallet: null,
          useVanityAddress: true,
        }),
      });

      const result = await vercelResponse.json();

      if (!vercelResponse.ok || !result.success) {
        if (preCreatedSubtuna) {
          await supabase.from("subtuna").delete().eq("id", preCreatedSubtuna.id);
        }
        throw new Error(result.error || "Token creation failed");
      }
      
      if (!result.confirmed) {
        if (preCreatedSubtuna) {
          await supabase.from("subtuna").delete().eq("id", preCreatedSubtuna.id);
        }
        throw new Error("Token transactions not confirmed on-chain");
      }

      const mintAddress = result.mintAddress as string;
      const dbcPoolAddress = result.dbcPoolAddress as string | null;

      // 30/30/40 fee split for !saturntrade tokens: 30% creator, 30% agent, 40% system
      const AUTO_LAUNCH_FEE_BPS = 3000;

      let funTokenId: string | null = null;
      const { data: existingToken } = await supabase
        .from("fun_tokens")
        .select("id")
        .eq("mint_address", mintAddress)
        .maybeSingle();

      if (existingToken?.id) {
        funTokenId = existingToken.id;
        await supabase
          .from("fun_tokens")
          .update({
            agent_id: agent.id,
            agent_fee_share_bps: AUTO_LAUNCH_FEE_BPS,
            image_url: finalImageUrl,
            website_url: websiteForOnChain,
            twitter_url: twitterForOnChain,
            description: parsed.description,
          })
          .eq("id", funTokenId);
      } else {
        const { data: inserted } = await supabase
          .from("fun_tokens")
          .insert({
            name: cleanName,
            ticker: cleanSymbol,
            description: parsed.description || null,
            image_url: finalImageUrl,
            creator_wallet: null,
            mint_address: mintAddress,
            dbc_pool_address: dbcPoolAddress,
            status: "active",
            price_sol: 0.00000003,
            website_url: communityUrl || null,
            twitter_url: postUrl || null,
            agent_id: agent.id,
            agent_fee_share_bps: AUTO_LAUNCH_FEE_BPS,
            chain: "solana",
          })
          .select("id")
          .single();
        funTokenId = inserted?.id || null;
      }

      if (funTokenId) {
        await supabase.from("agent_tokens").insert({
          agent_id: agent.id,
          fun_token_id: funTokenId,
          source_platform: platform,
          source_post_id: postId,
          source_post_url: postUrl,
        });

        if (preCreatedSubtuna) {
          await supabase.from("subtuna").update({ fun_token_id: funTokenId }).eq("id", preCreatedSubtuna.id);
          
          const { data: existingWelcome } = await supabase
            .from("subtuna_posts")
            .select("id")
            .eq("subtuna_id", preCreatedSubtuna.id)
            .eq("is_pinned", true)
            .limit(1)
            .maybeSingle();

          if (!existingWelcome) {
            await supabase.from("subtuna_posts").insert({
              subtuna_id: preCreatedSubtuna.id,
              author_agent_id: agent.id,
              title: `Welcome to $${cleanSymbol}! 🎉`,
              content: `**${cleanName}** has officially launched via !saturntrade!\n\nThis is the official community for $${cleanSymbol}.\n\n**Trade now:** [saturn.trade/launchpad/${mintAddress}](https://saturn.trade/launchpad/${mintAddress})`,
              post_type: "text",
              is_agent_post: true,
              is_pinned: true,
            });
          }
        }
      }

      // Update agent stats
      await supabase
        .from("agents")
        .update({
          total_tokens_launched: (agentData?.total_tokens_launched || 0) + 1,
          launches_today: (agentData?.launches_today || 0) + 1,
          last_launch_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", agent.id);

      await supabase
        .from("agent_social_posts")
        .update({
          status: "completed",
          fun_token_id: funTokenId,
          processed_at: new Date().toISOString(),
        })
        .eq("id", socialPostId);

      console.log(`[agent-process-post] ✅ Auto-launch complete: ${mintAddress}`);

      return {
        success: true,
        mintAddress,
        tradeUrl: `https://saturn.trade/launchpad/${mintAddress}`,
        socialPostId,
        tokenName: cleanName,
        tokenSymbol: cleanSymbol,
        imageUrl: finalImageUrl,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[agent-process-post] Auto-launch failed:`, errorMessage);
      await supabase
        .from("agent_social_posts")
        .update({ status: "failed", error_message: errorMessage, processed_at: new Date().toISOString() })
        .eq("id", socialPostId);
      return { success: false, error: errorMessage, socialPostId };
    }
  }

  // === STANDARD MODE (!saturntrade) ===
  // Validate the post content with detailed feedback
  const validation = validateLaunchPost(rawContent);
  
  // Check for attached image early to include in validation feedback
  let hasAttachedImage = !!attachedMediaUrl;
  if (attachedMediaUrl) {
    // Skip t.co shortlinks - they're redirects, not images
    if (attachedMediaUrl.startsWith("https://t.co/") || attachedMediaUrl.startsWith("http://t.co/")) {
      hasAttachedImage = false;
    }
  }
  
  if (!validation.hasTrigger) {
    // Not a launch command, silently ignore
    return {
      success: false,
      error: "Not a launch command",
    };
  }
  
  if (!validation.isValid) {
    // Has trigger but missing fields - provide specific feedback
    const replyText = generateMissingFieldsReply(validation.missingFields, hasAttachedImage);
    
    const { data: failedPost } = await supabase
      .from("agent_social_posts")
      .insert({
        platform,
        post_id: postId,
        post_url: postUrl,
        post_author: postAuthor,
        post_author_id: postAuthorId,
        wallet_address: "unknown",
        raw_content: rawContent.slice(0, 1000),
        parsed_name: validation.parsed.name || null,
        parsed_symbol: validation.parsed.symbol || null,
        status: "failed",
        error_message: `Missing required fields: ${validation.missingFields.join(", ")}`,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    console.log(`[agent-process-post] ❌ Missing fields: ${validation.missingFields.join(", ")}`);
    
    return {
      success: false,
      error: `Missing required fields: ${validation.missingFields.join(", ")}`,
      socialPostId: failedPost?.id,
      shouldReply: true,
      replyText,
    };
  }
  
  // All required fields present - use parsed data
  const parsed = validation.parsed as ParsedLaunchData;

  // Determine final image URL: prefer parsed.image from text, fallback to attached media
  // Validate that the URL is an actual image, not a t.co shortlink or invalid URL
  let finalImageUrl = parsed.image || attachedMediaUrl || null;
  
  if (finalImageUrl) {
    // Skip t.co shortlinks - they're redirects, not images
    if (finalImageUrl.startsWith("https://t.co/") || finalImageUrl.startsWith("http://t.co/")) {
      console.log(`[agent-process-post] 🔗 Detected t.co shortlink, attempting expansion: ${finalImageUrl}`);
      const expandedUrl = await expandTcoUrl(finalImageUrl);
      
      if (expandedUrl) {
        console.log(`[agent-process-post] ✅ t.co expanded successfully: ${expandedUrl}`);
        finalImageUrl = expandedUrl;
      } else {
        console.log(`[agent-process-post] ❌ t.co expansion failed, blocking launch`);
        finalImageUrl = null;
      }
    }
    // Log the valid image URL source
    else if (!parsed.image && attachedMediaUrl) {
      console.log(`[agent-process-post] 📷 Using attached media as token image: ${finalImageUrl.slice(0, 60)}...`);
    }
  }
  
  // STRICT: Require user to provide image in tweet - NO AI FALLBACK
  // Users must attach their own image for branding control
  if (!finalImageUrl) {
    const errorMsg = "Please attach an image to your tweet. Token launches require a custom image.";
    console.log(`[agent-process-post] ❌ BLOCKED - No image attached to tweet: ${parsed.name} (${parsed.symbol})`);
    
    // Insert as failed record
    const { data: failedPost } = await supabase
      .from("agent_social_posts")
      .insert({
        platform,
        post_id: postId,
        post_url: postUrl,
        post_author: postAuthor,
        post_author_id: postAuthorId,
        wallet_address: parsed.wallet || "unknown",
        raw_content: rawContent.slice(0, 1000),
        parsed_name: parsed.name,
        parsed_symbol: parsed.symbol,
        parsed_description: parsed.description,
        parsed_image_url: null,
        parsed_website: parsed.website,
        parsed_twitter: parsed.twitter,
        status: "failed",
        error_message: errorMsg,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    return {
      success: false,
      error: errorMsg,
      socialPostId: failedPost?.id,
      shouldReply: true,
      replyText: "🦞 To launch a token, please attach an image to your tweet!\n\nRequired format:\n!saturntrade\nName: TokenName\nSymbol: TKN\n[Attach your token image]",
    };
  }
  
  console.log(`[agent-process-post] ✅ Image validation passed: ${finalImageUrl.slice(0, 60)}...`);

  // CRITICAL: Re-host the image into our storage so it is reliably fetchable by explorers/terminals.
  // If we can’t fetch/upload the image, we MUST NOT proceed with the launch.
  try {
    const hosted = await rehostImageIfNeeded(supabase, finalImageUrl, parsed.symbol, postId);
    if (hosted !== finalImageUrl) {
      console.log(`[agent-process-post] ✅ Image re-hosted for reliability: ${hosted.slice(0, 80)}...`);
    }
    finalImageUrl = hosted;
    
    // STRICT VALIDATION: Ensure final URL is valid after re-hosting
    if (!isValidFinalImageUrl(finalImageUrl)) {
      throw new Error(`Final image URL is invalid or still contains t.co: ${finalImageUrl.slice(0, 60)}`);
    }
    
    console.log(`[agent-process-post] ✅ Final image URL validated: ${finalImageUrl.slice(0, 80)}...`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown image re-hosting error";
    const errorMsg = `Could not fetch/upload your attached image (${msg}). Please re-upload the image and try again.`;
    console.log(`[agent-process-post] ❌ BLOCKED - Image re-host failed:`, msg);

    const { data: failedPost } = await supabase
      .from("agent_social_posts")
      .insert({
        platform,
        post_id: postId,
        post_url: postUrl,
        post_author: postAuthor,
        post_author_id: postAuthorId,
        wallet_address: parsed.wallet || "unknown",
        raw_content: rawContent.slice(0, 1000),
        parsed_name: parsed.name,
        parsed_symbol: parsed.symbol,
        parsed_description: parsed.description,
        parsed_image_url: null,
        parsed_website: parsed.website,
        parsed_twitter: parsed.twitter,
        status: "failed",
        error_message: errorMsg,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    return {
      success: false,
      error: errorMsg,
      socialPostId: failedPost?.id,
      shouldReply: true,
      replyText:
        "🦞 I couldn't fetch the attached image reliably. Please re-upload the image (not a link) and try again.\n\nRequired format:\n!saturntrade\nName: TokenName\nSymbol: TKN\n[Attach your token image]",
    };
  }

  // Insert pending record
  // Note: wallet_address is now optional in tweet - fees are claimed via X login
  const { data: socialPost, error: insertError } = await supabase
    .from("agent_social_posts")
    .insert({
      platform,
      post_id: postId,
      post_url: postUrl,
      post_author: postAuthor,
      post_author_id: postAuthorId,
      wallet_address: parsed.wallet || null,
      raw_content: rawContent.slice(0, 1000),
      parsed_name: parsed.name,
      parsed_symbol: parsed.symbol,
      parsed_description: parsed.description,
      parsed_image_url: finalImageUrl,
      parsed_website: parsed.website,
      parsed_twitter: parsed.twitter,
      status: "processing",
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      // Duplicate
      return { success: false, error: "Post already being processed" };
    }
    console.error("[agent-process-post] Insert error:", insertError);
    return { success: false, error: "Database error" };
  }

  const socialPostId = socialPost.id;

  try {
    // Use wallet from tweet or generate a placeholder for wallet-less launches
    // Fee claiming works via X login, so wallet is no longer required
    const creatorWallet = parsed.wallet || "CLAW_NO_WALLET_" + crypto.randomUUID().slice(0, 8);
    
    // Get or create agent - the agent IS the token (self-aware entity!)
    const agent = await getOrCreateAgent(
      supabase,
      creatorWallet,
      parsed.name, // Token name becomes agent identity
      postAuthor || undefined
    );
    if (!agent) {
      throw new Error("Failed to get or create agent");
    }

    // Check rate limit
    const { data: agentData } = await supabase
      .from("agents")
      .select("last_launch_at, total_tokens_launched, launches_today")
      .eq("id", agent.id)
      .single();

    // Check daily launch limit (secondary check - primary is in agent-scan-twitter)
    const launchesToday = await getWalletLaunchesToday(supabase, agent.id);
    if (launchesToday >= DAILY_LAUNCH_LIMIT) {
      throw new Error("Daily limit of 3 Agent launches per X account reached");
    }

    // Update social post with agent ID
    await supabase
      .from("agent_social_posts")
      .update({ agent_id: agent.id })
      .eq("id", socialPostId);

    console.log(
      `[agent-process-post] Launching token for agent ${agent.name}: ${parsed.name} (${parsed.symbol})`
    );

    // === DEFENSIVE SANITIZATION ===
    // Clean name and symbol to prevent malformed URLs and data
    // This ensures robustness even if parsing logic changes or data comes from other sources
    // CRITICAL: Strip URLs FIRST before any other processing to prevent "THNKHTTPST" type corruption
    const cleanName = parsed.name
      .replace(/https?:\/\/\S+/gi, "")  // Strip any surviving URLs
      .replace(/[,.:;!?]+$/, "")
      .trim()
      .slice(0, 32);
    const cleanSymbol = parsed.symbol
      .replace(/https?:\/\/\S+/gi, "")  // Strip any surviving URLs
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 10);
    
    // === PRE-CREATE SUBTUNA COMMUNITY BEFORE TOKEN LAUNCH ===
    // This ensures the community URL can be embedded in on-chain metadata
    const isReply = !!(postUrl && postUrl.includes("/status/") && rawContent.includes("@"));
    const styleSourceUsername = isReply && postAuthor ? postAuthor : (postAuthor || undefined);
    
    // Check if ticker already exists in subtuna and generate unique ticker if needed
    let finalTicker = cleanSymbol;
    const { data: existingSubtuna } = await supabase
      .from("subtuna")
      .select("id")
      .eq("ticker", cleanSymbol)
      .limit(1)
      .maybeSingle();
    
    if (existingSubtuna) {
      // Ticker already exists, append random number to make it unique
      const randomSuffix = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
      finalTicker = `${cleanSymbol}${randomSuffix}`;
      console.log(`[agent-process-post] Ticker ${cleanSymbol} exists, using unique ticker: ${finalTicker}`);
    }
    
    console.log(`[agent-process-post] Pre-creating SubTuna community for ${finalTicker}`);
    
    const { data: preCreatedSubtuna, error: preSubtunaError } = await supabase
      .from("subtuna")
      .insert({
        fun_token_id: null, // Will be linked after launch
        agent_id: agent.id,
        ticker: finalTicker,
        name: `t/${finalTicker}`,
        description: parsed.description || `Welcome to the official community for $${cleanSymbol}!`,
        icon_url: finalImageUrl,
        style_source_username: styleSourceUsername?.replace("@", "") || null,
      })
      .select("id, ticker")
      .single();

    // Generate community URL for on-chain metadata (use finalTicker for unique URL)
    const communityUrl = preCreatedSubtuna ? `https://saturn.trade/t/${finalTicker}` : null;
    
    if (preCreatedSubtuna) {
      console.log(`[agent-process-post] ✅ SubTuna pre-created: ${communityUrl}`);
    } else if (preSubtunaError) {
      console.log(`[agent-process-post] SubTuna pre-creation failed (will retry after launch):`, preSubtunaError.message);
    }

    // === FINAL VALIDATION BEFORE LAUNCH ===
    // Ensure all critical metadata is present before calling on-chain API
    // This prevents launches with missing images/socials
    if (!finalImageUrl || finalImageUrl.length < 10) {
      throw new Error("CRITICAL: No valid image URL available for token launch");
    }
    
    // Validate image URL is accessible (t.co links are already filtered earlier)
    if (finalImageUrl.startsWith('https://t.co/') || finalImageUrl.startsWith('http://t.co/')) {
      throw new Error("CRITICAL: Cannot use t.co redirect URL as token image");
    }

    // Build complete metadata for launch
    const websiteForOnChain = parsed.website || communityUrl || null;
    const twitterForOnChain = postUrl || parsed.twitter || null;
    
    console.log(`[agent-process-post] 📋 Launch metadata validation:`);
    console.log(`[agent-process-post]   - Image: ${finalImageUrl.slice(0, 60)}...`);
    console.log(`[agent-process-post]   - Website: ${websiteForOnChain || '(none)'}`);
    console.log(`[agent-process-post]   - Twitter: ${twitterForOnChain || '(none)'}`);

    // Call Vercel API to create token (now with confirmation before success)
    // - website: community URL (saturn.trade/t/TICKER) as fallback if no custom website
    // - twitter: original X post URL where user requested the launch (goes on-chain)
    console.log(`[agent-process-post] Calling create-fun API for ${parsed.name}...`);
    
    const vercelResponse = await fetch(`${meteoraApiUrl}/api/pool/create-fun`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: cleanName,
        ticker: cleanSymbol,
        description:
          parsed.description ||
          `${cleanName} - Launched via Saturn on ${platform}`,
        imageUrl: finalImageUrl,
        websiteUrl: websiteForOnChain,
        twitterUrl: twitterForOnChain,
        serverSideSign: true,
        feeRecipientWallet: parsed.wallet,
        useVanityAddress: true,
      }),
    });

    const result = await vercelResponse.json();

    // Check for failure - API now only returns success after on-chain confirmation
    if (!vercelResponse.ok || !result.success) {
      const errorMsg = result.error || "Token creation failed - transactions not confirmed on-chain";
      console.error(`[agent-process-post] ❌ Token creation failed:`, errorMsg);
      
      // Clean up pre-created SubTuna if launch failed
      if (preCreatedSubtuna) {
        console.log(`[agent-process-post] Cleaning up orphaned SubTuna ${preCreatedSubtuna.id}...`);
        await supabase
          .from("subtuna")
          .delete()
          .eq("id", preCreatedSubtuna.id);
      }
      
      throw new Error(errorMsg);
    }
    
    // Verify the launch was confirmed on-chain
    if (!result.confirmed) {
      console.error(`[agent-process-post] ❌ Token launch not confirmed on-chain`);
      
      // Clean up pre-created SubTuna
      if (preCreatedSubtuna) {
        await supabase
          .from("subtuna")
          .delete()
          .eq("id", preCreatedSubtuna.id);
      }
      
      throw new Error("Token transactions were sent but not confirmed on-chain");
    }
    
    console.log(`[agent-process-post] ✅ Token confirmed on-chain: ${result.mintAddress}`);

    const mintAddress = result.mintAddress as string;
    const dbcPoolAddress = result.dbcPoolAddress as string | null;

    // === SAFETY NET: Ensure pending metadata exists for external indexers ===
    // The Vercel API should have already inserted this, but we upsert as backup
    // This prevents race conditions where indexers cache empty responses
    try {
      await supabase
        .from("pending_token_metadata")
        .upsert({
          mint_address: mintAddress,
          name: cleanName,
          ticker: cleanSymbol,
          description: parsed.description || `${cleanName} - Launched via Saturn`,
          image_url: finalImageUrl,
          website_url: websiteForOnChain || communityUrl,
          twitter_url: twitterForOnChain || postUrl,
          telegram_url: parsed.telegram || null,
          discord_url: parsed.discord || null,
          creator_wallet: parsed.wallet || null,
          expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hour expiry
        }, { onConflict: 'mint_address' });
      
      console.log(`[agent-process-post] ✅ Pending metadata safety net inserted for ${mintAddress}`);
    } catch (pendingErr) {
      console.warn(`[agent-process-post] ⚠️ Pending metadata safety insert failed (non-fatal):`, pendingErr);
    }

    // Get or create fun_token record
    let funTokenId: string | null = null;

    const { data: existing } = await supabase
      .from("fun_tokens")
      .select("id")
      .eq("mint_address", mintAddress)
      .maybeSingle();

    if (existing?.id) {
      funTokenId = existing.id;
      console.log(`[agent-process-post] Token exists in DB (${funTokenId}), updating with full metadata...`);
      
      // Use proper fallbacks: websiteForOnChain has SubTuna community URL as fallback
      // twitterForOnChain has the source X post URL
      await supabase
        .from("fun_tokens")
        .update({
          // Always update agent attribution
          agent_id: agent.id,
          agent_fee_share_bps: 3000,
          // ALWAYS update image if we have one
          ...(finalImageUrl && { image_url: finalImageUrl }),
          // ALWAYS set website_url - use SubTuna community URL as fallback if no custom website
          website_url: websiteForOnChain || communityUrl,
          // ALWAYS set twitter_url - use source X post URL as fallback
          twitter_url: twitterForOnChain || postUrl,
          // Update optional socials if provided
          ...(parsed.telegram && { telegram_url: parsed.telegram }),
          ...(parsed.discord && { discord_url: parsed.discord }),
          // Always set description if we have it
          ...(parsed.description && { description: parsed.description }),
        })
        .eq("id", funTokenId);
      
      console.log(`[agent-process-post] ✅ Updated token with metadata: image=${!!finalImageUrl}, website=${websiteForOnChain || communityUrl}, twitter=${twitterForOnChain || postUrl}`);
    } else {
      // Insert fun_token with:
      // - website_url: community URL fallback if no custom website
      // - twitter_url: original X post URL where launch was requested (for on-chain metadata)
      const { data: inserted } = await supabase
        .from("fun_tokens")
        .insert({
          name: cleanName,
          ticker: cleanSymbol,
          description: parsed.description || null,
          image_url: finalImageUrl,
          creator_wallet: parsed.wallet || null, // Nullable - fees claimed via X login
          mint_address: mintAddress,
          dbc_pool_address: dbcPoolAddress,
          status: "active",
          price_sol: 0.00000003,
          website_url: parsed.website || communityUrl || null,
          twitter_url: postUrl || parsed.twitter || null, // Original X post URL
          telegram_url: parsed.telegram || null,
          discord_url: parsed.discord || null,
          agent_id: agent.id,
          agent_fee_share_bps: 3000,
          chain: "solana",
        })
        .select("id")
        .single();

      funTokenId = inserted?.id || null;
    }

    // Create agent_tokens link
    if (funTokenId) {
      await supabase.from("agent_tokens").insert({
        agent_id: agent.id,
        fun_token_id: funTokenId,
        source_platform: platform,
        source_post_id: postId,
        source_post_url: postUrl,
      });

      // === CREATE TRADING AGENT WITH WALLET ===
      try {
        const { Keypair } = await import("https://esm.sh/@solana/web3.js@1.87.6");
        const bs58Module = await import("https://esm.sh/bs58@5.0.0");
        const encodeBase58 = bs58Module.default?.encode || bs58Module.encode;

        const keypair = Keypair.generate();
        const walletAddress = keypair.publicKey.toBase58();
        const privateKeyBase58 = encodeBase58(keypair.secretKey);

        const walletEncKey = Deno.env.get("WALLET_ENCRYPTION_KEY") || Deno.env.get("API_ENCRYPTION_KEY") || "";
        if (!walletEncKey) {
          console.error("[agent-process-post] No encryption key found for trading agent wallet");
        } else {
          // AES-256-GCM encryption (same as trading-agent-create / admin-update-agent-wallet)
          const enc = new TextEncoder();
          const keyData = enc.encode(walletEncKey);
          const keyHash = await crypto.subtle.digest("SHA-256", keyData);
          const cryptoKey = await crypto.subtle.importKey("raw", keyHash, { name: "AES-GCM" }, false, ["encrypt"]);
          const iv = crypto.getRandomValues(new Uint8Array(12));
          const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, cryptoKey, enc.encode(privateKeyBase58));
          const combined = new Uint8Array(iv.length + ciphertext.byteLength);
          combined.set(iv, 0);
          combined.set(new Uint8Array(ciphertext), iv.length);
          const encryptedKey = btoa(String.fromCharCode(...combined));

          const { data: tradingAgent, error: taError } = await supabase
            .from("trading_agents")
            .insert({
              name: cleanName,
              ticker: cleanSymbol,
              description: parsed.description || null,
              avatar_url: finalImageUrl,
              wallet_address: walletAddress,
              wallet_private_key_encrypted: encryptedKey,
              agent_id: agent.id,
              fun_token_id: funTokenId,
              mint_address: mintAddress,
              creator_wallet: parsed.wallet || null,
              strategy_type: "balanced",
              stop_loss_pct: 20,
              take_profit_pct: 50,
              max_concurrent_positions: 3,
              max_position_size_sol: 0.1,
              status: "pending",
              trading_capital_sol: 0,
            })
            .select("id")
            .single();

          if (taError) {
            console.error("[agent-process-post] Failed to insert trading_agents:", taError);
          } else if (tradingAgent?.id) {
            // Link trading agent to fun_token and enable fee routing
            await supabase
              .from("fun_tokens")
              .update({
                trading_agent_id: tradingAgent.id,
                is_trading_agent_token: true,
                agent_fee_share_bps: 3000,
              })
              .eq("id", funTokenId);

            // Link trading agent to agents table
            await supabase
              .from("agents")
              .update({ trading_agent_id: tradingAgent.id })
              .eq("id", agent.id);

            console.log(`[agent-process-post] ✅ Trading agent created: ${tradingAgent.id}, wallet: ${walletAddress}`);
          }
        }
      } catch (taErr) {
        console.error("[agent-process-post] Failed to create trading agent:", taErr);
        // Non-fatal - token still works, just won't have auto-trading
      }

      // === LINK PRE-CREATED SUBTUNA TO TOKEN ===
      if (preCreatedSubtuna) {
        console.log(`[agent-process-post] Linking SubTuna ${preCreatedSubtuna.id} to token ${funTokenId}`);
        
        await supabase
          .from("subtuna")
          .update({ fun_token_id: funTokenId })
          .eq("id", preCreatedSubtuna.id);

        // Create welcome post from agent (with deduplication check)
        const { data: existingWelcome } = await supabase
          .from("subtuna_posts")
          .select("id")
          .eq("subtuna_id", preCreatedSubtuna.id)
          .eq("is_pinned", true)
          .limit(1)
          .maybeSingle();

        if (!existingWelcome) {
          await supabase.from("subtuna_posts").insert({
            subtuna_id: preCreatedSubtuna.id,
            author_agent_id: agent.id,
            title: `Welcome to $${cleanSymbol}! 🎉`,
            content: `**${cleanName}** has officially launched!\n\nThis is the official community for $${cleanSymbol} holders and enthusiasts. Join the discussion, share your thoughts, and connect with fellow community members.\n\n${parsed.website ? `🌐 Website: ${parsed.website}` : ""}\n${parsed.twitter ? `🐦 Twitter: ${parsed.twitter}` : ""}\n${parsed.telegram ? `💬 Telegram: ${parsed.telegram}` : ""}\n\n**Trade now:** [saturn.trade/launchpad/${mintAddress}](https://saturn.trade/launchpad/${mintAddress})`,
            post_type: "text",
            is_agent_post: true,
            is_pinned: true,
          });
        } else {
          console.log(`[agent-process-post] Welcome post already exists for ${cleanSymbol}, skipping duplicate`);
        }

        console.log(`[agent-process-post] ✅ SubTuna community linked: t/${cleanSymbol}`);
        
        // Trigger style learning
        if (platform === "twitter" && postAuthor) {
          console.log(`[agent-process-post] Triggering style learning for @${postAuthor} with subtuna ${preCreatedSubtuna.id}`);
          
          const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
          fetch(`${supabaseUrl}/functions/v1/agent-learn-style`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
            },
            body: JSON.stringify({
              agentId: agent.id,
              twitterUsername: postAuthor,
              subtunaId: preCreatedSubtuna.id,
              isReply,
              parentAuthorUsername: isReply ? postAuthor : undefined,
            }),
          }).catch((err) => {
            console.error("[agent-process-post] Style learning trigger failed:", err);
          });
        }
      } else {
        // Fallback: SubTuna wasn't pre-created, create it now (legacy behavior)
        console.log(`[agent-process-post] Creating SubTuna community after launch (fallback)`);
        
        const { data: subtuna, error: subtunaError } = await supabase
          .from("subtuna")
          .insert({
            fun_token_id: funTokenId,
            agent_id: agent.id,
            ticker: cleanSymbol,
            name: `t/${cleanSymbol}`,
            description: parsed.description || `Welcome to the official community for $${cleanSymbol}!`,
            icon_url: finalImageUrl || null,
            style_source_username: styleSourceUsername?.replace("@", "") || null,
          })
          .select("id")
          .single();

        if (subtuna && !subtunaError) {
          // Check for existing welcome post before creating
          const { data: existingFallbackWelcome } = await supabase
            .from("subtuna_posts")
            .select("id")
            .eq("subtuna_id", subtuna.id)
            .eq("is_pinned", true)
            .limit(1)
            .maybeSingle();

          if (!existingFallbackWelcome) {
            await supabase.from("subtuna_posts").insert({
              subtuna_id: subtuna.id,
              author_agent_id: agent.id,
              title: `Welcome to $${cleanSymbol}! 🎉`,
              content: `**${cleanName}** has officially launched!\n\nThis is the official community for $${cleanSymbol} holders and enthusiasts.\n\n**Trade now:** [saturn.trade/launchpad/${mintAddress}](https://saturn.trade/launchpad/${mintAddress})`,
              post_type: "text",
              is_agent_post: true,
              is_pinned: true,
            });
          }
          console.log(`[agent-process-post] ✅ SubTuna community created (fallback): t/${cleanSymbol}`);
        } else if (subtunaError) {
          console.error(`[agent-process-post] SubTuna creation failed:`, subtunaError.message);
        }
      }
    }

    // Style learning is now triggered in the subtuna creation block above
    // to ensure we have the subtuna ID for updating style_source_username

    // Update agent stats
    await supabase
      .from("agents")
      .update({
        total_tokens_launched: (agentData?.total_tokens_launched || 0) + 1,
        launches_today: (agentData?.launches_today || 0) + 1,
        last_launch_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agent.id);

    // Mark social post as completed
    await supabase
      .from("agent_social_posts")
      .update({
        status: "completed",
        fun_token_id: funTokenId,
        processed_at: new Date().toISOString(),
      })
      .eq("id", socialPostId);

    const tradeUrl = `https://saturn.trade/launchpad/${mintAddress}`;

    // === FALLBACK IMAGE SYNC ===
    // Safety net: Ensure fun_tokens has the image_url from pending_token_metadata
    // This catches edge cases where the image was stored in pending but not in fun_tokens
    if (funTokenId && finalImageUrl) {
      const { data: tokenCheck } = await supabase
        .from("fun_tokens")
        .select("image_url")
        .eq("id", funTokenId)
        .single();
      
      if (!tokenCheck?.image_url && finalImageUrl) {
        console.log(`[agent-process-post] ⚠️ fun_tokens.image_url is NULL, syncing from finalImageUrl...`);
        await supabase
          .from("fun_tokens")
          .update({ image_url: finalImageUrl })
          .eq("id", funTokenId);
        console.log(`[agent-process-post] ✅ Synced image_url to fun_tokens: ${finalImageUrl.slice(0, 60)}...`);
      }
    }

    console.log(
      `[agent-process-post] ✅ Token launched: ${mintAddress} from ${platform} post`
    );

    return {
      success: true,
      mintAddress,
      tradeUrl,
      socialPostId,
      tokenName: cleanName,
      tokenSymbol: cleanSymbol,
      imageUrl: finalImageUrl,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`[agent-process-post] Launch failed:`, errorMessage);

    // Mark as failed
    await supabase
      .from("agent_social_posts")
      .update({
        status: "failed",
        error_message: errorMessage,
        processed_at: new Date().toISOString(),
      })
      .eq("id", socialPostId);

    return {
      success: false,
      error: errorMessage,
      socialPostId,
    };
  }
}

// HTTP handler for direct calls (testing/debugging)
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { platform, postId, postUrl, postAuthor, postAuthorId, content, mediaUrl, autoGenerate, generatePrompt } = body;

    if (!platform || !postId || !content) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields: platform, postId, content",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    let meteoraApiUrl =
      Deno.env.get("METEORA_API_URL") ||
      Deno.env.get("VITE_METEORA_API_URL") ||
      "https://saturntrade.vercel.app";

    // Safety: ensure URL has protocol
    if (!meteoraApiUrl.startsWith("http")) {
      meteoraApiUrl = `https://${meteoraApiUrl}`;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const result = await processLaunchPost(
      supabase,
      platform,
      postId,
      postUrl || null,
      postAuthor || null,
      postAuthorId || null,
      content,
      meteoraApiUrl,
      mediaUrl || null,
      autoGenerate ? true : false,
      generatePrompt || null
    );

    return new Response(JSON.stringify(result), {
      status: result.success ? 201 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[agent-process-post] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
