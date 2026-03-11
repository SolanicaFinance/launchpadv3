import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CLOUDFLARE_API_TOKEN = Deno.env.get("CLOUDFLARE_API_TOKEN")!;
const CLOUDFLARE_ZONE_ID = Deno.env.get("CLOUDFLARE_ZONE_ID")!;
const API_ENCRYPTION_KEY = Deno.env.get("API_ENCRYPTION_KEY")!;

// Hash an API key for verification
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key + API_ENCRYPTION_KEY);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// Verify API key and return account
async function verifyApiKey(supabase: any, apiKey: string) {
  const hash = await hashApiKey(apiKey);
  const { data, error } = await supabase.rpc("verify_api_key", { p_api_key_hash: hash });
  if (error || !data || data.length === 0) return null;
  return data[0];
}

// Create Cloudflare DNS record for subdomain
async function createCloudflareSubdomain(subdomain: string): Promise<{ success: boolean; recordId?: string; error?: string }> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "CNAME",
          name: subdomain,
          content: "cname.vercel-dns.com",
          ttl: 1, // Auto
          proxied: true,
        }),
      }
    );

    const result = await response.json();
    
    if (!result.success) {
      console.error("Cloudflare error:", result.errors);
      return { success: false, error: result.errors?.[0]?.message || "Failed to create DNS record" };
    }

    return { success: true, recordId: result.result.id };
  } catch (error: any) {
    console.error("Cloudflare API error:", error);
    return { success: false, error: error?.message || "Unknown error" };
  }
}

// Delete Cloudflare DNS record
async function deleteCloudflareSubdomain(recordId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records/${recordId}`,
      {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${CLOUDFLARE_API_TOKEN}`,
        },
      }
    );
    const result = await response.json();
    return result.success;
  } catch (error) {
    console.error("Cloudflare delete error:", error);
    return false;
  }
}

// Validate subdomain format
function isValidSubdomain(subdomain: string): boolean {
  const regex = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;
  return regex.test(subdomain) && subdomain.length >= 3 && subdomain.length <= 63;
}

// Log API usage
async function logApiUsage(
  supabase: any,
  accountId: string,
  endpoint: string,
  method: string,
  statusCode: number,
  responseTimeMs: number
) {
  try {
    await supabase.from("api_usage_logs").insert({
      api_account_id: accountId,
      endpoint,
      method,
      status_code: statusCode,
      response_time_ms: responseTimeMs,
    });
  } catch (e) {
    console.error("Failed to log API usage:", e);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const url = new URL(req.url);

    // Get API key from header
    const apiKey = req.headers.get("x-api-key");
    
    // For some endpoints, we verify by wallet instead
    const walletAddress = url.searchParams.get("wallet");

    // POST: Create new launchpad
    if (req.method === "POST") {
      const body = await req.json();
      const { name, subdomain, designConfig, wallet } = body;

      if (!wallet && !apiKey) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get account by wallet or API key
      let accountId: string;
      if (apiKey) {
        const account = await verifyApiKey(supabase, apiKey);
        if (!account) {
          return new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = account.id;
      } else {
        const { data: accounts } = await supabase.rpc("get_api_account_by_wallet", { p_wallet_address: wallet });
        if (!accounts || accounts.length === 0) {
          return new Response(JSON.stringify({ error: "No API account found for wallet" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = accounts[0].id;
      }

      if (!name) {
        return new Response(JSON.stringify({ error: "name is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate subdomain if provided
      let cloudflareRecordId: string | null = null;
      if (subdomain) {
        if (!isValidSubdomain(subdomain)) {
          return new Response(JSON.stringify({ error: "Invalid subdomain format" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if subdomain is already taken
        const { data: existing } = await supabase
          .from("api_launchpads")
          .select("id")
          .eq("subdomain", subdomain)
          .single();

        if (existing) {
          return new Response(JSON.stringify({ error: "Subdomain already taken" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create Cloudflare DNS record
        const cfResult = await createCloudflareSubdomain(subdomain);
        if (!cfResult.success) {
          return new Response(JSON.stringify({ error: cfResult.error || "Failed to create subdomain" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        cloudflareRecordId = cfResult.recordId!;
      }

      // Create launchpad record
      const { data: launchpad, error: createError } = await supabase
        .from("api_launchpads")
        .insert({
          api_account_id: accountId,
          name,
          subdomain: subdomain || null,
          design_config: designConfig || {},
          cloudflare_record_id: cloudflareRecordId,
          status: subdomain ? "deploying" : "draft",
        })
        .select()
        .single();

      if (createError) {
        // Rollback Cloudflare record if DB insert fails
        if (cloudflareRecordId) {
          await deleteCloudflareSubdomain(cloudflareRecordId);
        }
        throw createError;
      }

      return new Response(JSON.stringify({
        success: true,
        launchpad,
        domain: subdomain ? `${subdomain}.saturn.trade` : null,
      }), {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GET: List launchpads for account
    if (req.method === "GET") {
      const launchpadId = url.searchParams.get("id");

      if (!walletAddress && !apiKey) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let accountId: string;
      if (apiKey) {
        const account = await verifyApiKey(supabase, apiKey);
        if (!account) {
          return new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = account.id;
      } else {
        const { data: accounts } = await supabase.rpc("get_api_account_by_wallet", { p_wallet_address: walletAddress });
        if (!accounts || accounts.length === 0) {
          return new Response(JSON.stringify({ launchpads: [] }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = accounts[0].id;
      }

      // Get specific launchpad or all
      if (launchpadId) {
        const { data, error } = await supabase
          .from("api_launchpads")
          .select("*")
          .eq("id", launchpadId)
          .eq("api_account_id", accountId)
          .single();

        if (error || !data) {
          return new Response(JSON.stringify({ error: "Launchpad not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ launchpad: data }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data, error } = await supabase
        .from("api_launchpads")
        .select("*")
        .eq("api_account_id", accountId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(JSON.stringify({ launchpads: data || [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // PUT: Update launchpad
    if (req.method === "PUT") {
      const body = await req.json();
      const { launchpadId, name, designConfig, subdomain, wallet } = body;

      if (!launchpadId) {
        return new Response(JSON.stringify({ error: "launchpadId is required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      let accountId: string;
      if (apiKey) {
        const account = await verifyApiKey(supabase, apiKey);
        if (!account) {
          return new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = account.id;
      } else if (wallet) {
        const { data: accounts } = await supabase.rpc("get_api_account_by_wallet", { p_wallet_address: wallet });
        if (!accounts || accounts.length === 0) {
          return new Response(JSON.stringify({ error: "No API account found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = accounts[0].id;
      } else {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Check ownership
      const { data: existing } = await supabase
        .from("api_launchpads")
        .select("*")
        .eq("id", launchpadId)
        .eq("api_account_id", accountId)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Launchpad not found or unauthorized" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Handle subdomain change
      let cloudflareRecordId = existing.cloudflare_record_id;
      if (subdomain && subdomain !== existing.subdomain) {
        if (!isValidSubdomain(subdomain)) {
          return new Response(JSON.stringify({ error: "Invalid subdomain format" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Check if new subdomain is taken
        const { data: subdomainCheck } = await supabase
          .from("api_launchpads")
          .select("id")
          .eq("subdomain", subdomain)
          .neq("id", launchpadId)
          .single();

        if (subdomainCheck) {
          return new Response(JSON.stringify({ error: "Subdomain already taken" }), {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Delete old Cloudflare record
        if (existing.cloudflare_record_id) {
          await deleteCloudflareSubdomain(existing.cloudflare_record_id);
        }

        // Create new Cloudflare record
        const cfResult = await createCloudflareSubdomain(subdomain);
        if (!cfResult.success) {
          return new Response(JSON.stringify({ error: cfResult.error || "Failed to create subdomain" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        cloudflareRecordId = cfResult.recordId!;
      }

      // Update launchpad
      const updateData: any = { updated_at: new Date().toISOString() };
      if (name) updateData.name = name;
      if (designConfig) updateData.design_config = designConfig;
      if (subdomain) {
        updateData.subdomain = subdomain;
        updateData.cloudflare_record_id = cloudflareRecordId;
      }

      const { data: updated, error: updateError } = await supabase
        .from("api_launchpads")
        .update(updateData)
        .eq("id", launchpadId)
        .select()
        .single();

      if (updateError) throw updateError;

      return new Response(JSON.stringify({
        success: true,
        launchpad: updated,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // DELETE: Delete launchpad
    if (req.method === "DELETE") {
      const launchpadId = url.searchParams.get("id");

      if (!launchpadId) {
        return new Response(JSON.stringify({ error: "id parameter required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify ownership
      let accountId: string;
      if (apiKey) {
        const account = await verifyApiKey(supabase, apiKey);
        if (!account) {
          return new Response(JSON.stringify({ error: "Invalid API key" }), {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = account.id;
      } else if (walletAddress) {
        const { data: accounts } = await supabase.rpc("get_api_account_by_wallet", { p_wallet_address: walletAddress });
        if (!accounts || accounts.length === 0) {
          return new Response(JSON.stringify({ error: "No API account found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        accountId = accounts[0].id;
      } else {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get launchpad to delete Cloudflare record
      const { data: existing } = await supabase
        .from("api_launchpads")
        .select("*")
        .eq("id", launchpadId)
        .eq("api_account_id", accountId)
        .single();

      if (!existing) {
        return new Response(JSON.stringify({ error: "Launchpad not found or unauthorized" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete Cloudflare record
      if (existing.cloudflare_record_id) {
        await deleteCloudflareSubdomain(existing.cloudflare_record_id);
      }

      // Delete launchpad
      const { error: deleteError } = await supabase
        .from("api_launchpads")
        .delete()
        .eq("id", launchpadId);

      if (deleteError) throw deleteError;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("API Launchpad error:", error);
    return new Response(JSON.stringify({ error: error?.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
