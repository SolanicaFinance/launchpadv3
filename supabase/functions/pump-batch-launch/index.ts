// Batch launch tokens on pump.fun via PumpPortal API
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PUMPPORTAL_API_URL = "https://pumpportal.fun/api/trade";
const ADMIN_PASSWORD = "saturn135@";

function parseDeployerKeypair(privateKey: string): Keypair {
  try {
    if (privateKey.startsWith("[")) {
      return Keypair.fromSecretKey(new Uint8Array(JSON.parse(privateKey)));
    }
    return Keypair.fromSecretKey(bs58.decode(privateKey));
  } catch {
    throw new Error("Invalid PUMP_DEPLOYER_PRIVATE_KEY format");
  }
}

interface TokenConfig {
  name: string;
  ticker: string;
  description: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const {
      adminPassword,
      action,
      tokens,
      imageUrl,
      twitter,
      telegram,
      website,
      initialBuySol = 0.01,
    } = body;

    // Auth check
    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Info mode - return deployer wallet address
    if (action === "info") {
      const deployerPrivateKey = Deno.env.get("PUMP_DEPLOYER_PRIVATE_KEY");
      if (!deployerPrivateKey) throw new Error("PUMP_DEPLOYER_PRIVATE_KEY not configured");
      const deployerKeypair = parseDeployerKeypair(deployerPrivateKey);
      return new Response(JSON.stringify({ 
        deployerAddress: deployerKeypair.publicKey.toBase58(),
        pumpPortalKeyConfigured: !!Deno.env.get("PUMPPORTAL_API_KEY"),
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > 10) {
      throw new Error("Provide 1-10 tokens");
    }
    if (!imageUrl) throw new Error("Image URL is required");

    const pumpPortalApiKey = Deno.env.get("PUMPPORTAL_API_KEY");
    const deployerPrivateKey = Deno.env.get("PUMP_DEPLOYER_PRIVATE_KEY");
    if (!pumpPortalApiKey) throw new Error("PUMPPORTAL_API_KEY not configured");
    if (!deployerPrivateKey) throw new Error("PUMP_DEPLOYER_PRIVATE_KEY not configured");

    const deployerKeypair = parseDeployerKeypair(deployerPrivateKey);
    const deployerPublicKey = deployerKeypair.publicKey.toBase58();

    const results: Array<{
      index: number;
      name: string;
      ticker: string;
      status: "success" | "error";
      mintAddress?: string;
      signature?: string;
      pumpfunUrl?: string;
      error?: string;
    }> = [];

    // Fetch image once
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) throw new Error("Failed to fetch image from URL");
    const imageBytes = await imageResponse.arrayBuffer();

    for (let i = 0; i < tokens.length; i++) {
      const token: TokenConfig = tokens[i];
      const { name, ticker, description } = token;

      try {
        console.log(`[batch-launch] Launching ${i + 1}/${tokens.length}: ${name} ($${ticker})`);

        // 1. Upload to pump.fun IPFS
        const formData = new FormData();
        formData.append("file", new Blob([imageBytes], { type: "image/png" }), "image.png");
        formData.append("name", name);
        formData.append("symbol", ticker.toUpperCase());
        formData.append("description", description || `${name} token`);
        if (twitter) formData.append("twitter", twitter);
        if (website) formData.append("website", website);
        if (telegram) formData.append("telegram", telegram);
        formData.append("showName", "true");

        const ipfsRes = await fetch("https://pump.fun/api/ipfs", {
          method: "POST",
          body: formData,
        });

        if (!ipfsRes.ok) {
          throw new Error(`IPFS upload failed: ${ipfsRes.status}`);
        }

        const ipfsData = await ipfsRes.json();
        const metadataUri = ipfsData.metadataUri;
        if (!metadataUri) throw new Error("No metadata URI");

        // 2. Generate mint keypair
        const mintKeypair = Keypair.generate();
        const mintSecretBase58 = bs58.encode(mintKeypair.secretKey);
        const mintAddress = mintKeypair.publicKey.toBase58();

        // 3. Create via PumpPortal
        const createPayload = {
          publicKey: deployerPublicKey,
          action: "create",
          tokenMetadata: {
            name,
            symbol: ticker.toUpperCase(),
            uri: metadataUri,
          },
          mint: mintSecretBase58,
          denominatedInSol: "true",
          amount: initialBuySol,
          slippage: 10,
          priorityFee: 0.0005,
          pool: "pump",
        };

        const createRes = await fetch(`${PUMPPORTAL_API_URL}?api-key=${pumpPortalApiKey}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });

        if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error(`PumpPortal error: ${createRes.status} - ${errText}`);
        }

        const createResult = await createRes.json();

        results.push({
          index: i,
          name,
          ticker: ticker.toUpperCase(),
          status: "success",
          mintAddress,
          signature: createResult.signature,
          pumpfunUrl: `https://pump.fun/${mintAddress}`,
        });

        console.log(`[batch-launch] ✅ ${ticker}: ${mintAddress}`);

        // Small delay between launches
        if (i < tokens.length - 1) {
          await new Promise((r) => setTimeout(r, 2000));
        }
      } catch (err) {
        console.error(`[batch-launch] ❌ ${token.ticker}:`, err);
        results.push({
          index: i,
          name: token.name,
          ticker: token.ticker,
          status: "error",
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        deployerWallet: deployerPublicKey,
        total: tokens.length,
        success: results.filter((r) => r.status === "success").length,
        failed: results.filter((r) => r.status === "error").length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[batch-launch] Fatal error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
