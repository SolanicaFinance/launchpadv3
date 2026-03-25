import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { notifyBnbLaunch } from "../_shared/telegram-notify.ts";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  encodeAbiParameters,
  parseAbiParameters,
  keccak256,
  toBytes,
  toHex,
  getContractAddress,
  type Hex,
  type Address,
} from "https://esm.sh/viem@2.45.1";
import { bsc } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount, generatePrivateKey } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// Contract addresses (BNB Mainnet)
// ============================================================================
const PORTAL_ADDRESS = "0xe2cE6ab80874Fa9Fa2aAE65D277Dd6B8e65C9De0" as Address;
const VAULT_PORTAL_ADDRESS = "0x90497450f2a706f1951b5bdda52B4E5d16f34C06" as Address;
const SPLIT_VAULT_FACTORY = "0xfab75Dc774cB9B38b91749B8833360B46a52345F" as Address;
const TAX_TOKEN_V1_IMPL = "0x29e6383F0ce68507b5A72a53c2B118a118332aA8" as Address;
const PLATFORM_FEE_WALLET = "0xf621ADAbA16Ee50D7145d8F9D65B6DA881341E37" as Address;
const PLATFORM_FEE_BPS = 100; // 1% platform fee always

// Vanity suffix for tax tokens
const TAX_VANITY_SUFFIX = "7777";

// ============================================================================
// VaultPortal ABI (newTaxTokenWithVault)
// ============================================================================
const VAULT_PORTAL_ABI = [
  {
    name: "newTaxTokenWithVault",
    type: "function",
    stateMutability: "payable",
    inputs: [
      {
        name: "params",
        type: "tuple",
        components: [
          { name: "name", type: "string" },
          { name: "symbol", type: "string" },
          { name: "meta", type: "string" },
          { name: "dexThresh", type: "uint8" },
          { name: "salt", type: "bytes32" },
          { name: "taxRate", type: "uint16" },
          { name: "migratorType", type: "uint8" },
          { name: "quoteToken", type: "address" },
          { name: "quoteAmt", type: "uint256" },
          { name: "permitData", type: "bytes" },
          { name: "extensionID", type: "bytes32" },
          { name: "extensionData", type: "bytes" },
          { name: "dexId", type: "uint8" },
          { name: "lpFeeProfile", type: "uint8" },
          { name: "taxDuration", type: "uint64" },
          { name: "antiFarmerDuration", type: "uint64" },
          { name: "mktBps", type: "uint16" },
          { name: "deflationBps", type: "uint16" },
          { name: "dividendBps", type: "uint16" },
          { name: "lpBps", type: "uint16" },
          { name: "minimumShareBalance", type: "uint256" },
          { name: "vaultFactory", type: "address" },
          { name: "vaultData", type: "bytes" },
        ],
      },
    ],
    outputs: [{ name: "token", type: "address" }],
  },
] as const;

// ============================================================================
// Upload metadata to IPFS via upload API
// ============================================================================
async function uploadMetadata(params: {
  name: string;
  symbol: string;
  description: string;
  imageUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  telegramUrl: string;
  creator: string;
}): Promise<string> {
  // If we have an image URL, download it and upload as file
  // Otherwise use the GraphQL mutation with metadata only
  const UPLOAD_API = "https://funcs.flap.sh/api/upload";

  const MUTATION_CREATE = `
    mutation Create($file: Upload!, $meta: MetadataInput!) {
      create(file: $file, meta: $meta)
    }
  `;

  // Download the image if provided
  let imageBlob: Blob;
  let imageFilename = "image.png";
  
  if (params.imageUrl) {
    try {
      const imgRes = await fetch(params.imageUrl);
      if (imgRes.ok) {
        imageBlob = await imgRes.blob();
        const ct = imgRes.headers.get("content-type") || "image/png";
        const ext = ct.includes("jpeg") || ct.includes("jpg") ? "jpg" : ct.includes("gif") ? "gif" : ct.includes("webp") ? "webp" : "png";
        imageFilename = `image.${ext}`;
      } else {
        // Fallback: create a 1x1 transparent PNG
        imageBlob = new Blob([new Uint8Array([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
          0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
          0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
          0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
          0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
          0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
        ])], { type: "image/png" });
      }
    } catch {
      imageBlob = new Blob([new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
        0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
        0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
        0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
        0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
        0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
      ])], { type: "image/png" });
    }
  } else {
    imageBlob = new Blob([new Uint8Array([
      0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
      0x0A, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x62, 0x00, 0x00, 0x00, 0x02,
      0x00, 0x01, 0xE5, 0x27, 0xDE, 0xFC, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
      0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
    ])], { type: "image/png" });
  }

  const form = new FormData();
  form.append(
    "operations",
    JSON.stringify({
      query: MUTATION_CREATE,
      variables: {
        file: null,
        meta: {
          website: params.websiteUrl || null,
          twitter: params.twitterUrl || null,
          telegram: params.telegramUrl || null,
          description: params.description || "",
          creator: "0x0000000000000000000000000000000000000000",
        },
      },
    })
  );
  form.append("map", JSON.stringify({ "0": ["variables.file"] }));
  form.append("0", new File([imageBlob], imageFilename, { type: imageBlob.type }));

  const res = await fetch(UPLOAD_API, {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`IPFS upload failed (${res.status}): ${errText}`);
  }

  const data = await res.json();
  const cid = data?.data?.create;
  if (!cid) {
    throw new Error(`IPFS upload returned no CID: ${JSON.stringify(data)}`);
  }

  console.log(`[BNB] Metadata uploaded to IPFS: ${cid}`);
  return cid;
}

// ============================================================================
// Find vanity salt for CREATE2 (tax token suffix: 7777)
// ============================================================================
function findVanitySalt(
  portalAddress: Address,
  tokenImpl: Address,
  suffix: string,
  maxIterations = 500_000
): { salt: Hex; address: Address; iterations: number } {
  const bytecodePrefix = "0x3d602d80600a3d3981f3363d3d373d3d3d363d73" as Hex;
  const bytecodeSuffix = "5af43d82803e903d91602b57fd5bf3" as string;
  const bytecode = (bytecodePrefix + tokenImpl.slice(2).toLowerCase() + bytecodeSuffix) as Hex;

  let seed = generatePrivateKey();
  let salt = keccak256(toHex(seed));
  let iterations = 0;

  while (iterations < maxIterations) {
    const predicted = getContractAddress({
      from: portalAddress,
      salt: toBytes(salt),
      bytecode,
      opcode: "CREATE2",
    });

    if (predicted.toLowerCase().endsWith(suffix.toLowerCase())) {
      console.log(`[BNB] Vanity salt found after ${iterations} iterations: ${predicted}`);
      return { salt, address: predicted as Address, iterations };
    }

    salt = keccak256(salt);
    iterations++;
  }

  throw new Error(`Could not find vanity suffix "${suffix}" after ${maxIterations} iterations`);
}

// ============================================================================
// Encode Split Vault data
// ============================================================================
function encodeSplitVaultData(
  platformWallet: Address,
  platformShareBps: number,
  creatorWallet: Address,
  creatorShareBps: number
): Hex {
  // SplitVault.Recipient[] — array of {address recipient, uint16 bps}
  // Total bps must equal 10000
  const recipients: { recipient: Address; bps: number }[] = [];

  if (creatorShareBps > 0) {
    recipients.push({ recipient: creatorWallet, bps: creatorShareBps });
  }
  recipients.push({ recipient: platformWallet, bps: platformShareBps });

  // Adjust to sum to 10000
  const totalBps = recipients.reduce((s, r) => s + r.bps, 0);
  if (totalBps !== 10000) {
    // Scale proportionally
    const scale = 10000 / totalBps;
    let assigned = 0;
    for (let i = 0; i < recipients.length - 1; i++) {
      recipients[i].bps = Math.round(recipients[i].bps * scale);
      assigned += recipients[i].bps;
    }
    recipients[recipients.length - 1].bps = 10000 - assigned;
  }

  // ABI-encode as (address,uint16)[]
  const encoded = encodeAbiParameters(
    parseAbiParameters("(address recipient, uint16 bps)[]"),
    [recipients.map(r => ({ recipient: r.recipient, bps: r.bps }))]
  );

  return encoded;
}

// ============================================================================
// Request body
// ============================================================================
interface CreateTokenRequest {
  name: string;
  ticker: string;
  creatorWallet: string;
  description?: string;
  imageUrl?: string;
  websiteUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
  initialBuyBnb?: string;
  creatorFeeBps?: number; // 0-800 (0-8%)
}

// ============================================================================
// Handler
// ============================================================================
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: CreateTokenRequest = await req.json();

    if (!body.name || !body.ticker || !body.creatorWallet) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: name, ticker, creatorWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!/^0x[a-fA-F0-9]{40}$/.test(body.creatorWallet)) {
      return new Response(
        JSON.stringify({ error: "Invalid creatorWallet address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const creatorFeeBps = Math.min(body.creatorFeeBps ?? 0, 800); // Max 8%
    const totalTaxBps = PLATFORM_FEE_BPS + creatorFeeBps; // 1% platform + creator fee
    // Max 9% on our side (+ protocol's own fee)

    const initialBuyBnb = body.initialBuyBnb || "0";
    const initialBuyWei = parseEther(initialBuyBnb);

    // Setup deployer
    const deployerKey = Deno.env.get("BASE_DEPLOYER_PRIVATE_KEY");
    if (!deployerKey) {
      return new Response(
        JSON.stringify({ error: "Deployer key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const account = privateKeyToAccount(
      (deployerKey.startsWith("0x") ? deployerKey : `0x${deployerKey}`) as `0x${string}`
    );

    const ALCHEMY_KEY = Deno.env.get("ALCHEMY_BSC_API_KEY");
    const BSC_RPC = ALCHEMY_KEY
      ? `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
      : "https://bsc-dataseed.binance.org";
    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC) });

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    const minRequired = initialBuyWei + parseEther("0.005");

    if (balance < minRequired) {
      return new Response(
        JSON.stringify({
          error: `Insufficient BNB. Balance: ${formatEther(balance)} BNB. Need: ${formatEther(minRequired)} BNB.`,
          deployer: account.address,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BNB] Creating ${body.name} ($${body.ticker}) for ${body.creatorWallet}`);
    console.log(`[BNB] Tax: ${totalTaxBps}bps (platform: ${PLATFORM_FEE_BPS}bps, creator: ${creatorFeeBps}bps)`);

    // Step 1: Upload metadata to IPFS
    console.log("[BNB] Uploading metadata to IPFS...");
    const metaCid = await uploadMetadata({
      name: body.name,
      symbol: body.ticker.toUpperCase(),
      description: body.description || "",
      imageUrl: body.imageUrl || "",
      websiteUrl: body.websiteUrl || "",
      twitterUrl: body.twitterUrl || "",
      telegramUrl: body.telegramUrl || "",
      creator: body.creatorWallet,
    });

    // Step 2: Find vanity salt (7777 for tax tokens)
    console.log("[BNB] Finding vanity salt for 7777 suffix...");
    const vanity = findVanitySalt(PORTAL_ADDRESS, TAX_TOKEN_V1_IMPL, TAX_VANITY_SUFFIX);

    // Step 3: Encode Split Vault data
    // Split vault distributes tax between platform and creator proportionally
    // Platform gets PLATFORM_FEE_BPS / totalTaxBps of vault receipts
    // Creator gets creatorFeeBps / totalTaxBps
    const platformVaultShare = Math.round((PLATFORM_FEE_BPS / totalTaxBps) * 10000);
    const creatorVaultShare = 10000 - platformVaultShare;

    console.log(`[BNB] Vault split: platform=${platformVaultShare}bps, creator=${creatorVaultShare}bps`);

    const vaultData = encodeSplitVaultData(
      PLATFORM_FEE_WALLET,
      platformVaultShare,
      body.creatorWallet as Address,
      creatorVaultShare
    );

    // Step 4: Call VaultPortal.newTaxTokenWithVault
    console.log("[BNB] Calling VaultPortal.newTaxTokenWithVault()...");

    const params = {
      name: body.name,
      symbol: body.ticker.toUpperCase(),
      meta: metaCid,
      dexThresh: 0, // default
      salt: vanity.salt,
      taxRate: totalTaxBps, // total tax in bps
      migratorType: 1, // V2_MIGRATOR for tax tokens
      quoteToken: "0x0000000000000000000000000000000000000000" as Address, // native BNB
      quoteAmt: initialBuyWei,
      permitData: "0x" as Hex,
      extensionID: "0x0000000000000000000000000000000000000000000000000000000000000000" as Hex,
      extensionData: "0x" as Hex,
      dexId: 0, // default PancakeSwap
      lpFeeProfile: 0, // default
      taxDuration: BigInt(0), // permanent
      antiFarmerDuration: BigInt(0),
      mktBps: 10000, // 100% of tax goes to vault (beneficiary/vault)
      deflationBps: 0,
      dividendBps: 0,
      lpBps: 0,
      minimumShareBalance: BigInt(0),
      vaultFactory: SPLIT_VAULT_FACTORY,
      vaultData: vaultData,
    };

    const txHash = await walletClient.writeContract({
      address: VAULT_PORTAL_ADDRESS,
      abi: VAULT_PORTAL_ABI,
      functionName: "newTaxTokenWithVault",
      args: [params],
      value: initialBuyWei,
    });

    console.log(`[BNB] Tx: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 60_000,
    });

    // Parse TokenCreated event to get token address
    const tokenCreatedTopic = keccak256(
      toBytes("TokenCreated(uint256,address,uint256,address,string,string,string)")
    );

    let tokenAddress: string | null = null;
    for (const log of receipt.logs) {
      if (log.topics[0] === tokenCreatedTopic) {
        // token address is in topics
        tokenAddress = `0x${log.topics[3]?.slice(26)}`;
        break;
      }
    }

    // Fallback: try to find any token creation log
    if (!tokenAddress) {
      for (const log of receipt.logs) {
        // Look for Transfer events from zero address (token minting)
        const transferTopic = keccak256(toBytes("Transfer(address,address,uint256)"));
        if (log.topics[0] === transferTopic && log.topics[1] === "0x0000000000000000000000000000000000000000000000000000000000000000") {
          tokenAddress = log.address;
          break;
        }
      }
    }

    if (!tokenAddress && receipt.status !== "success") {
      throw new Error("Transaction failed");
    }

    console.log(`[BNB] ✅ Token created at: ${tokenAddress}`);

    // Record in database
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenId, error: dbError } = await supabase.rpc("backend_create_bnb_token", {
      p_name: body.name,
      p_ticker: body.ticker.toUpperCase(),
      p_creator_wallet: body.creatorWallet,
      p_evm_token_address: tokenAddress || "",
      p_evm_pool_address: VAULT_PORTAL_ADDRESS,
      p_evm_factory_tx_hash: txHash,
      p_creator_fee_bps: creatorFeeBps,
      p_fair_launch_duration_mins: 0,
      p_starting_mcap_usd: 5000,
      p_description: body.description ?? null,
      p_image_url: body.imageUrl ?? null,
      p_website_url: body.websiteUrl ?? null,
      p_twitter_url: body.twitterUrl ?? null,
    });

    if (dbError) {
      console.error("[BNB] DB error:", dbError);
    }

    console.log(`[BNB] ✅ Complete! Token ID: ${tokenId}`);

    // Send Telegram launch notification
    if (tokenAddress) {
      await notifyBnbLaunch({
        name: body.name,
        ticker: body.ticker,
        creatorWallet: body.creatorWallet,
        tokenAddress,
        txHash,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        tokenAddress,
        txHash,
        tokenId,
        deployer: account.address,
        network: "bnb",
        chainId: 56,
        totalSupply: "1000000000",
        initialBuy: initialBuyBnb,
        platformFeeBps: PLATFORM_FEE_BPS,
        creatorFeeBps,
        totalTaxBps,
        vanityAddress: vanity.address,
        explorerUrl: `https://bscscan.com/tx/${txHash}`,
        tokenUrl: tokenAddress ? `https://bscscan.com/token/${tokenAddress}` : null,
        message: `Token ${body.name} ($${body.ticker}) created on BNB Chain with ${totalTaxBps / 100}% tax`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BNB] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Token creation failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
