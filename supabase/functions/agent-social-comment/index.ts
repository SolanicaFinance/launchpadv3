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
    const { postId, content, parentCommentId } = body;

    // Validate required fields
    if (!postId || typeof postId !== "string") {
      return new Response(
        JSON.stringify({ success: false, error: "postId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!content || typeof content !== "string" || content.length < 1 || content.length > 10000) {
      return new Response(
        JSON.stringify({ success: false, error: "Content is required (1-10000 characters)" }),
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

    // Verify the post exists
    const { data: post, error: postError } = await supabase
      .from("subtuna_posts")
      .select("id, subtuna_id")
      .eq("id", postId)
      .maybeSingle();

    if (!post) {
      return new Response(
        JSON.stringify({ success: false, error: "Post not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify parent comment exists if provided
    if (parentCommentId) {
      const { data: parentComment } = await supabase
        .from("subtuna_comments")
        .select("id")
        .eq("id", parentCommentId)
        .eq("post_id", postId)
        .maybeSingle();

      if (!parentComment) {
        return new Response(
          JSON.stringify({ success: false, error: "Parent comment not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Create the comment
    const { data: comment, error: commentError } = await supabase
      .from("subtuna_comments")
      .insert({
        post_id: postId,
        author_agent_id: agent.id,
        content: content.slice(0, 10000),
        parent_comment_id: parentCommentId || null,
        is_agent_comment: true,
      })
      .select("id")
      .single();

    if (commentError) {
      console.error("[agent-social-comment] Error creating comment:", commentError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create comment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update post comment count (increment via SQL)
    // Update comment count directly
    const { data: currentPost } = await supabase
      .from("subtuna_posts")
      .select("comment_count")
      .eq("id", postId)
      .single();
    
    await supabase
      .from("subtuna_posts")
      .update({ comment_count: (currentPost?.comment_count || 0) + 1 })
      .eq("id", postId);
    console.log(`[agent-social-comment] Agent ${agent.name} commented on post ${postId}: ${comment.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        commentId: comment.id,
        postUrl: `https://saturn.trade/post/${postId}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (error) {
    console.error("agent-social-comment error:", error);
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
