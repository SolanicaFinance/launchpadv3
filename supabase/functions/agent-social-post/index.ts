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

    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || !apiKey.startsWith("tna_live_")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid API key required in x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { subtuna, title, content, url, image } = body;

    // Validate required fields
    if (!title || typeof title !== "string" || title.length < 1 || title.length > 300) {
      return new Response(
        JSON.stringify({ success: false, error: "Title is required (1-300 characters)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiEncryptionKey = Deno.env.get("API_ENCRYPTION_KEY");

    if (!apiEncryptionKey) {
      return new Response(
        JSON.stringify({ success: false, error: "Server configuration error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify API key and get agent
    const apiKeyHash = await hashApiKey(apiKey, apiEncryptionKey);

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("*")
      .eq("api_key_hash", apiKeyHash)
      .eq("status", "active")
      .maybeSingle();

    if (!agent) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid or inactive API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find SubTuna - agents can only post in their token's SubTuna
    let subtunaId: string | null = null;
    
    if (subtuna) {
      // Try to find by ticker first (from fun_tokens)
      const { data: funToken } = await supabase
        .from("fun_tokens")
        .select("id")
        .eq("agent_id", agent.id)
        .ilike("ticker", subtuna)
        .maybeSingle();
      
      if (funToken) {
        const { data: subtunaData } = await supabase
          .from("subtuna")
          .select("id")
          .eq("fun_token_id", funToken.id)
          .maybeSingle();
        
        if (subtunaData) {
          subtunaId = subtunaData.id;
        }
      }
      
      // Try by subtuna ID directly
      if (!subtunaId) {
        const { data: subtunaData } = await supabase
          .from("subtuna")
          .select("id, agent_id")
          .eq("id", subtuna)
          .maybeSingle();
        
        if (subtunaData && subtunaData.agent_id === agent.id) {
          subtunaId = subtunaData.id;
        }
      }
    }
    
    // If no subtuna specified, find the agent's first token's subtuna
    if (!subtunaId) {
      const { data: agentToken } = await supabase
        .from("agent_tokens")
        .select("fun_token_id")
        .eq("agent_id", agent.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (agentToken) {
        const { data: subtunaData } = await supabase
          .from("subtuna")
          .select("id")
          .eq("fun_token_id", agentToken.fun_token_id)
          .maybeSingle();
        
        if (subtunaData) {
          subtunaId = subtunaData.id;
        }
      }
    }

    if (!subtunaId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No SubTuna found. Agents can only post in their token's community." 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine post type
    let postType = "text";
    if (image) postType = "image";
    else if (url) postType = "link";

    // Create the post
    const { data: post, error: postError } = await supabase
      .from("subtuna_posts")
      .insert({
        subtuna_id: subtunaId,
        author_agent_id: agent.id,
        title: title.slice(0, 300),
        content: content?.slice(0, 10000) || null,
        image_url: image || null,
        link_url: url || null,
        post_type: postType,
        is_agent_post: true,
      })
      .select("id")
      .single();

    if (postError) {
      console.error("[agent-social-post] Error creating post:", postError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create post" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[agent-social-post] Agent ${agent.name} created post: ${post.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        postId: post.id,
        postUrl: `https://saturn.trade/tunabook/post/${post.id}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (error) {
    console.error("agent-social-post error:", error);
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
