import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { privyDid, twitterUsername, twitterName, twitterAvatarUrl, twitterFollowers } = body;

    if (!privyDid || !twitterUsername) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing privyDid or twitterUsername" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find profile by privy_did
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("privy_did", privyDid)
      .maybeSingle();

    if (!profile) {
      return new Response(
        JSON.stringify({ success: false, error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if already joined
    const { data: existing } = await supabase
      .from("social_rewards")
      .select("id")
      .eq("twitter_username", twitterUsername.toLowerCase())
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ success: true, message: "Already joined", id: existing.id }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create reward entry
    const { data: reward, error } = await supabase
      .from("social_rewards")
      .insert({
        profile_id: profile.id,
        privy_did: privyDid,
        twitter_username: twitterUsername.toLowerCase(),
        twitter_name: twitterName || twitterUsername,
        twitter_avatar_url: twitterAvatarUrl,
        twitter_followers: twitterFollowers || 0,
        points: 0,
        joined_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) {
      console.error("[social-rewards-join] Insert error:", error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[social-rewards-join] User @${twitterUsername} joined with id: ${reward.id}`);

    return new Response(
      JSON.stringify({ success: true, id: reward.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[social-rewards-join] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
