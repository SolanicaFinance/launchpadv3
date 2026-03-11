import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Fetch all unique tracked wallet addresses across ALL users and
 * PUT them to the Helius webhook so it monitors exactly that set.
 */
async function syncHeliusWebhook(supabase: ReturnType<typeof createClient>) {
  const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
  const webhookId = Deno.env.get("HELIUS_WEBHOOK_ID");

  if (!heliusApiKey || !webhookId) {
    console.warn("Helius sync skipped – HELIUS_API_KEY or HELIUS_WEBHOOK_ID not set");
    return;
  }

  // Gather every unique wallet address from the tracked_wallets table
  const { data: rows, error } = await supabase
    .from("tracked_wallets")
    .select("wallet_address");

  if (error) {
    console.error("Failed to fetch tracked wallets for Helius sync:", error.message);
    return;
  }

  const uniqueAddresses = [...new Set((rows || []).map((r: { wallet_address: string }) => r.wallet_address))];

  // If the list is empty, use a placeholder so the webhook stays valid
  const accountAddresses = uniqueAddresses.length > 0
    ? uniqueAddresses
    : ["11111111111111111111111111111111"];

  // Build webhook URL pointing to our receiver function
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const webhookURL = `${supabaseUrl}/functions/v1/wallet-trade-webhook`;
  const webhookSecret = Deno.env.get("HELIUS_WEBHOOK_SECRET") || "";

  try {
    const updateBody: Record<string, unknown> = {
      accountAddresses,
      webhookURL,
      webhookType: "enhanced",
      transactionTypes: ["ANY"],
    };
    if (webhookSecret) {
      updateBody.authHeader = webhookSecret;
    }

    const res = await fetch(
      `https://api.helius.xyz/v0/webhooks/${webhookId}?api-key=${heliusApiKey}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updateBody),
      },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error(`Helius webhook sync failed (${res.status}):`, body);
    } else {
      console.log(`Helius webhook synced with ${uniqueAddresses.length} address(es)`);
    }
  } catch (err) {
    console.error("Helius webhook sync error:", err);
  }
}

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

        // Ensure the profile exists so FK constraint is satisfied
        const { data: existing } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user_profile_id)
          .maybeSingle();

        if (!existing) {
          const uniqueSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
          const { error: profileErr } = await supabase.from("profiles").insert({
            id: user_profile_id,
            username: `trk_${uniqueSuffix}`,
            display_name: `Tracker`,
          });
          if (profileErr) {
            console.error("Failed to create profile for tracker:", profileErr);
            throw profileErr;
          }
        }

        const { data, error } = await supabase.from("tracked_wallets").insert({
          user_profile_id,
          wallet_address,
          wallet_label: wallet_label || null,
        }).select().single();

        if (error) throw error;

        // Sync addresses to Helius after adding
        await syncHeliusWebhook(supabase);

        // Trigger backfill of recent trades for this wallet
        try {
          const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
          const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
          const backfillRes = await fetch(`${supabaseUrl}/functions/v1/wallet-trade-backfill`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${serviceKey}`,
            },
            body: JSON.stringify({ wallet_address }),
          });
          const backfillResult = await backfillRes.json();
          console.log(`Backfill result for ${wallet_address.slice(0, 8)}…:`, JSON.stringify(backfillResult));
        } catch (bfErr) {
          console.error("Backfill trigger failed:", bfErr);
        }

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

        // Sync addresses to Helius after removing
        await syncHeliusWebhook(supabase);

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

        // Sync addresses to Helius after clearing
        await syncHeliusWebhook(supabase);

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

      case "sync-webhook": {
        await syncHeliusWebhook(supabase);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "backfill": {
        if (!wallet_address) {
          return new Response(JSON.stringify({ error: "Missing wallet_address" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
        const bfRes = await fetch(`${supabaseUrl}/functions/v1/wallet-trade-backfill`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${serviceKey}` },
          body: JSON.stringify({ wallet_address }),
        });
        const bfResult = await bfRes.json();
        return new Response(JSON.stringify(bfResult), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check-webhook": {
        const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
        const webhookId = Deno.env.get("HELIUS_WEBHOOK_ID");
        if (!heliusApiKey || !webhookId) {
          return new Response(JSON.stringify({ error: "Missing HELIUS_API_KEY or HELIUS_WEBHOOK_ID" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const whRes = await fetch(`https://api.helius.xyz/v0/webhooks/${webhookId}?api-key=${heliusApiKey}`);
        const whData = await whRes.json();
        return new Response(JSON.stringify({ 
          webhookType: whData.webhookType,
          accountAddressCount: whData.accountAddresses?.length,
          accountAddresses: whData.accountAddresses?.slice(0, 10),
          webhookURL: whData.webhookURL,
          transactionTypes: whData.transactionTypes,
        }), {
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
