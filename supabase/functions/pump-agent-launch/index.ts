// PUMP Agent Launch - Creates tokens on pump.fun via PumpPortal API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// PumpPortal API for token creation
const PUMPPORTAL_API_URL = "https://pumpportal.fun/api/trade";

// Decrypt secret key from XOR-encrypted storage
function decryptSecretKey(encryptedHex: string, encryptionKey: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const encryptedBytes = hexToBytes(encryptedHex);
  
  const decrypted = new Uint8Array(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return decrypted;
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Try to get a pre-mined vanity keypair — prefer pnch suffix, fallback to claw
async function getVanityKeypair(supabase: any, encryptionKey: string): Promise<{ keypair: Keypair; publicKey: string; id: string } | null> {
  const suffixes = ['pnch', 'claw'];
  for (const suffix of suffixes) {
    try {
      const { data, error } = await supabase.rpc('backend_reserve_vanity_address', {
        p_suffix: suffix
      });
    
      if (error || !data || data.length === 0) {
        console.log(`[pump-agent-launch] No vanity address for suffix '${suffix}':`, error?.message || "empty result");
        continue;
      }
    
      const reserved = data[0];
      console.log(`[pump-agent-launch] Reserved vanity address (${suffix}):`, reserved.public_key);
    
      const secretKeyBytes = decryptSecretKey(reserved.secret_key_encrypted, encryptionKey);
      const keypair = Keypair.fromSecretKey(secretKeyBytes);
    
      const derivedPublicKey = keypair.publicKey.toBase58();
      if (derivedPublicKey !== reserved.public_key) {
        console.error(`[pump-agent-launch] Vanity keypair mismatch (${suffix})!`, { 
          expected: reserved.public_key, 
          got: derivedPublicKey 
        });
        continue;
      }
    
      return {
        keypair,
        publicKey: reserved.public_key,
        id: reserved.id
      };
    } catch (e) {
      console.error(`[pump-agent-launch] Error getting vanity keypair (${suffix}):`, e);
      continue;
    }
  }
  console.log("[pump-agent-launch] No vanity address available for any suffix");
  return null;
}

// Generate a proper Ed25519 keypair for the mint using Solana's Keypair (fallback)
function generateMintKeypair(): { keypair: Keypair; secretKeyBase58: string } {
  const keypair = Keypair.generate();
  const secretKeyBase58 = bs58.encode(keypair.secretKey);
  return { keypair, secretKeyBase58 };
}

// Parse deployer keypair from private key (supports JSON array or base58 format)
function parseDeployerKeypair(privateKey: string): Keypair {
  try {
    if (privateKey.startsWith("[")) {
      const keyArray = JSON.parse(privateKey);
      return Keypair.fromSecretKey(new Uint8Array(keyArray));
    } else {
      const decoded = bs58.decode(privateKey);
      return Keypair.fromSecretKey(decoded);
    }
  } catch (e) {
    throw new Error("Invalid PUMP_DEPLOYER_PRIVATE_KEY format");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, ticker, description, imageUrl, twitter, telegram, website, initialBuySol = 0.01 } = await req.json();

    // Validate inputs
    if (!name || typeof name !== "string" || name.length < 1 || name.length > 32) {
      throw new Error("Name must be 1-32 characters");
    }
    if (!ticker || typeof ticker !== "string" || ticker.length < 1 || ticker.length > 10) {
      throw new Error("Ticker must be 1-10 characters");
    }
    if (!imageUrl) {
      throw new Error("Image URL is required");
    }

    // Set website to SubTuna page if not provided
    const finalWebsite = website || `https://${BRAND.domain}/t/${ticker.toUpperCase()}`;
    const finalTwitter = twitter || "https://x.com/saturntrade";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const pumpPortalApiKey = Deno.env.get("PUMPPORTAL_API_KEY");
    const deployerPrivateKey = Deno.env.get("PUMP_DEPLOYER_PRIVATE_KEY");

    if (!pumpPortalApiKey) {
      throw new Error("PUMPPORTAL_API_KEY not configured");
    }
    if (!deployerPrivateKey) {
      throw new Error("PUMP_DEPLOYER_PRIVATE_KEY not configured");
    }
    
    // Get encryption key for vanity addresses (first 32 chars of treasury key)
    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const encryptionKey = treasuryPrivateKey?.slice(0, 32) || 'default-encryption-key-12345678';

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse deployer keypair to get public key
    const deployerKeypair = parseDeployerKeypair(deployerPrivateKey);
    const deployerPublicKey = deployerKeypair.publicKey.toBase58();
    console.log("[pump-agent-launch] Deployer public key:", deployerPublicKey);

    // === CRITICAL: Upload base64 images to storage first ===
    let storedImageUrl = imageUrl;
    if (imageUrl.startsWith("data:image")) {
      console.log("[pump-agent-launch] Uploading base64 image to storage...");
      try {
        const base64Data = imageUrl.split(",")[1];
        const imageBuffer = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
        const fileName = `fun-tokens/${Date.now()}-${ticker.toLowerCase()}.png`;

        const { error: uploadError } = await supabase.storage
          .from("post-images")
          .upload(fileName, imageBuffer, { contentType: "image/png", upsert: true });

        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from("post-images").getPublicUrl(fileName);
          storedImageUrl = publicUrl;
          console.log("[pump-agent-launch] ✅ Image uploaded:", storedImageUrl);
        } else {
          console.error("[pump-agent-launch] Image upload failed:", uploadError.message);
          throw new Error("Failed to upload image to storage");
        }
      } catch (uploadErr) {
        console.error("[pump-agent-launch] Image upload error:", uploadErr);
        throw new Error("Image must be a valid URL, not base64");
      }
    }

    // Step 1: Upload metadata to pump.fun IPFS
    console.log("[pump-agent-launch] Uploading metadata to pump.fun IPFS...");
    
    // Fetch the image (now guaranteed to be a URL, not base64)
    const imageResponse = await fetch(storedImageUrl);
    if (!imageResponse.ok) {
      throw new Error("Failed to fetch image");
    }
    const imageBlob = await imageResponse.blob();

    // Create form data for IPFS upload
    const formData = new FormData();
    formData.append("file", imageBlob, "image.png");
    formData.append("name", name);
    formData.append("symbol", ticker.toUpperCase());
    formData.append("description", description || `${name} - Launched via Saturn Agents on pump.fun`);
    formData.append("twitter", finalTwitter);
    formData.append("website", finalWebsite);
    if (telegram) {
      formData.append("telegram", telegram);
    }
    formData.append("showName", "true");

    const ipfsResponse = await fetch("https://pump.fun/api/ipfs", {
      method: "POST",
      body: formData,
    });

    if (!ipfsResponse.ok) {
      const errorText = await ipfsResponse.text();
      console.error("[pump-agent-launch] IPFS upload failed:", errorText);
      throw new Error(`Failed to upload to pump.fun IPFS: ${ipfsResponse.status}`);
    }

    const ipfsData = await ipfsResponse.json();
    const metadataUri = ipfsData.metadataUri;
    
    if (!metadataUri) {
      throw new Error("No metadata URI returned from pump.fun IPFS");
    }
    
    console.log("[pump-agent-launch] Metadata URI:", metadataUri);

    // Step 2: Get mint keypair - try vanity (TNA suffix) first, fallback to random
    console.log("[pump-agent-launch] Getting mint keypair...");
    
    let mintKeypair: Keypair;
    let mintSecretKeyBase58: string;
    let vanityId: string | null = null;
    let usedVanity = false;
    
    // Try to get a pre-mined vanity address with TNA suffix
    const vanityResult = await getVanityKeypair(supabase, encryptionKey);
    
    if (vanityResult) {
      mintKeypair = vanityResult.keypair;
      mintSecretKeyBase58 = bs58.encode(vanityResult.keypair.secretKey);
      vanityId = vanityResult.id;
      usedVanity = true;
      console.log("[pump-agent-launch] ✅ Using vanity mint with TNA suffix:", vanityResult.publicKey);
    } else {
      // Fallback to random keypair
      const randomKeypair = generateMintKeypair();
      mintKeypair = randomKeypair.keypair;
      mintSecretKeyBase58 = randomKeypair.secretKeyBase58;
      console.log("[pump-agent-launch] Using random mint (no vanity available)");
    }
    
    const mintAddress = mintKeypair.publicKey.toBase58();
    console.log("[pump-agent-launch] Mint address:", mintAddress);

    const createPayload = {
      publicKey: deployerPublicKey, // Deployer wallet PUBLIC key (not private!)
      action: "create",
      tokenMetadata: {
        name: name,
        symbol: ticker.toUpperCase(),
        uri: metadataUri,
      },
      mint: mintSecretKeyBase58, // Mint keypair secret for signing
      denominatedInSol: "true",
      amount: initialBuySol, // Initial dev buy
      slippage: 10,
      priorityFee: 0.0005,
      pool: "pump",
    };

    console.log("[pump-agent-launch] PumpPortal payload:", JSON.stringify({
      ...createPayload,
      mint: "[REDACTED]",
    }));

    const createResponse = await fetch(`${PUMPPORTAL_API_URL}?api-key=${pumpPortalApiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createPayload),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("[pump-agent-launch] PumpPortal create failed:", errorText);
      throw new Error(`PumpPortal API error: ${createResponse.status} - ${errorText}`);
    }

    const createResult = await createResponse.json();
    console.log("[pump-agent-launch] Create result:", createResult);

    if (!createResult.signature) {
      throw new Error("No signature returned from PumpPortal");
    }

    // Note: Fee sharing (setParams) is NOT supported by PumpPortal API
    // Valid actions are only: 'buy', 'sell', 'create', 'collectCreatorFee'
    // Creator fees must be enabled manually through pump.fun UI or collected via collectCreatorFee action

    // Step 3: Save to database
    console.log("[pump-agent-launch] Saving to database...");
    
    const { data: funToken, error: insertError } = await supabase
      .from("fun_tokens")
      .insert({
        name,
        ticker: ticker.toUpperCase(),
        description: description || `${name} - AI Agent token on pump.fun`,
        image_url: storedImageUrl, // Use uploaded URL, not raw base64
        website_url: finalWebsite, // Store socials for metadata
        twitter_url: finalTwitter, // Store socials for metadata
        telegram_url: telegram || null,
        mint_address: mintAddress,
        creator_wallet: deployerPublicKey,
        deployer_wallet: deployerPublicKey,
        status: "active",
        launchpad_type: "pumpfun",
        pumpfun_signature: createResult.signature,
        pumpfun_creator: deployerPublicKey,
        price_sol: 0.00000003, // Default initial price
        market_cap_sol: 30, // pump.fun starting mcap
        bonding_progress: 0,
        holder_count: 1, // Deployer is first holder
        total_fees_earned: 0,
        total_fees_claimed: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[pump-agent-launch] DB insert error:", insertError);
      // Don't throw - token was created on-chain, just log error
    }
    
    // Mark vanity address as used if we used one
    if (usedVanity && vanityId) {
      try {
        await supabase
          .from("vanity_keypairs")
          .update({ status: "used", used_at: new Date().toISOString() })
          .eq("id", vanityId);
        console.log("[pump-agent-launch] Marked vanity address as used:", vanityId);
      } catch (e) {
        console.error("[pump-agent-launch] Failed to mark vanity as used:", e);
      }
    }

    // Step 4: Create SubTuna community
    if (funToken?.id) {
      try {
        const { error: subtunaError } = await supabase
          .from("subtuna")
          .insert({
            name,
            ticker: ticker.toUpperCase(),
            description: description || `Community for $${ticker.toUpperCase()} on pump.fun`,
            icon_url: imageUrl,
            fun_token_id: funToken.id,
            member_count: 0,
            post_count: 0,
          });
        
        if (subtunaError) {
          console.error("[pump-agent-launch] SubTuna creation error:", subtunaError);
        }
      } catch (e) {
        console.error("[pump-agent-launch] SubTuna creation failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mintAddress,
        signature: createResult.signature,
        pumpfunUrl: `https://pump.fun/${mintAddress}`,
        tokenId: funToken?.id,
        communityUrl: `/t/${ticker.toUpperCase()}`,
        usedVanity,
        vanityId: vanityId || undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    // Release vanity address if one was reserved during this launch attempt
    if (typeof vanityId === 'string' && vanityId) {
      try {
        const releaseClient = createClient(
          Deno.env.get("SUPABASE_URL") ?? "",
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );
        await releaseClient.rpc('backend_release_vanity_address', {
          p_keypair_id: vanityId,
        });
        console.log(`[pump-agent-launch] Released vanity address ${vanityId} after error`);
      } catch (releaseErr) {
        console.error("[pump-agent-launch] Failed to release vanity address:", releaseErr);
      }
    }
    console.error("[pump-agent-launch] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
