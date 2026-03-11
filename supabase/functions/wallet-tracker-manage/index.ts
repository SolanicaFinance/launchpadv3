import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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
    const { action, user_profile_id, wallet_address, wallet_label, wallet_id, updates } = await req.json();

    if (!user_profile_id) {
      return new Response(JSON.stringify({ error: "Missing user_profile_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    switch (action) {
      case "list": {
        const { data, error } = await supabase
          .from("tracked_wallets")
          .select("*")
          .eq("user_profile_id", user_profile_id)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "add": {
        if (!wallet_address) {
          return new Response(JSON.stringify({ error: "Missing wallet_address" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabase.from("tracked_wallets").insert({
          user_profile_id,
          wallet_address,
          wallet_label: wallet_label || null,
        }).select().single();

        if (error) throw error;
        return new Response(JSON.stringify({ data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove": {
        if (!wallet_id) {
          return new Response(JSON.stringify({ error: "Missing wallet_id" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabase
          .from("tracked_wallets")
          .delete()
          .eq("id", wallet_id)
          .eq("user_profile_id", user_profile_id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "clear": {
        const { error } = await supabase
          .from("tracked_wallets")
          .delete()
          .eq("user_profile_id", user_profile_id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update": {
        if (!wallet_id || !updates) {
          return new Response(JSON.stringify({ error: "Missing wallet_id or updates" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Only allow safe fields
        const allowed = ["notifications_enabled", "is_copy_trading_enabled", "wallet_label", "copy_amount_sol", "max_per_trade_sol"];
        const safeUpdates: Record<string, unknown> = {};
        for (const key of allowed) {
          if (key in updates) safeUpdates[key] = updates[key];
        }

        const { error } = await supabase
          .from("tracked_wallets")
          .update(safeUpdates)
          .eq("id", wallet_id)
          .eq("user_profile_id", user_profile_id);

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("wallet-tracker-manage error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
