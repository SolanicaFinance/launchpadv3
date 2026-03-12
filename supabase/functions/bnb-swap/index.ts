import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  formatEther,
  encodeFunctionData,
  parseAbi,
} from "https://esm.sh/viem@2.45.1";
import { bsc } from "https://esm.sh/viem@2.45.1/chains";
import { privateKeyToAccount } from "https://esm.sh/viem@2.45.1/accounts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── SaturnPortal bonding curve ABI (for non-graduated tokens) ──
const PORTAL_ABI = [
  {
    name: "buy",
    type: "function",
    stateMutability: "payable",
    inputs: [{ name: "_token", type: "address" }],
    outputs: [],
  },
  {
    name: "sell",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_token", type: "address" },
      { name: "_tokenAmount", type: "uint256" },
    ],
    outputs: [],
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

// ── ERC-20 approve ABI ──
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
]);

const OPENOCEAN_API = "https://open-api.openocean.finance/v4/bsc";
const BNB_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const BSC_RPC = "https://bsc-dataseed.binance.org";

interface SwapRequest {
  tokenAddress: string;
  action: "buy" | "sell";
  amount: string; // BNB amount for buy, token amount for sell
  userWallet: string;
  slippage?: number; // percentage, default 3
}

// ── OpenOcean DEX swap for graduated tokens ──
async function openOceanSwap(
  tokenAddress: string,
  action: "buy" | "sell",
  amount: string,
  slippage: number,
  account: ReturnType<typeof privateKeyToAccount>,
  publicClient: any,
  walletClient: any,
): Promise<{ txHash: string; outAmount: string }> {
  const inToken = action === "buy" ? BNB_NATIVE : tokenAddress;
  const outToken = action === "buy" ? tokenAddress : BNB_NATIVE;

  // For sells, we need token amount in smallest unit
  const inAmountRaw = parseEther(amount).toString();

  // If selling, ensure token approval for OpenOcean router
  if (action === "sell") {
    // Get OpenOcean quote first to find the router address
    const quoteUrl = `${OPENOCEAN_API}/quote?inTokenAddress=${inToken}&outTokenAddress=${outToken}&amount=${amount}&gasPrice=3`;
    console.log(`[bnb-swap] OpenOcean quote: ${quoteUrl}`);
    const quoteRes = await fetch(quoteUrl);
    const quoteData = await quoteRes.json();
    if (quoteData.code !== 200) {
      throw new Error(`OpenOcean quote failed: ${JSON.stringify(quoteData)}`);
    }
  }

  // Get swap calldata from OpenOcean
  const swapUrl = `${OPENOCEAN_API}/swap?inTokenAddress=${inToken}&outTokenAddress=${outToken}&amount=${amount}&gasPrice=3&slippage=${slippage}&account=${account.address}`;
  console.log(`[bnb-swap] OpenOcean swap URL: ${swapUrl}`);

  const swapRes = await fetch(swapUrl);
  const swapData = await swapRes.json();

  if (swapData.code !== 200 || !swapData.data) {
    throw new Error(`OpenOcean swap failed: ${JSON.stringify(swapData)}`);
  }

  const { to, data, value: txValue, outAmount } = swapData.data;

  // For sell: approve the OpenOcean router if needed
  if (action === "sell") {
    const currentAllowance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [account.address, to as `0x${string}`],
    });

    const sellAmount = BigInt(inAmountRaw);
    if (currentAllowance < sellAmount) {
      console.log(`[bnb-swap] Approving ${to} for token ${tokenAddress}`);
      const approveTx = await walletClient.writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [to as `0x${string}`, sellAmount * 2n], // approve 2x for buffer
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx, confirmations: 1, timeout: 20_000 });
      console.log(`[bnb-swap] Approval confirmed: ${approveTx}`);
    }
  }

  // Execute the swap
  const txHash = await walletClient.sendTransaction({
    to: to as `0x${string}`,
    data: data as `0x${string}`,
    value: BigInt(txValue || "0"),
  });

  console.log(`[bnb-swap] OpenOcean tx: ${txHash}`);
  return { txHash, outAmount: outAmount || "0" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: SwapRequest = await req.json();

    if (!body.tokenAddress || !body.action || !body.amount || !body.userWallet) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: tokenAddress, action, amount, userWallet" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
    const walletClient = createWalletClient({ account, chain: bsc, transport: http(BSC_RPC) });
    const slippage = body.slippage ?? 3;

    // ── Check if token is on bonding curve or graduated ──
    const portalAddress = Deno.env.get("BNB_PORTAL_ADDRESS");
    let isGraduated = false;

    if (portalAddress) {
      try {
        const tokenInfo = await publicClient.readContract({
          address: portalAddress as `0x${string}`,
          abi: PORTAL_ABI,
          functionName: "getTokenInfo",
          args: [body.tokenAddress as `0x${string}`],
        });
        const [, , , , , graduated] = tokenInfo;
        isGraduated = graduated;
      } catch (e) {
        // Token not on portal — assume graduated / external DEX token
        console.log(`[bnb-swap] Token not on portal, routing to OpenOcean`);
        isGraduated = true;
      }
    } else {
      // No portal deployed, use OpenOcean for all tokens
      isGraduated = true;
    }

    // ── Check deployer balance ──
    if (body.action === "buy") {
      const balance = await publicClient.getBalance({ address: account.address });
      const bnbAmount = parseEther(body.amount);
      if (balance < bnbAmount + parseEther("0.002")) {
        return new Response(
          JSON.stringify({ error: `Insufficient BNB. Balance: ${formatEther(balance)}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let txHash: string;
    let estimatedOutput = "0";

    if (isGraduated) {
      // ── Route through OpenOcean DEX aggregator ──
      console.log(`[bnb-swap] Graduated token — using OpenOcean for ${body.action}`);
      const result = await openOceanSwap(
        body.tokenAddress,
        body.action,
        body.amount,
        slippage,
        account,
        publicClient,
        walletClient,
      );
      txHash = result.txHash;
      estimatedOutput = result.outAmount;
    } else {
      // ── Bonding curve swap via SaturnPortal ──
      console.log(`[bnb-swap] Bonding curve token — using SaturnPortal for ${body.action}`);

      if (body.action === "buy") {
        const bnbAmount = parseEther(body.amount);
        txHash = await walletClient.writeContract({
          address: portalAddress as `0x${string}`,
          abi: PORTAL_ABI,
          functionName: "buy",
          args: [body.tokenAddress as `0x${string}`],
          value: bnbAmount,
        });
      } else {
        const tokenAmount = parseEther(body.amount);
        txHash = await walletClient.writeContract({
          address: portalAddress as `0x${string}`,
          abi: PORTAL_ABI,
          functionName: "sell",
          args: [body.tokenAddress as `0x${string}`, tokenAmount],
        });
      }
    }

    console.log(`[bnb-swap] ${body.action} tx: ${txHash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      confirmations: 1,
      timeout: 30_000,
    });

    // ── Record trade in alpha_trades ──
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      await supabase.from("alpha_trades").insert({
        token_mint: body.tokenAddress,
        wallet_address: body.userWallet,
        trade_type: body.action,
        amount_sol: parseFloat(body.amount), // BNB amount (field is generic)
        amount_tokens: parseFloat(estimatedOutput) || 0,
        tx_hash: txHash,
        chain: "bnb",
      });
    } catch (recordErr) {
      console.error("[bnb-swap] Failed to record trade:", recordErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        txHash,
        action: body.action,
        tokenAddress: body.tokenAddress,
        graduated: isGraduated,
        route: isGraduated ? "openocean" : "portal",
        estimatedOutput,
        explorerUrl: `https://bscscan.com/tx/${txHash}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bnb-swap] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Swap failed",
        details: error instanceof Error ? error.stack : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
