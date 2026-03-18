import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Admin password — must match the one used in the admin panel
const ADMIN_PASSWORD = "saturn135@";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const body = await req.json();
    const { action, adminPassword, ...params } = body;

    // Verify admin password
    if (!adminPassword || adminPassword !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let result: any = null;

    switch (action) {
      case "list_accounts": {
        const { data, error } = await supabase
          .from("x_bot_accounts")
          .select("id, name, username, email, is_active, created_at, updated_at, subtuna_ticker, proxy_url, socks5_urls, current_socks5_index, last_socks5_failure_at")
          .order("created_at", { ascending: false });
        if (error) throw error;
        result = { accounts: data };
        break;
      }

      case "list_rules": {
        const { data, error } = await supabase
          .from("x_bot_account_rules")
          .select("*");
        if (error) throw error;
        result = { rules: data };
        break;
      }

      case "list_replies": {
        const { data, error } = await supabase
          .from("x_bot_account_replies")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params.limit || 100);
        if (error) throw error;
        result = { replies: data };
        break;
      }

      case "list_queue": {
        const { data, error } = await supabase
          .from("x_bot_account_queue")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params.limit || 50);
        if (error) throw error;
        result = { queue: data };
        break;
      }

      case "list_logs": {
        const { data, error } = await supabase
          .from("x_bot_account_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(params.limit || 200);
        if (error) throw error;
        result = { logs: data };
        break;
      }

      case "create_account": {
        const { account, rules } = params;

        // Auto-extract auth_token and ct0 from full cookie string
        let authTokenVal = account.auth_token_encrypted || null;
        let ct0Val = account.ct0_token_encrypted || null;
        if (account.full_cookie_encrypted) {
          const parts: Record<string, string> = {};
          for (const part of account.full_cookie_encrypted.split(";")) {
            const [k, ...rest] = part.trim().split("=");
            if (k && rest.length > 0) parts[k.trim()] = rest.join("=").replace(/^["']|["']$/g, "");
          }
          if (parts.auth_token) authTokenVal = parts.auth_token;
          if (parts.ct0) ct0Val = parts.ct0;
        }

        const { data: newAccount, error: accError } = await supabase
          .from("x_bot_accounts")
          .insert({
            name: account.name || "New Account",
            username: account.username || "",
            email: account.email || null,
            password_encrypted: account.password_encrypted || null,
            totp_secret_encrypted: account.totp_secret_encrypted || null,
            full_cookie_encrypted: account.full_cookie_encrypted || null,
            auth_token_encrypted: authTokenVal,
            ct0_token_encrypted: ct0Val,
            proxy_url: account.proxy_url || null,
            socks5_urls: account.socks5_urls || [],
            current_socks5_index: 0,
            is_active: account.is_active ?? true,
            subtuna_ticker: account.subtuna_ticker || null,
          })
          .select("id, name, username")
          .single();

        if (accError) throw accError;

        const { error: rulesError } = await supabase.from("x_bot_account_rules").insert({
          account_id: newAccount.id,
          monitored_mentions: rules?.monitored_mentions || [],
          tracked_cashtags: rules?.tracked_cashtags || [],
          min_follower_count: rules?.min_follower_count || 5000,
          require_blue_verified: rules?.require_blue_verified ?? true,
          require_gold_verified: rules?.require_gold_verified ?? false,
          author_cooldown_hours: rules?.author_cooldown_hours || 6,
          max_replies_per_thread: rules?.max_replies_per_thread || 3,
          enabled: rules?.enabled ?? true,
        });

        if (rulesError) throw rulesError;
        result = { account: newAccount };
        break;
      }

      case "update_account": {
        const { id, account, rules } = params;
        
        const updatePayload: Record<string, any> = {};
        const allowedFields = [
          "name", "username", "email", "password_encrypted", "totp_secret_encrypted",
          "full_cookie_encrypted", "auth_token_encrypted", "ct0_token_encrypted",
          "proxy_url", "socks5_urls", "is_active", "subtuna_ticker"
        ];
        // Sensitive fields: only include if a non-empty value is provided (skip empty strings/null to avoid overwriting existing data)
        const sensitiveFields = new Set([
          "password_encrypted", "totp_secret_encrypted",
          "full_cookie_encrypted", "auth_token_encrypted", "ct0_token_encrypted"
        ]);
        for (const field of allowedFields) {
          if (!(field in account)) continue;
          // For sensitive fields, skip if value is empty/null/undefined (don't overwrite existing)
          if (sensitiveFields.has(field) && !account[field]) continue;
          updatePayload[field] = account[field];
        }

        // If full_cookie_encrypted is being set, auto-extract auth_token and ct0
        if (updatePayload.full_cookie_encrypted) {
          const cookieStr = updatePayload.full_cookie_encrypted;
          const parts: Record<string, string> = {};
          for (const part of cookieStr.split(";")) {
            const [k, ...rest] = part.trim().split("=");
            if (k && rest.length > 0) parts[k.trim()] = rest.join("=").replace(/^["']|["']$/g, "");
          }
          if (parts.auth_token) updatePayload.auth_token_encrypted = parts.auth_token;
          if (parts.ct0) updatePayload.ct0_token_encrypted = parts.ct0;
        }

        if (Object.keys(updatePayload).length === 0) {
          result = { success: true, message: "No fields to update" };
          break;
        }

        const { error: accError } = await supabase
          .from("x_bot_accounts")
          .update(updatePayload)
          .eq("id", id);

        if (accError) throw accError;

        if (rules) {
          const rulesPayload: Record<string, any> = {};
          const rulesFields = [
            "monitored_mentions", "tracked_cashtags", "min_follower_count",
            "require_blue_verified", "require_gold_verified", "author_cooldown_hours",
            "max_replies_per_thread", "enabled", "persona_prompt", "tracked_keywords",
            "author_cooldown_minutes"
          ];
          for (const field of rulesFields) {
            if (field in rules) rulesPayload[field] = rules[field];
          }
          const { error: rulesError } = await supabase
            .from("x_bot_account_rules")
            .update(rulesPayload)
            .eq("account_id", id);
          if (rulesError) throw rulesError;
        }

        result = { success: true };
        break;
      }

      case "delete_account": {
        const { error } = await supabase.from("x_bot_accounts").delete().eq("id", params.id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      case "toggle_active": {
        const { error } = await supabase
          .from("x_bot_accounts")
          .update({ is_active: params.is_active })
          .eq("id", params.id);
        if (error) throw error;
        result = { success: true };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[x-bot-admin] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
