import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const { username } = await req.json();
    if (!username || typeof username !== "string") {
      return new Response(JSON.stringify({ error: "username is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanUsername = username.replace(/^@/, "").trim().toLowerCase();
    if (!cleanUsername || cleanUsername.length > 30 || !/^[a-z0-9_]+$/.test(cleanUsername)) {
      return new Response(JSON.stringify({ error: "Invalid username format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("TWITTERAPI_IO_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Twitter API not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if already exists
    const { data: existing } = await supabase
      .from("kol_accounts")
      .select("id, username, is_active, profile_image_url, display_name, follower_count")
      .eq("username", cleanUsername)
      .maybeSingle();

    if (existing) {
      if (!existing.is_active) {
        // Reactivate
        await supabase.from("kol_accounts").update({ is_active: true }).eq("id", existing.id);
        return new Response(JSON.stringify({
          success: true,
          reactivated: true,
          kol: existing,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({
        error: "This KOL is already on the list",
        kol: existing,
      }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch Twitter profile to check follower count
    const profileRes = await fetch(
      `https://api.twitterapi.io/twitter/user/info?userName=${cleanUsername}`,
      { headers: { "X-API-Key": apiKey } }
    );

    if (!profileRes.ok) {
      const errText = await profileRes.text().catch(() => "");
      console.error("Twitter API error:", profileRes.status, errText);
      return new Response(JSON.stringify({ error: "Could not fetch Twitter profile. User may not exist." }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const profileData = await profileRes.json();
    const user = profileData?.data || profileData;

    const followerCount = parseInt(user?.followers || user?.followersCount || user?.followers_count || "0") || 0;
    const displayName = user?.name || user?.displayName || cleanUsername;
    const profileImageUrl = user?.profilePicture || user?.avatar || user?.profile_image_url_https || null;

    console.log(`@${cleanUsername}: ${followerCount} followers, name: ${displayName}`);

    if (followerCount < 50000) {
      return new Response(JSON.stringify({
        error: "This user is not eligible to be added to KOL list. Minimum 50,000 followers required.",
        follower_count: followerCount,
        display_name: displayName,
        profile_image_url: profileImageUrl,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Insert into kol_accounts
    const { data: newKol, error: insertErr } = await supabase
      .from("kol_accounts")
      .insert({
        username: cleanUsername,
        display_name: displayName,
        profile_image_url: profileImageUrl,
        is_active: true,
        follower_count: followerCount,
        source: "community",
      })
      .select("id, username, display_name, profile_image_url, follower_count, source, created_at")
      .single();

    if (insertErr) {
      console.error("Insert error:", insertErr);
      return new Response(JSON.stringify({ error: "Failed to add KOL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      kol: newKol,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("add-kol error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
