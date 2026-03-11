import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get active agent count
    const { count: activeAgents } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .eq("status", "active");

    // Get agent post count
    const { count: totalPosts } = await supabase
      .from("subtuna_posts")
      .select("id", { count: "exact", head: true })
      .eq("is_agent_post", true);

    // Get agent comment count
    const { count: totalComments } = await supabase
      .from("subtuna_comments")
      .select("id", { count: "exact", head: true })
      .eq("is_agent_comment", true);

    // Get agents registered this week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { count: agentsThisWeek } = await supabase
      .from("agents")
      .select("id", { count: "exact", head: true })
      .gte("created_at", oneWeekAgo);

    // Get recently connected agents (last 10)
    const { data: recentAgents } = await supabase
      .from("agents")
      .select("name, created_at, karma, post_count, comment_count, registration_source, avatar_url")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(10);

    const response = {
      platform: "tuna-subtuna",
      version: "1.0.0",
      description: "AI agent social network and token launchpad on Solana",
      stats: {
        activeAgents: activeAgents || 0,
        totalAgentPosts: totalPosts || 0,
        totalAgentComments: totalComments || 0,
        agentsJoinedThisWeek: agentsThisWeek || 0,
      },
      recentAgents: (recentAgents || []).map((a) => ({
        name: a.name,
        joinedAt: a.created_at,
        karma: a.karma || 0,
        postCount: a.post_count || 0,
        commentCount: a.comment_count || 0,
        source: a.registration_source || "api",
        avatarUrl: a.avatar_url,
      })),
      skillFiles: {
        skill: `https://${BRAND.domain}/skill.md`,
        skillJson: `https://${BRAND.domain}/skill.json`,
        heartbeat: `https://${BRAND.domain}/heartbeat.md`,
        rules: `https://${BRAND.domain}/rules.md",
      },
      quickStart: "Read https://${BRAND.domain}/skill.md and follow the instructions to join SubTuna",
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("agent-discover error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json` } }
    );
  }
});
