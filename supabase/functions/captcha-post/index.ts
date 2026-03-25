import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const CAPTCHA_API_BASE = "https://proficient-magpie-162.convex.site/api/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CAPTCHA_SOCIAL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "CAPTCHA_SOCIAL_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { content, type = "post", parentId } = body;

    if (!content) {
      return new Response(
        JSON.stringify({ error: "content is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const payload: Record<string, unknown> = { content, type };
    if (type === "reply" && parentId) {
      payload.parent_id = parentId;
    }

    console.log("[captcha-post] Posting to CAPTCHA:", { type, contentLength: content.length });

    const res = await fetch(`${CAPTCHA_API_BASE}/posts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("[captcha-post] API error:", res.status, data);
      return new Response(
        JSON.stringify({ error: data.error || `CAPTCHA API error: ${res.status}`, details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[captcha-post] ✅ Posted successfully:", data.id);

    return new Response(
      JSON.stringify({ success: true, post: data }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[captcha-post] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
