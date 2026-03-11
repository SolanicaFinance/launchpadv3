import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hash API key using HMAC-SHA256
async function hashApiKey(apiKey: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(apiKey);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  
  const signature = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Fetch image from URL and return as buffer
async function fetchImageFromUrl(url: string): Promise<{ buffer: Uint8Array; contentType: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  
  const contentType = response.headers.get("content-type") || "image/png";
  const arrayBuffer = await response.arrayBuffer();
  return { buffer: new Uint8Array(arrayBuffer), contentType };
}

// Detect content type from base64 header or default to png
function detectContentType(base64Data: string): string {
  if (base64Data.startsWith("data:image/jpeg")) return "image/jpeg";
  if (base64Data.startsWith("data:image/jpg")) return "image/jpeg";
  if (base64Data.startsWith("data:image/gif")) return "image/gif";
  if (base64Data.startsWith("data:image/webp")) return "image/webp";
  if (base64Data.startsWith("data:image/svg")) return "image/svg+xml";
  return "image/png";
}

// Get file extension from content type
function getExtension(contentType: string): string {
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return "jpg";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("svg")) return "svg";
  return "png";
}

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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Optional API key auth (for tracking)
    const apiKey = req.headers.get("x-api-key");
    let agentId: string | null = null;

    if (apiKey && apiKey.startsWith("tna_live_") && apiEncryptionKey) {
      const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);
      const { data: agent } = await supabase
        .from("agents")
        .select("id, name")
        .eq("api_key_hash", apiKeyHash)
        .eq("status", "active")
        .maybeSingle();
      
      if (agent) {
        agentId = agent.id;
        console.log(`[agent-upload] Agent authenticated: ${agent.name}`);
      }
    }

    const body = await req.json();
    const { image, name } = body;

    if (!image) {
      return new Response(
        JSON.stringify({ success: false, error: "Image is required (base64 data or URL)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let imageBuffer: Uint8Array;
    let contentType: string;
    const safeName = (name || "token").replace(/[^a-zA-Z0-9-_]/g, "").slice(0, 30);
    
    if (image.startsWith("data:image")) {
      // Base64 encoded image
      contentType = detectContentType(image);
      const base64Part = image.split(",")[1];
      if (!base64Part) {
        return new Response(
          JSON.stringify({ success: false, error: "Invalid base64 image data" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      imageBuffer = Uint8Array.from(atob(base64Part), c => c.charCodeAt(0));
    } else if (image.startsWith("http://") || image.startsWith("https://")) {
      // URL - fetch and re-host
      try {
        const fetched = await fetchImageFromUrl(image);
        imageBuffer = fetched.buffer;
        contentType = fetched.contentType;
      } catch (fetchError) {
        return new Response(
          JSON.stringify({ success: false, error: `Failed to fetch image from URL: ${fetchError}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      return new Response(
        JSON.stringify({ success: false, error: "Image must be base64 data or a valid URL" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check file size (max 5MB)
    if (imageBuffer.length > 5 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ success: false, error: "Image too large (max 5MB)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extension = getExtension(contentType);
    const fileName = `agent-tokens/${Date.now()}-${safeName}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("post-images")
      .upload(fileName, imageBuffer, { 
        contentType, 
        upsert: true,
        cacheControl: "31536000", // 1 year cache
      });

    if (uploadError) {
      console.error("[agent-upload] Upload failed:", uploadError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to upload image" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);

    console.log(`[agent-upload] ✅ Image uploaded: ${publicUrl}`, { agentId });

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        hint: 'Use the "url" value in your !saturntrade JSON as the "image" field',
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("agent-upload error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
