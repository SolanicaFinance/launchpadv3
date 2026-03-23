import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import {
  createPublicClient,
  http,
  parseEther,
  formatEther,
  parseAbi,
  encodeFunctionData,
  numberToHex,
} from "https://esm.sh/viem@2.45.1";
import { bsc } from "https://esm.sh/viem@2.45.1/chains";
import {
  getPrivyUser,
  findEvmEmbeddedWallet,
  evmSendTransaction,
} from "../_shared/privy-server-wallet.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Contract addresses ──
const FOURMEME_TOKEN_MANAGER = "0x5c952063c7fc8610FFDB798152D69F0B9550762b";
const FOURMEME_HELPER3 = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034";
const DEFAULT_PORTAL_ADDRESS = "0x6e5C231A75562422C41acb55A4b0112a07DfA782";

// ── PancakeSwap V2 ──
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";

const PANCAKE_ROUTER_ABI = parseAbi([
  "function getAmountsOut(uint amountIn, address[] calldata path) external view returns (uint[] memory amounts)",
  "function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable",
  "function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external",
]);

// ── Four.meme ABI (official from docs) ──
// TokenManager2 (V2) methods
const FOURMEME_MANAGER_ABI = parseAbi([
  "function buyTokenAMAP(address token, uint256 funds, uint256 minAmount) external payable",
  "function buyTokenAMAP(address token, address to, uint256 funds, uint256 minAmount) external payable",
  "function sellToken(address token, uint256 amount) external",
]);

// TokenManagerHelper3 (V3) methods — CORRECT return types from official docs
const FOURMEME_HELPER_ABI = parseAbi([
  "function getTokenInfo(address token) external view returns (uint256 version, address tokenManager, address quote, uint256 lastPrice, uint256 tradingFeeRate, uint256 minTradingFee, uint256 launchTime, uint256 offers, uint256 maxOffers, uint256 funds, uint256 maxFunds, bool liquidityAdded)",
  "function tryBuy(address token, uint256 amount, uint256 funds) external view returns (address tokenManager, address quote, uint256 estimatedAmount, uint256 estimatedCost, uint256 estimatedFee, uint256 amountMsgValue, uint256 amountApproval, uint256 amountFunds)",
  "function trySell(address token, uint256 amount) external view returns (address tokenManager, address quote, uint256 funds, uint256 fee)",
]);

// ── SaturnPortal bonding curve ABI ──
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

// ── ERC-20 ABI ──
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
]);

const ALCHEMY_KEY = Deno.env.get("ALCHEMY_BSC_API_KEY");
const BSC_RPC = ALCHEMY_KEY
  ? `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : "https://bsc-dataseed.binance.org";

interface SwapRequest {
  tokenAddress: string;
  action: "buy" | "sell";
  amount: string;
  userWallet: string;
  privyUserId?: string;
  slippage?: number;
}

type SwapRoute = "portal" | "fourmeme" | "pancakeswap";

// ── Four.meme token info cache ──
interface FourMemeTokenInfo {
  version: number;
  tokenManager: string;
  quote: string;
  liquidityAdded: boolean;
  offers: bigint;
  maxOffers: bigint;
  funds: bigint;
  maxFunds: bigint;
}

async function getFourMemeTokenInfo(
  tokenAddress: string,
  publicClient: any
): Promise<FourMemeTokenInfo | null> {
  try {
    const result = await publicClient.readContract({
      address: FOURMEME_HELPER3 as `0x${string}`,
      abi: FOURMEME_HELPER_ABI,
      functionName: "getTokenInfo",
      args: [tokenAddress as `0x${string}`],
    });
    const [version, tokenManager, quote, , , , , offers, maxOffers, funds, maxFunds, liquidityAdded] = result;
    console.log(
      `[bnb-swap] Four.meme getTokenInfo: version=${version} manager=${tokenManager} quote=${quote} liquidityAdded=${liquidityAdded} offers=${offers} maxOffers=${maxOffers} funds=${funds}/${maxFunds}`
    );
    return {
      version: Number(version),
      tokenManager: tokenManager as string,
      quote: quote as string,
      liquidityAdded: liquidityAdded as boolean,
      offers: offers as bigint,
      maxOffers: maxOffers as bigint,
      funds: funds as bigint,
      maxFunds: maxFunds as bigint,
    };
  } catch (e) {
    console.log(`[bnb-swap] getTokenInfo failed (not a Four.meme token): ${(e as Error).message?.slice(0, 80)}`);
    return null;
  }
}

// ── Route Resolver ──
async function resolveTokenRoute(
  tokenAddress: string,
  publicClient: any,
  portalAddress: string | null
): Promise<{ route: SwapRoute; graduated: boolean; fourMemeInfo?: FourMemeTokenInfo }> {
  // 1) Check SaturnPortal (local tokens)
  if (portalAddress) {
    try {
      const tokenInfo = await publicClient.readContract({
        address: portalAddress as `0x${string}`,
        abi: PORTAL_ABI,
        functionName: "getTokenInfo",
        args: [tokenAddress as `0x${string}`],
      });
      const [, , , , , graduated] = tokenInfo;
      if (!graduated) {
        console.log(`[bnb-swap] Route: SaturnPortal (bonding curve)`);
        return { route: "portal", graduated: false };
      }
      console.log(`[bnb-swap] Route: PancakeSwap (graduated from portal)`);
      return { route: "pancakeswap", graduated: true };
    } catch {
      // Not on our portal, continue checking
    }
  }

  // 2) Check Four.meme via getTokenInfo (correct method — liquidityAdded is a return value here)
  const fourMemeInfo = await getFourMemeTokenInfo(tokenAddress, publicClient);
  if (fourMemeInfo && fourMemeInfo.tokenManager !== "0x0000000000000000000000000000000000000000") {
    if (fourMemeInfo.liquidityAdded) {
      console.log(`[bnb-swap] Route: PancakeSwap (Four.meme token migrated, liquidityAdded=true)`);
      return { route: "pancakeswap", graduated: true, fourMemeInfo };
    }
    console.log(`[bnb-swap] Route: Four.meme (bonding curve, version=${fourMemeInfo.version}, manager=${fourMemeInfo.tokenManager})`);
    return { route: "fourmeme", graduated: false, fourMemeInfo };
  }

  // 3) Default to PancakeSwap (graduated/DEX token)
  console.log(`[bnb-swap] Route: PancakeSwap (default/DEX)`);
  return { route: "pancakeswap", graduated: true };
}

// ── PancakeSwap V2 Buy ──
async function executePancakeSwapBuy(
  walletId: string,
  walletAddress: string,
  tokenAddress: string,
  bnbAmount: bigint,
  slippage: number,
  publicClient: any
): Promise<{ txHash: string; estimatedOutput: string }> {
  const path = [WBNB as `0x${string}`, tokenAddress as `0x${string}`];

  let amountOutMin = 0n;
  try {
    const amounts = await publicClient.readContract({
      address: PANCAKE_ROUTER as `0x${string}`,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [bnbAmount, path],
    });
    const expectedOut = amounts[1];
    amountOutMin = (expectedOut * BigInt(100 - slippage)) / 100n;
    console.log(`[bnb-swap] PancakeSwap quote: ${expectedOut.toString()} tokens, min after ${slippage}% slippage: ${amountOutMin.toString()}`);
  } catch (e) {
    console.log(`[bnb-swap] PancakeSwap getAmountsOut failed: ${(e as Error).message?.slice(0, 100)}`);
    throw new NoPancakeSwapLiquidityError();
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const callData = encodeFunctionData({
    abi: PANCAKE_ROUTER_ABI,
    functionName: "swapExactETHForTokensSupportingFeeOnTransferTokens",
    args: [amountOutMin, path, walletAddress as `0x${string}`, deadline],
  });

  const txHash = await evmSendTransaction(walletId, {
    to: PANCAKE_ROUTER,
    data: callData,
    value: numberToHex(bnbAmount),
    gas_limit: numberToHex(350000n),
  });

  return { txHash, estimatedOutput: amountOutMin.toString() };
}

// ── PancakeSwap V2 Sell ──
async function executePancakeSwapSell(
  walletId: string,
  walletAddress: string,
  tokenAddress: string,
  tokenAmount: bigint,
  slippage: number,
  publicClient: any
): Promise<{ txHash: string; estimatedOutput: string }> {
  const path = [tokenAddress as `0x${string}`, WBNB as `0x${string}`];

  // Approve router
  const currentAllowance = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletAddress as `0x${string}`, PANCAKE_ROUTER as `0x${string}`],
  });

  if (currentAllowance < tokenAmount) {
    console.log(`[bnb-swap] Approving PancakeSwap router for ${tokenAddress}`);
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [PANCAKE_ROUTER as `0x${string}`, tokenAmount * 2n],
    });
    const approveHash = await evmSendTransaction(walletId, {
      to: tokenAddress,
      data: approveData,
    });
    console.log(`[bnb-swap] Approval tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({
      hash: approveHash as `0x${string}`,
      confirmations: 1,
      timeout: 20_000,
    });
  }

  let amountOutMin = 0n;
  try {
    const amounts = await publicClient.readContract({
      address: PANCAKE_ROUTER as `0x${string}`,
      abi: PANCAKE_ROUTER_ABI,
      functionName: "getAmountsOut",
      args: [tokenAmount, path],
    });
    const expectedOut = amounts[1];
    amountOutMin = (expectedOut * BigInt(100 - slippage)) / 100n;
    console.log(`[bnb-swap] PancakeSwap sell quote: ${formatEther(expectedOut)} BNB, min: ${formatEther(amountOutMin)} BNB`);
  } catch (e) {
    console.log(`[bnb-swap] PancakeSwap sell getAmountsOut failed: ${(e as Error).message?.slice(0, 100)}`);
    throw new NoPancakeSwapLiquidityError();
  }

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);
  const callData = encodeFunctionData({
    abi: PANCAKE_ROUTER_ABI,
    functionName: "swapExactTokensForETHSupportingFeeOnTransferTokens",
    args: [tokenAmount, amountOutMin, path, walletAddress as `0x${string}`, deadline],
  });

  const txHash = await evmSendTransaction(walletId, {
    to: PANCAKE_ROUTER,
    data: callData,
    gas_limit: numberToHex(350000n),
  });

  return { txHash, estimatedOutput: formatEther(amountOutMin) };
}

// ── Four.meme Buy (using correct tryBuy with 8 return values) ──
async function executeFourMemeBuy(
  walletId: string,
  walletAddress: string,
  tokenAddress: string,
  bnbAmount: bigint,
  slippage: number,
  publicClient: any,
  fourMemeInfo?: FourMemeTokenInfo
): Promise<{ txHash: string; estimatedOutput: string }> {
  // Step 1: Get quote via tryBuy (spend X BNB → get tokens)
  const result = await publicClient.readContract({
    address: FOURMEME_HELPER3 as `0x${string}`,
    abi: FOURMEME_HELPER_ABI,
    functionName: "tryBuy",
    args: [tokenAddress as `0x${string}`, 0n, bnbAmount],
  });

  // Official return: (tokenManager, quote, estimatedAmount, estimatedCost, estimatedFee, amountMsgValue, amountApproval, amountFunds)
  const [tokenManager, quote, estimatedAmount, estimatedCost, estimatedFee, amountMsgValue, amountApproval, amountFunds] = result;

  console.log(`[bnb-swap] Four.meme tryBuy result: tokenManager=${tokenManager} quote=${quote} estimatedAmount=${estimatedAmount} estimatedCost=${estimatedCost} estimatedFee=${estimatedFee} amountMsgValue=${amountMsgValue} amountApproval=${amountApproval} amountFunds=${amountFunds}`);

  if (!tokenManager || tokenManager === "0x0000000000000000000000000000000000000000") {
    throw new FourMemeError("Token manager not found for this token", "MANAGER_NOT_FOUND");
  }

  if (estimatedAmount <= 0n) {
    throw new FourMemeError("No tokens would be received for this amount", "ZERO_OUTPUT");
  }

  if (amountMsgValue <= 0n) {
    throw new FourMemeError("Invalid msg.value from quote — token may not be tradeable", "INVALID_MSG_VALUE");
  }

  // Step 2: Calculate minAmount with slippage
  const minAmount = (estimatedAmount * BigInt(100 - slippage)) / 100n;
  console.log(`[bnb-swap] Four.meme buy: minAmount=${minAmount} (${slippage}% slippage from ${estimatedAmount})`);

  // Step 3: If quote is BNB (address(0)), use buyTokenAMAP with msg.value
  // If quote is ERC20, need to approve first (amountApproval)
  const isNativeQuote = quote === "0x0000000000000000000000000000000000000000";
  const targetManager = tokenManager as string;

  if (!isNativeQuote && amountApproval > 0n) {
    // ERC20 quote — approve the token manager
    console.log(`[bnb-swap] Four.meme: ERC20 quote ${quote}, approving ${amountApproval} for ${targetManager}`);
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [targetManager as `0x${string}`, amountApproval],
    });
    const approveHash = await evmSendTransaction(walletId, {
      to: quote as string,
      data: approveData,
    });
    console.log(`[bnb-swap] ERC20 approval tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({
      hash: approveHash as `0x${string}`,
      confirmations: 1,
      timeout: 20_000,
    });
  }

  // Step 4: Build buyTokenAMAP call
  // Use the 4-arg version: buyTokenAMAP(token, to, funds, minAmount) with msg.value = amountMsgValue
  const callData = encodeFunctionData({
    abi: FOURMEME_MANAGER_ABI,
    functionName: "buyTokenAMAP",
    args: [
      tokenAddress as `0x${string}`,
      walletAddress as `0x${string}`,
      amountFunds,  // funds parameter from tryBuy
      minAmount,
    ],
  });

  // Step 5: Simulate first
  try {
    await publicClient.call({
      to: targetManager as `0x${string}`,
      data: callData,
      value: amountMsgValue,
      account: walletAddress as `0x${string}`,
    });
    console.log(`[bnb-swap] Four.meme buy simulation: SUCCESS`);
  } catch (simErr) {
    const simMsg = (simErr as Error).message?.slice(0, 200) || "unknown";
    console.log(`[bnb-swap] Four.meme buy simulation FAILED: ${simMsg}`);
    // Extract revert reason
    const revertMatch = simMsg.match(/reverted with the following reason:\s*(.+)/i) || simMsg.match(/revert(?:ed)?\s*[:.]?\s*(.+)/i);
    const revertReason = revertMatch?.[1]?.trim() || simMsg.slice(0, 100);
    throw new FourMemeError(`Transaction would revert: ${revertReason}`, "SIMULATION_FAILED");
  }

  // Step 6: Execute
  const txHash = await evmSendTransaction(walletId, {
    to: targetManager,
    data: callData,
    value: numberToHex(amountMsgValue),
    gas_limit: numberToHex(500000n),
  });

  return { txHash, estimatedOutput: estimatedAmount.toString() };
}

// ── Four.meme Sell ──
async function executeFourMemeSell(
  walletId: string,
  walletAddress: string,
  tokenAddress: string,
  tokenAmount: bigint,
  slippage: number,
  publicClient: any,
  fourMemeInfo?: FourMemeTokenInfo
): Promise<{ txHash: string; estimatedOutput: string }> {
  // Step 1: Get sell quote via trySell
  let sellQuoteFunds = 0n;
  let targetManager = fourMemeInfo?.tokenManager || FOURMEME_TOKEN_MANAGER;
  try {
    const result = await publicClient.readContract({
      address: FOURMEME_HELPER3 as `0x${string}`,
      abi: FOURMEME_HELPER_ABI,
      functionName: "trySell",
      args: [tokenAddress as `0x${string}`, tokenAmount],
    });
    const [tokenManager, , funds, fee] = result;
    sellQuoteFunds = funds as bigint;
    targetManager = (tokenManager as string) || targetManager;
    console.log(`[bnb-swap] Four.meme trySell: manager=${tokenManager} funds=${funds} fee=${fee}`);
  } catch (e) {
    console.log(`[bnb-swap] Four.meme trySell failed: ${(e as Error).message?.slice(0, 100)}`);
    // Continue with sell anyway — trySell is just for estimation
  }

  // Step 2: Approve token manager
  const currentAllowance = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletAddress as `0x${string}`, targetManager as `0x${string}`],
  });

  if (currentAllowance < tokenAmount) {
    console.log(`[bnb-swap] Approving Four.meme TokenManager ${targetManager} for ${tokenAddress}`);
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [targetManager as `0x${string}`, tokenAmount * 2n],
    });
    const approveHash = await evmSendTransaction(walletId, {
      to: tokenAddress,
      data: approveData,
    });
    console.log(`[bnb-swap] Approval tx: ${approveHash}`);
    await publicClient.waitForTransactionReceipt({
      hash: approveHash as `0x${string}`,
      confirmations: 1,
      timeout: 20_000,
    });
  }

  // Step 3: Build sellToken call
  const callData = encodeFunctionData({
    abi: FOURMEME_MANAGER_ABI,
    functionName: "sellToken",
    args: [tokenAddress as `0x${string}`, tokenAmount],
  });

  // Step 4: Simulate
  try {
    await publicClient.call({
      to: targetManager as `0x${string}`,
      data: callData,
      account: walletAddress as `0x${string}`,
    });
    console.log(`[bnb-swap] Four.meme sell simulation: SUCCESS`);
  } catch (simErr) {
    const simMsg = (simErr as Error).message?.slice(0, 200) || "unknown";
    console.log(`[bnb-swap] Four.meme sell simulation FAILED: ${simMsg}`);
    const revertMatch = simMsg.match(/reverted with the following reason:\s*(.+)/i) || simMsg.match(/revert(?:ed)?\s*[:.]?\s*(.+)/i);
    const revertReason = revertMatch?.[1]?.trim() || simMsg.slice(0, 100);
    throw new FourMemeError(`Sell would revert: ${revertReason}`, "SIMULATION_FAILED");
  }

  // Step 5: Execute
  const txHash = await evmSendTransaction(walletId, {
    to: targetManager,
    data: callData,
    gas_limit: numberToHex(350000n),
  });

  return { txHash, estimatedOutput: sellQuoteFunds > 0n ? formatEther(sellQuoteFunds) : "0" };
}

// ── Portal Buy/Sell ──
async function executePortalSwap(
  walletId: string,
  portalAddress: string,
  tokenAddress: string,
  action: "buy" | "sell",
  amount: string
): Promise<string> {
  if (action === "buy") {
    const callData = encodeFunctionData({
      abi: PORTAL_ABI,
      functionName: "buy",
      args: [tokenAddress as `0x${string}`],
    });
    return await evmSendTransaction(walletId, {
      to: portalAddress,
      data: callData,
      value: numberToHex(parseEther(amount)),
    });
  } else {
    const callData = encodeFunctionData({
      abi: PORTAL_ABI,
      functionName: "sell",
      args: [tokenAddress as `0x${string}`, parseEther(amount)],
    });
    return await evmSendTransaction(walletId, {
      to: portalAddress,
      data: callData,
    });
  }
}

// ── Error helpers ──
class NoPancakeSwapLiquidityError extends Error {
  code = "NO_PANCAKESWAP_LIQUIDITY";
  constructor() {
    super("No liquidity on PancakeSwap V2 for this pair");
    this.name = "NoPancakeSwapLiquidityError";
  }
}

class FourMemeError extends Error {
  code: string;
  constructor(message: string, code: string) {
    super(message);
    this.name = "FourMemeError";
    this.code = code;
  }
}

function isNoPancakeSwapLiquidityError(error: unknown): boolean {
  const e = error as {
    code?: string;
    message?: string;
    shortMessage?: string;
    details?: string;
    cause?: { message?: string; shortMessage?: string };
  };

  if (e?.code === "NO_PANCAKESWAP_LIQUIDITY") return true;

  const combined = [
    e?.message,
    e?.shortMessage,
    e?.details,
    e?.cause?.message,
    e?.cause?.shortMessage,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return combined.includes("no liquidity on pancakeswap") || combined.includes("insufficient_liquidity");
}

// ── Wallet Resolution ──
async function resolveWallet(
  body: SwapRequest,
  supabase: any
): Promise<{ walletId: string; walletAddress: string }> {
  let walletId: string | null = null;
  let walletAddress: string = body.userWallet;

  const isServerSignableEvmWallet = (account: any) =>
    account?.type === "wallet" &&
    account?.chain_type === "ethereum" &&
    (account?.wallet_client_type === "privy" || account?.connector_type === "embedded");

  if (body.privyUserId) {
    try {
      const user = await getPrivyUser(body.privyUserId);
      const frontendAddr = body.userWallet?.toLowerCase();
      const allEvmWallets = user.linked_accounts.filter(
        (a: any) => a.type === "wallet" && a.chain_type === "ethereum"
      );
      const signableEvmWallets = allEvmWallets.filter(isServerSignableEvmWallet);
      const matchingWallet = allEvmWallets.find(
        (w: any) => w.address?.toLowerCase() === frontendAddr
      );
      if (matchingWallet && matchingWallet.id && isServerSignableEvmWallet(matchingWallet)) {
        walletId = matchingWallet.id;
        walletAddress = matchingWallet.address;
        console.log(`[bnb-swap] Found Privy wallet matching frontend address: ${walletAddress} (id: ${walletId})`);
      } else {
        const evmWallet = findEvmEmbeddedWallet(user);
        if (evmWallet) {
          walletId = evmWallet.walletId;
          walletAddress = evmWallet.address;
          console.log(`[bnb-swap] Using embedded EVM wallet: ${walletAddress} (id: ${walletId})`);
        }
      }

      if (!walletId && matchingWallet && matchingWallet.id && !isServerSignableEvmWallet(matchingWallet)) {
        throw new Error(
          `Connected wallet ${matchingWallet.address} is external and cannot be used for server-executed swaps. Please use your embedded wallet${signableEvmWallets[0]?.address ? ` (${signableEvmWallets[0].address})` : ""}.`
        );
      }

      if (walletId) {
        await supabase
          .from("profiles")
          .update({ privy_evm_wallet_id: walletId, evm_wallet_address: walletAddress })
          .eq("privy_did", body.privyUserId);
      }
    } catch (e) {
      console.log(`[bnb-swap] Fresh Privy lookup failed, trying cached: ${(e as Error).message?.slice(0, 80)}`);
      const { data: profile } = await supabase
        .from("profiles")
        .select("privy_evm_wallet_id, evm_wallet_address")
        .eq("privy_did", body.privyUserId)
        .maybeSingle();
      if (profile?.privy_evm_wallet_id) {
        walletId = profile.privy_evm_wallet_id;
        walletAddress = profile.evm_wallet_address || body.userWallet;
      }
    }
  } else {
    const { data: profile } = await supabase
      .from("profiles")
      .select("privy_did, privy_evm_wallet_id")
      .eq("evm_wallet_address", body.userWallet)
      .maybeSingle();
    if (profile?.privy_evm_wallet_id) {
      walletId = profile.privy_evm_wallet_id;
    } else if (profile?.privy_did) {
      const user = await getPrivyUser(profile.privy_did);
      const evmWallet = findEvmEmbeddedWallet(user);
      if (evmWallet) {
        walletId = evmWallet.walletId;
        walletAddress = evmWallet.address;
        await supabase
          .from("profiles")
          .update({ privy_evm_wallet_id: walletId })
          .eq("privy_did", profile.privy_did);
      }
    }
  }

  if (!walletId) throw new Error("Could not resolve EVM wallet. Please pass privyUserId.");
  return { walletId, walletAddress };
}

// ── Main Handler ──
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Resolve wallet
    let walletId: string;
    let walletAddress: string;
    try {
      ({ walletId, walletAddress } = await resolveWallet(body, supabase));
    } catch (e) {
      return new Response(
        JSON.stringify({ error: (e as Error).message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[bnb-swap] Resolved wallet: ${walletAddress} (id: ${walletId}), action: ${body.action}, amount: ${body.amount}`);

    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
    const slippage = body.slippage ?? 3;
    const portalAddress = Deno.env.get("BNB_PORTAL_ADDRESS") || DEFAULT_PORTAL_ADDRESS;

    // Resolve route
    const { route, graduated, fourMemeInfo } = await resolveTokenRoute(body.tokenAddress, publicClient, portalAddress);

    // Balance check for buys
    if (body.action === "buy") {
      const resolvedBalance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
      const frontendAddr = body.userWallet?.toLowerCase();
      const resolvedAddr = walletAddress?.toLowerCase();

      let balance = resolvedBalance;
      if (frontendAddr && frontendAddr !== resolvedAddr && resolvedBalance === 0n) {
        console.log(`[bnb-swap] Resolved wallet has 0 balance, checking frontend wallet ${body.userWallet}`);
        const frontendBalance = await publicClient.getBalance({ address: body.userWallet as `0x${string}` });
        if (frontendBalance > resolvedBalance) {
          balance = frontendBalance;
          console.log(`[bnb-swap] Frontend wallet has balance: ${formatEther(frontendBalance)} BNB. Re-resolving wallet.`);
          if (body.privyUserId) {
            try {
              const user = await getPrivyUser(body.privyUserId);
              const allEvmWallets = user.linked_accounts.filter(
                (a: any) => a.type === "wallet" && a.chain_type === "ethereum"
              );
              const signableEvmWallets = allEvmWallets.filter(isServerSignableEvmWallet);
              const matchingWallet = allEvmWallets.find(
                (w: any) => w.address?.toLowerCase() === frontendAddr
              );
              if (matchingWallet && matchingWallet.id && isServerSignableEvmWallet(matchingWallet)) {
                walletId = matchingWallet.id;
                walletAddress = matchingWallet.address;
                console.log(`[bnb-swap] Re-resolved to matching Privy wallet: ${walletAddress} (id: ${walletId})`);
              } else {
                const embeddedWallet = findEvmEmbeddedWallet(user);
                if (embeddedWallet) {
                  walletId = embeddedWallet.walletId;
                  walletAddress = embeddedWallet.address;
                }
              }

              if (matchingWallet && matchingWallet.id && !isServerSignableEvmWallet(matchingWallet)) {
                console.log(`[bnb-swap] Frontend wallet ${matchingWallet.address} is external; keeping embedded/server-signable wallet ${signableEvmWallets[0]?.address ?? walletAddress}`);
              }
            } catch (reResolveErr) {
              console.log(`[bnb-swap] Re-resolve failed: ${(reResolveErr as Error).message?.slice(0, 100)}`);
            }
          }
          if (body.privyUserId) {
            await supabase
              .from("profiles")
              .update({ privy_evm_wallet_id: walletId, evm_wallet_address: walletAddress })
              .eq("privy_did", body.privyUserId);
          }
          const updatedBalance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
          balance = updatedBalance > 0n ? updatedBalance : frontendBalance;
        }
      }

      const bnbAmount = parseEther(body.amount);
      if (balance < bnbAmount + parseEther("0.002")) {
        return new Response(
          JSON.stringify({ error: `Insufficient BNB. Balance: ${formatEther(balance)}`, resolvedWallet: walletAddress, frontendWallet: body.userWallet }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let txHash: string;
    let estimatedOutput = "0";
    let executedRoute = route;

    // ── Execute based on route ──
    if (route === "portal") {
      console.log(`[bnb-swap] Executing via SaturnPortal: ${body.action}`);
      txHash = await executePortalSwap(walletId, portalAddress, body.tokenAddress, body.action, body.amount);

    } else if (route === "fourmeme") {
      console.log(`[bnb-swap] Executing via Four.meme: ${body.action}`);
      try {
        if (body.action === "buy") {
          const result = await executeFourMemeBuy(
            walletId, walletAddress, body.tokenAddress,
            parseEther(body.amount), slippage, publicClient, fourMemeInfo
          );
          txHash = result.txHash;
          estimatedOutput = result.estimatedOutput;
        } else {
          const result = await executeFourMemeSell(
            walletId, walletAddress, body.tokenAddress,
            parseEther(body.amount), slippage, publicClient, fourMemeInfo
          );
          txHash = result.txHash;
          estimatedOutput = result.estimatedOutput;
        }
      } catch (fourErr) {
        // If it's a specific Four.meme error, return it directly — don't mask it
        if (fourErr instanceof FourMemeError) {
          console.log(`[bnb-swap] Four.meme error (${fourErr.code}): ${fourErr.message}`);
          return new Response(
            JSON.stringify({
              error: fourErr.message,
              route: "fourmeme",
              reason: fourErr.code,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generic Four.meme failure — try PancakeSwap fallback only if token might have migrated
        console.log(`[bnb-swap] Four.meme failed, trying PancakeSwap fallback: ${(fourErr as Error).message?.slice(0, 100)}`);
        try {
          if (body.action === "buy") {
            const result = await executePancakeSwapBuy(
              walletId, walletAddress, body.tokenAddress, parseEther(body.amount), slippage, publicClient
            );
            txHash = result.txHash;
            estimatedOutput = result.estimatedOutput;
          } else {
            const result = await executePancakeSwapSell(
              walletId, walletAddress, body.tokenAddress, parseEther(body.amount), slippage, publicClient
            );
            txHash = result.txHash;
            estimatedOutput = result.estimatedOutput;
          }
          executedRoute = "pancakeswap";
        } catch (pancakeFallbackErr) {
          if (isNoPancakeSwapLiquidityError(pancakeFallbackErr)) {
            return new Response(
              JSON.stringify({
                error: `Four.meme swap failed: ${(fourErr as Error).message?.slice(0, 150)}. PancakeSwap also has no liquidity.`,
                route: "fourmeme",
                reason: "FOURMEME_FAILED_NO_PANCAKE_FALLBACK",
                fourMemeError: (fourErr as Error).message?.slice(0, 200),
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw pancakeFallbackErr;
        }
      }

    } else {
      // PancakeSwap for graduated/DEX tokens
      console.log(`[bnb-swap] Executing via PancakeSwap V2: ${body.action}`);
      try {
        if (body.action === "buy") {
          const result = await executePancakeSwapBuy(
            walletId, walletAddress, body.tokenAddress, parseEther(body.amount), slippage, publicClient
          );
          txHash = result.txHash;
          estimatedOutput = result.estimatedOutput;
        } else {
          const result = await executePancakeSwapSell(
            walletId, walletAddress, body.tokenAddress, parseEther(body.amount), slippage, publicClient
          );
          txHash = result.txHash;
          estimatedOutput = result.estimatedOutput;
        }
      } catch (e) {
        if (isNoPancakeSwapLiquidityError(e)) {
          // PancakeSwap has no pair → try Four.meme as fallback
          console.log(`[bnb-swap] PancakeSwap no liquidity, trying Four.meme fallback...`);
          try {
            if (body.action === "buy") {
              const result = await executeFourMemeBuy(
                walletId, walletAddress, body.tokenAddress,
                parseEther(body.amount), slippage, publicClient
              );
              txHash = result.txHash;
              estimatedOutput = result.estimatedOutput;
            } else {
              const result = await executeFourMemeSell(
                walletId, walletAddress, body.tokenAddress,
                parseEther(body.amount), slippage, publicClient
              );
              txHash = result.txHash;
              estimatedOutput = result.estimatedOutput;
            }
            executedRoute = "fourmeme";
            console.log(`[bnb-swap] Four.meme fallback succeeded: ${txHash}`);
          } catch (fourMemeErr) {
            const fmMsg = fourMemeErr instanceof FourMemeError
              ? `${fourMemeErr.message} (${fourMemeErr.code})`
              : (fourMemeErr as Error).message?.slice(0, 150);
            console.log(`[bnb-swap] Four.meme fallback also failed: ${fmMsg}`);
            return new Response(
              JSON.stringify({
                error: `No PancakeSwap liquidity and Four.meme failed: ${fmMsg}`,
                route: "pancakeswap",
                reason: fourMemeErr instanceof FourMemeError ? fourMemeErr.code : "FOURMEME_FALLBACK_FAILED",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          throw e;
        }
      }
    }

    console.log(`[bnb-swap] ${body.action} tx: ${txHash!} via ${executedRoute}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash! as `0x${string}`,
      confirmations: 1,
      timeout: 30_000,
    });

    const txStatus = receipt.status === "success" ? "confirmed" : "failed";
    console.log(`[bnb-swap] TX status: ${txStatus}, gas used: ${receipt.gasUsed}`);

    // Record trade to alpha_trades
    try {
      let bnbTokenName: string | null = null;
      let bnbTokenTicker: string | null = null;
      const { data: funToken } = await supabase
        .from("fun_tokens")
        .select("name, ticker")
        .eq("evm_token_address", body.tokenAddress)
        .single();
      if (funToken) {
        bnbTokenName = funToken.name;
        bnbTokenTicker = funToken.ticker;
      } else {
        const { data: clawToken } = await supabase
          .from("claw_tokens")
          .select("name, ticker")
          .ilike("mint_address", body.tokenAddress)
          .single();
        if (clawToken) {
          bnbTokenName = clawToken.name;
          bnbTokenTicker = clawToken.ticker;
        }
      }

      let bnbTraderName: string | null = null;
      let bnbTraderAvatar: string | null = null;
      const { data: traderProfile } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("wallet_address", walletAddress)
        .single();
      if (traderProfile) {
        bnbTraderName = traderProfile.display_name;
        bnbTraderAvatar = traderProfile.avatar_url;
      }

      await supabase.from("alpha_trades").upsert({
        token_mint: body.tokenAddress,
        wallet_address: walletAddress,
        trade_type: body.action,
        amount_sol: parseFloat(body.amount),
        amount_tokens: parseFloat(estimatedOutput) || 0,
        tx_hash: txHash!,
        chain: "bnb",
        token_name: bnbTokenName,
        token_ticker: bnbTokenTicker,
        trader_display_name: bnbTraderName,
        trader_avatar_url: bnbTraderAvatar,
      }, { onConflict: "tx_hash" });
      console.log(`[bnb-swap] Trade recorded to alpha_trades: ${txHash!}`);
    } catch (recordErr) {
      console.error("[bnb-swap] Failed to record trade:", recordErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        txHash: txHash!,
        action: body.action,
        tokenAddress: body.tokenAddress,
        graduated,
        route: executedRoute,
        estimatedOutput,
        explorerUrl: `https://bscscan.com/tx/${txHash!}`,
        txStatus,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[bnb-swap] Error:", error);

    if (isNoPancakeSwapLiquidityError(error)) {
      return new Response(
        JSON.stringify({
          error: "No liquidity found for this token on PancakeSwap or Four.meme.",
          route: "unknown",
          reason: "NO_LIQUIDITY",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Swap failed",
        details: error instanceof Error ? error.stack?.slice(0, 300) : undefined,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
