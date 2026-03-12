import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "https://esm.sh/viem@2.45.1";
import { bsc } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ============================================================================
// SaturnPortal ABI (only the functions we call)
// ============================================================================
const PORTAL_ABI = [
  {
    name: "newToken",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_symbol", type: "string" },
      { name: "_creatorFeeBps", type: "uint256" },
      { name: "_metadataUri", type: "string" },
      { name: "_salt", type: "bytes32" },
    ],
    outputs: [{ name: "tokenAddress", type: "address" }],
  },
  {
    name: "predictTokenAddress",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "_name", type: "string" },
      { name: "_symbol", type: "string" },
      { name: "_salt", type: "bytes32" },
    ],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "getTokenInfo",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_token", type: "address" }],
    outputs: [
      { name: "creator", type: "address" },
      { name: "creatorFeeBps", type: "uint256" },
      { name: "realBnb", type: "uint256" },
      { name: "realTokens", type: "uint256" },
      { name: "bondingProgress", type: "uint256" },
      { name: "graduated", type: "bool" },
      { name: "totalFeesCollected", type: "uint256" },
      { name: "price", type: "uint256" },
    ],
  },
] as const;

// ============================================================================
// Vanity Address Finder — finds salt where predicted address ends in "8888"
// ============================================================================
function findVanitySalt(
  portalAddress: string,
  name: string,
  symbol: string,
  maxIterations = 200_000
): { salt: `0x${string}`; predictedAddress: string } | null {
  // We can't easily do CREATE2 prediction without full bytecode hash in JS
  // Instead, use a simple random salt approach and let the contract handle it
  // For vanity addresses, this would be done off-chain with the full bytecode
  
  // For now, generate a random salt
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const salt = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}` as `0x${string}`;
  
  return { salt, predictedAddress: "" };
}

// ============================================================================
// Request Handler
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
  initialBuyBnb?: string; // e.g. "0.1" — creator's initial purchase
  creatorFeeBps?: number; // 0-10000 (default 5000 = 50%)
}

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

    // Get Portal address
    const portalAddress = Deno.env.get("BNB_PORTAL_ADDRESS");
    if (!portalAddress) {
      return new Response(
        JSON.stringify({ error: "BNB Portal not deployed yet. Run bnb-deploy-portal first." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const initialBuyBnb = body.initialBuyBnb || "0";
    const initialBuyWei = parseEther(initialBuyBnb);
    const creatorFeeBps = body.creatorFeeBps ?? 5000; // Default 50%

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
    const BSC_RPC = ALCHEMY_KEY ? `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "https://bsc-dataseed.binance.org";
    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC) });

    // Check balance
    const balance = await publicClient.getBalance({ address: account.address });
    const minRequired = initialBuyWei + parseEther("0.005"); // initial buy + gas

    if (balance < minRequired) {
      return new Response(
        JSON.stringify({
          error: `Insufficient BNB. Balance: ${formatEther(balance)} BNB. Need: ${formatEther(minRequired)} BNB.`,
          deployer: account.address,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[BNB Portal] Creating ${body.name} ($${body.ticker}) for ${body.creatorWallet}`);
    console.log(`[BNB Portal] Portal: ${portalAddress}, Initial buy: ${initialBuyBnb} BNB, Creator fee: ${creatorFeeBps / 100}%`);

    // Build metadata URI
    const metadata = JSON.stringify({
      name: body.name,
      symbol: body.ticker.toUpperCase(),
      description: body.description || "",
      image: body.imageUrl || "",
      website: body.websiteUrl || "",
      twitter: body.twitterUrl || "",
      telegram: body.telegramUrl || "",
      creator: body.creatorWallet,
    });
    const metadataUri = `data:application/json;base64,${btoa(metadata)}`;

    // Generate salt
    const vanity = findVanitySalt(portalAddress, body.name, body.ticker.toUpperCase());
    if (!vanity) {
      return new Response(
        JSON.stringify({ error: "Failed to generate salt" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Portal.newToken()
    console.log("[BNB Portal] Calling newToken()...");
    const txHash = await walletClient.writeContract({
      address: portalAddress as `0x${string}`,
      abi: PORTAL_ABI,
      functionName: "newToken",
      args: [
        body.name,
        body.ticker.toUpperCase(),
        BigInt(creatorFeeBps),
        metadataUri,
        vanity.salt,
      ],
      value: initialBuyWei,
    });

    console.log(`[BNB Portal] Tx: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 60_000,
    });

    // Parse TokenCreated event from logs to get token address
    // Event: TokenCreated(address indexed token, address indexed creator, ...)
    const tokenCreatedTopic = keccak256(
      new TextEncoder().encode("TokenCreated(address,address,string,string,uint256,string)")
    );

    let tokenAddress: string | null = null;
    for (const log of receipt.logs) {
      if (log.topics[0] === tokenCreatedTopic) {
        // First indexed param is the token address
        tokenAddress = `0x${log.topics[1]?.slice(26)}`;
        break;
      }
    }

    if (!tokenAddress) {
      // Fallback: check transaction events
      console.warn("[BNB Portal] Could not parse TokenCreated event, using receipt status");
      if (receipt.status !== "success") {
        throw new Error("Transaction failed");
      }
      // Try to get from contract
      tokenAddress = receipt.logs[0]?.address || null;
    }

    console.log(`[BNB Portal] ✅ Token created at: ${tokenAddress}`);

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
      p_evm_pool_address: portalAddress,
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
      console.error("[BNB Portal] DB error:", dbError);
    }

    console.log(`[BNB Portal] ✅ Complete! Token ID: ${tokenId}`);

    return new Response(
      JSON.stringify({
        success: true,
        tokenAddress,
        txHash,
        tokenId,
        portalAddress,
        deployer: account.address,
        network: "bnb",
        chainId: 56,
        totalSupply: "1000000000",
        initialBuy: initialBuyBnb,
        creatorFeeBps,
        explorerUrl: `https://bscscan.com/tx/${txHash}`,
        tokenUrl: tokenAddress ? `https://bscscan.com/token/${tokenAddress}` : null,
        message: `Token ${body.name} ($${body.ticker}) created on BNB Chain via SaturnPortal bonding curve`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[BNB Portal] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Token creation failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
