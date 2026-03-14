// BAGS Agent Launch - Creates tokens on bags.fm
// 100% of fees go to platform treasury
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection, PublicKey, VersionedTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";
import { BRAND } from "../_shared/branding.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Bags.fm API base URL
const BAGS_API_URL = "https://public-api-v2.bags.fm/api/v1";

// Treasury wallet - receives 100% of fees
const TREASURY_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

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

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

// Try to get a pre-mined vanity keypair — STRN suffix (case-sensitive uppercase)
async function getVanityKeypair(supabase: any, encryptionKey: string): Promise<{ keypair: Keypair; publicKey: string; id: string } | null> {
  const suffixes = ['STRN'];
  for (const suffix of suffixes) {
    try {
      const { data, error } = await supabase.rpc('backend_reserve_vanity_address', {
        p_suffix: suffix
      });
    
      if (error || !data || data.length === 0) {
        console.log(`[bags-agent-launch] No vanity address for suffix '${suffix}':`, error?.message || "empty result");
        continue;
      }
    
      const reserved = data[0];
      console.log(`[bags-agent-launch] Reserved vanity address (${suffix}):`, reserved.public_key);
    
      const secretKeyBytes = decryptSecretKey(reserved.secret_key_encrypted, encryptionKey);
      const keypair = Keypair.fromSecretKey(secretKeyBytes);
    
      const derivedPublicKey = keypair.publicKey.toBase58();
      if (derivedPublicKey !== reserved.public_key) {
        console.error(`[bags-agent-launch] Vanity keypair mismatch (${suffix})!`);
        continue;
      }
    
      return {
        keypair,
        publicKey: reserved.public_key,
        id: reserved.id
      };
    } catch (e) {
      console.error(`[bags-agent-launch] Error getting vanity keypair (${suffix}):`, e);
      continue;
    }
  }
  console.log("[bags-agent-launch] No vanity address available for any suffix");
  return null;
}

// Parse deployer keypair
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
    throw new Error("Invalid BAGS_DEPLOYER_PRIVATE_KEY format");
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, ticker, description, imageUrl, twitter, website, initialBuySol = 0.01 } = await req.json();

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

    const finalWebsite = website || `https://${BRAND.domain}/t/${ticker.toUpperCase()}`;
    const finalTwitter = twitter || "https://x.com/saturntrade";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const bagsApiKey = Deno.env.get("BAGS_API_KEY");
    const deployerPrivateKey = Deno.env.get("BAGS_DEPLOYER_PRIVATE_KEY") || Deno.env.get("TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!bagsApiKey) {
      throw new Error("BAGS_API_KEY not configured");
    }
    if (!deployerPrivateKey) {
      throw new Error("BAGS_DEPLOYER_PRIVATE_KEY not configured");
    }
    if (!heliusRpcUrl) {
      throw new Error("HELIUS_RPC_URL not configured");
    }

    const treasuryPrivateKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const encryptionKey = treasuryPrivateKey?.slice(0, 32) || 'default-encryption-key-12345678';

    const supabase = createClient(supabaseUrl, supabaseKey);
    const connection = new Connection(heliusRpcUrl, "confirmed");

    const deployerKeypair = parseDeployerKeypair(deployerPrivateKey);
    const deployerPublicKey = deployerKeypair.publicKey.toBase58();
    console.log("[bags-agent-launch] Deployer public key:", deployerPublicKey);

    // Upload base64 images to storage first
    let storedImageUrl = imageUrl;
    if (imageUrl.startsWith("data:image")) {
      console.log("[bags-agent-launch] Uploading base64 image to storage...");
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
          console.log("[bags-agent-launch] ✅ Image uploaded:", storedImageUrl);
        } else {
          console.error("[bags-agent-launch] Image upload failed:", uploadError.message);
          throw new Error("Failed to upload image to storage");
        }
      } catch (uploadErr) {
        console.error("[bags-agent-launch] Image upload error:", uploadErr);
        throw new Error("Image must be a valid URL, not base64");
      }
    }

    // Step 1: Get mint keypair - try vanity (TNA suffix) first
    console.log("[bags-agent-launch] Getting mint keypair...");
    
    let mintKeypair: Keypair;
    let vanityId: string | null = null;
    let usedVanity = false;
    
    const vanityResult = await getVanityKeypair(supabase, encryptionKey);
    
    if (vanityResult) {
      mintKeypair = vanityResult.keypair;
      vanityId = vanityResult.id;
      usedVanity = true;
      console.log("[bags-agent-launch] ✅ Using vanity mint with TNA suffix:", vanityResult.publicKey);
    } else {
      mintKeypair = Keypair.generate();
      console.log("[bags-agent-launch] Using random mint (no vanity available)");
    }
    
    const mintAddress = mintKeypair.publicKey.toBase58();
    console.log("[bags-agent-launch] Mint address:", mintAddress);

    // Step 2: Create token on bags.fm
    // First upload metadata
    console.log("[bags-agent-launch] Creating token on bags.fm...");
    
    const metadataPayload = {
      name,
      symbol: ticker.toUpperCase(),
      description: description || `${name} - Launched via TUNA Agents on bags.fm`,
      image: storedImageUrl,
      twitter: finalTwitter,
      website: finalWebsite,
    };

    const metadataResponse = await fetch(`${BAGS_API_URL}/token-launch/create-token-info-and-metadata`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": bagsApiKey,
      },
      body: JSON.stringify(metadataPayload),
    });

    if (!metadataResponse.ok) {
      const errorText = await metadataResponse.text();
      console.error("[bags-agent-launch] Metadata creation failed:", errorText);
      throw new Error(`Failed to create metadata on bags.fm: ${metadataResponse.status}`);
    }

    const metadataResult = await metadataResponse.json();
    console.log("[bags-agent-launch] Metadata result:", metadataResult);

    // Step 3: Create launch transaction
    // Configure 100% fee share to treasury
    const launchPayload = {
      name,
      symbol: ticker.toUpperCase(),
      metadataUri: metadataResult.metadataUri || metadataResult.uri,
      mintKeypair: bs58.encode(mintKeypair.secretKey),
      creator: deployerPublicKey,
      initialBuyAmount: initialBuySol,
      feeShareConfig: {
        feeClaimers: [
          { address: TREASURY_WALLET, bps: 10000 } // 100% to treasury
        ]
      }
    };

    const launchResponse = await fetch(`${BAGS_API_URL}/token-launch/create-launch-transaction`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": bagsApiKey,
      },
      body: JSON.stringify(launchPayload),
    });

    if (!launchResponse.ok) {
      const errorText = await launchResponse.text();
      console.error("[bags-agent-launch] Launch transaction creation failed:", errorText);
      throw new Error(`Failed to create launch transaction: ${launchResponse.status}`);
    }

    const launchResult = await launchResponse.json();
    console.log("[bags-agent-launch] Launch result:", launchResult);

    // Step 4: Sign and submit transaction
    let signature: string;
    
    if (launchResult.transaction) {
      // Deserialize and sign the transaction
      const base64ToBytes = (base64: string) => {
        const binString = atob(base64);
        return Uint8Array.from(binString, (c) => c.charCodeAt(0));
      };
      const txBuffer = base64ToBytes(launchResult.transaction);
      const transaction = VersionedTransaction.deserialize(txBuffer);
      
      // Sign with deployer and mint keypair
      transaction.sign([deployerKeypair, mintKeypair]);
      
      // Submit to network
      signature = await connection.sendTransaction(transaction, {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      
      console.log("[bags-agent-launch] Transaction submitted:", signature);
      
      // Wait for confirmation
      await connection.confirmTransaction(signature, "confirmed");
      console.log("[bags-agent-launch] Transaction confirmed!");
    } else if (launchResult.signature) {
      signature = launchResult.signature;
    } else {
      throw new Error("No transaction or signature returned from bags.fm");
    }

    // Step 5: Save to database
    console.log("[bags-agent-launch] Saving to database...");
    
    const { data: funToken, error: insertError } = await supabase
      .from("fun_tokens")
      .insert({
        name,
        ticker: ticker.toUpperCase(),
        description: description || `${name} - AI Agent token on bags.fm`,
        image_url: storedImageUrl,
        website_url: finalWebsite,
        twitter_url: finalTwitter,
        mint_address: mintAddress,
        creator_wallet: deployerPublicKey,
        deployer_wallet: deployerPublicKey,
        status: "active",
        launchpad_type: "bags",
        bags_signature: signature,
        bags_creator: deployerPublicKey,
        bags_pool_address: launchResult.poolAddress || null,
        price_sol: 0.00000003,
        market_cap_sol: 30,
        bonding_progress: 0,
        holder_count: 1,
        total_fees_earned: 0,
        total_fees_claimed: 0,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[bags-agent-launch] DB insert error:", insertError);
    }
    
    // Mark vanity address as used
    if (usedVanity && vanityId) {
      try {
        await supabase
          .from("vanity_keypairs")
          .update({ status: "used", used_at: new Date().toISOString() })
          .eq("id", vanityId);
        console.log("[bags-agent-launch] Marked vanity address as used:", vanityId);
      } catch (e) {
        console.error("[bags-agent-launch] Failed to mark vanity as used:", e);
      }
    }

    // Step 6: Create SubTuna community
    if (funToken?.id) {
      try {
        const { error: subtunaError } = await supabase
          .from("subtuna")
          .insert({
            name,
            ticker: ticker.toUpperCase(),
            description: description || `Community for $${ticker.toUpperCase()} on bags.fm`,
            icon_url: storedImageUrl,
            fun_token_id: funToken.id,
            member_count: 0,
            post_count: 0,
          });
        
        if (subtunaError) {
          console.error("[bags-agent-launch] SubTuna creation error:", subtunaError);
        }
      } catch (e) {
        console.error("[bags-agent-launch] SubTuna creation failed:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mintAddress,
        signature,
        bagsUrl: `https://bags.fm/coin/${mintAddress}`,
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
    console.error("[bags-agent-launch] Error:", error);
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
