import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

// Verify API key - matches logic from api-launchpad
async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyApiKey(
  supabaseAdmin: any,
  apiKey: string
): Promise<{ valid: boolean; accountId?: string; walletAddress?: string }> {
  const hash = await hashApiKey(apiKey);

  const { data, error } = await supabaseAdmin
    .from("api_accounts")
    .select("id, wallet_address, status")
    .eq("api_key_hash", hash)
    .single();

  if (error || !data) {
    return { valid: false };
  }

  if (data.status !== "active") {
    return { valid: false };
  }

  return { valid: true, accountId: data.id, walletAddress: data.wallet_address };
}

// Vercel API helpers
const VERCEL_API = "https://api.vercel.com";

async function vercelRequest(
  endpoint: string,
  method: string,
  body?: any,
  token?: string
): Promise<any> {
  const vercelToken = token || Deno.env.get("VERCEL_API_TOKEN");
  if (!vercelToken) {
    throw new Error("VERCEL_API_TOKEN not configured");
  }

  const options: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${vercelToken}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${VERCEL_API}${endpoint}`, options);
  const data = await res.json();

  if (!res.ok) {
    console.error("Vercel API error:", data);
    throw new Error(data.error?.message || `Vercel API error: ${res.status}`);
  }

  return data;
}

// Create a Vercel project from template
async function createVercelProject(
  name: string,
  subdomain: string,
  designConfig: any
): Promise<{ projectId: string; deploymentUrl: string }> {
  // Create the project
  const project = await vercelRequest("/v9/projects", "POST", {
    name: `launchpad-${subdomain}`,
    framework: "vite",
    buildCommand: "npm run build",
    outputDirectory: "dist",
    installCommand: "npm install",
    environmentVariables: [
      { key: "VITE_LAUNCHPAD_NAME", value: name, target: ["production", "preview"] },
      { key: "VITE_DESIGN_CONFIG", value: JSON.stringify(designConfig), target: ["production", "preview"] },
      { key: "VITE_SUPABASE_URL", value: Deno.env.get("SUPABASE_URL") || "", target: ["production", "preview"] },
      { key: "VITE_SUPABASE_ANON_KEY", value: Deno.env.get("SUPABASE_ANON_KEY") || "", target: ["production", "preview"] },
    ],
  });

  return {
    projectId: project.id,
    deploymentUrl: `https://${project.name}.vercel.app`,
  };
}

// Add custom domain to Vercel project
async function addDomainToProject(
  projectId: string,
  domain: string
): Promise<void> {
  await vercelRequest(`/v10/projects/${projectId}/domains`, "POST", {
    name: domain,
  });
}

// Create a deployment for the project
async function createDeployment(
  projectId: string,
  gitUrl?: string
): Promise<{ deploymentId: string; url: string }> {
  // For now, we'll use a simple deployment trigger
  // In production, this would deploy from a template repo
  const deployment = await vercelRequest("/v13/deployments", "POST", {
    name: projectId,
    project: projectId,
    target: "production",
    // Deploy from the launchpad template repo
    gitSource: gitUrl
      ? {
          type: "github",
          repoId: gitUrl,
        }
      : undefined,
  });

  return {
    deploymentId: deployment.id,
    url: deployment.url,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { launchpadId, action, wallet } = await req.json();

    if (!launchpadId) {
      return new Response(
        JSON.stringify({ error: "launchpadId required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify wallet owns the launchpad (instead of requiring API key)
    const { data: launchpad, error: fetchError } = await supabaseAdmin
      .from("api_launchpads")
      .select("*, api_accounts(wallet_address)")
      .eq("id", launchpadId)
      .single();

    if (fetchError || !launchpad) {
      return new Response(
        JSON.stringify({ error: "Launchpad not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check wallet ownership
    const ownerWallet = (launchpad.api_accounts as any)?.wallet_address;
    if (wallet && ownerWallet !== wallet) {
      return new Response(
        JSON.stringify({ error: "Not authorized to manage this launchpad" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Handle different actions
    switch (action) {
      case "deploy": {
        // Create Vercel project
        const { projectId, deploymentUrl } = await createVercelProject(
          launchpad.name,
          launchpad.subdomain,
          launchpad.design_config
        );

        // Add custom subdomain
        const customDomain = `${launchpad.subdomain}.saturn.trade`;
        try {
          await addDomainToProject(projectId, customDomain);
        } catch (e) {
          console.error("Failed to add custom domain:", e);
          // Continue anyway - subdomain setup can be done later
        }

        // Update launchpad record
        await supabaseAdmin
          .from("api_launchpads")
          .update({
            vercel_project_id: projectId,
            vercel_deployment_url: deploymentUrl,
            status: "deploying",
            deployed_at: new Date().toISOString(),
          })
          .eq("id", launchpadId);

        return new Response(
          JSON.stringify({
            success: true,
            projectId,
            deploymentUrl,
            customDomain,
            status: "deploying",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "status": {
        // Get deployment status from Vercel
        if (!launchpad.vercel_project_id) {
          return new Response(
            JSON.stringify({ status: "not_deployed" }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const deployments = await vercelRequest(
          `/v6/deployments?projectId=${launchpad.vercel_project_id}&limit=1`,
          "GET"
        );

        const latestDeployment = deployments.deployments?.[0];
        const isReady = latestDeployment?.state === "READY";

        if (isReady && launchpad.status !== "live") {
          await supabaseAdmin
            .from("api_launchpads")
            .update({ status: "live" })
            .eq("id", launchpadId);
        }

        return new Response(
          JSON.stringify({
            status: isReady ? "live" : latestDeployment?.state?.toLowerCase() || "unknown",
            url: launchpad.vercel_deployment_url,
            customDomain: launchpad.custom_domain || `${launchpad.subdomain}.saturn.trade`,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "redeploy": {
        if (!launchpad.vercel_project_id) {
          return new Response(
            JSON.stringify({ error: "Project not deployed yet" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { deploymentId, url } = await createDeployment(launchpad.vercel_project_id);

        await supabaseAdmin
          .from("api_launchpads")
          .update({
            status: "deploying",
            deployed_at: new Date().toISOString(),
          })
          .eq("id", launchpadId);

        return new Response(
          JSON.stringify({
            success: true,
            deploymentId,
            url,
            status: "deploying",
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Invalid action. Use: deploy, status, redeploy" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error: unknown) {
    console.error("api-deploy error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
