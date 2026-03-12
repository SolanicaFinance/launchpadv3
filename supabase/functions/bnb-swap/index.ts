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
    "authorization, x-client-info, apikey, content-type",
};

// ── Contract addresses ──
const FOURMEME_TOKEN_MANAGER = "0x5c952063c7fc8610FFDB798152D69F0B9550762b";
const FOURMEME_HELPER3 = "0xF251F83e40a78868FcfA3FA4599Dad6494E46034";
const DEFAULT_PORTAL_ADDRESS = "0x6e5C231A75562422C41acb55A4b0112a07DfA782"; // Saturn portal fallback

// ── Four.meme ABI ──
const FOURMEME_MANAGER_ABI = parseAbi([
  "function buyTokenAMAP(address token) external payable",
  "function sellToken(address token, uint256 amount) external",
]);

const FOURMEME_HELPER_ABI = parseAbi([
  "function tryBuy(address token, uint256 amount, uint256 funds) external view returns (address tokenManager, address quote, uint256 estimatedAmount, uint256 estimatedCost, uint256 estimatedFee, uint256 fundRequirement, uint256 fundAsParameter)",
  "function liquidityAdded(address token) external view returns (bool)",
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
]);

const OPENOCEAN_API = "https://open-api.openocean.finance/v4/bsc";
const BNB_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
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

type SwapRoute = "portal" | "fourmeme" | "openocean";

// ── Route Resolver ──
async function resolveTokenRoute(
  tokenAddress: string,
  publicClient: any,
  portalAddress: string | null
): Promise<{ route: SwapRoute; graduated: boolean }> {
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
      // Graduated from our portal → use OpenOcean
      console.log(`[bnb-swap] Route: OpenOcean (graduated from portal)`);
      return { route: "openocean", graduated: true };
    } catch {
      // Not on our portal, continue checking
    }
  }

  // 2) Check Four.meme bonding curve
  try {
    const result = await publicClient.readContract({
      address: FOURMEME_HELPER3 as `0x${string}`,
      abi: FOURMEME_HELPER_ABI,
      functionName: "tryBuy",
      args: [
        tokenAddress as `0x${string}`,
        parseEther("1"), // try buying 1 token worth
        parseEther("0.01"), // with 0.01 BNB
      ],
    });
    const [tokenManager] = result;
    // If tokenManager is non-zero, this token is on Four.meme
    if (tokenManager && tokenManager !== "0x0000000000000000000000000000000000000000") {
      // Check if liquidity has already been added (migrated to PancakeSwap)
      try {
        const migrated = await publicClient.readContract({
          address: FOURMEME_HELPER3 as `0x${string}`,
          abi: FOURMEME_HELPER_ABI,
          functionName: "liquidityAdded",
          args: [tokenAddress as `0x${string}`],
        });
        if (migrated) {
          console.log(`[bnb-swap] Route: OpenOcean (Four.meme token migrated to PancakeSwap)`);
          return { route: "openocean", graduated: true };
        }
      } catch (e) {
        console.log(`[bnb-swap] liquidityAdded check failed, assuming not migrated: ${(e as Error).message?.slice(0, 60)}`);
      }
      console.log(`[bnb-swap] Route: Four.meme (bonding curve, manager: ${tokenManager})`);
      return { route: "fourmeme", graduated: false };
    }
  } catch (e) {
    console.log(`[bnb-swap] Token not on Four.meme: ${(e as Error).message?.slice(0, 80)}`);
  }

  // 3) Default to OpenOcean (migrated/DEX token)
  console.log(`[bnb-swap] Route: OpenOcean (default/DEX)`);
  return { route: "openocean", graduated: true };
}

// ── Four.meme Buy ──
async function executeFourMemeBuy(
  walletId: string,
  tokenAddress: string,
  bnbAmount: bigint
): Promise<string> {
  const callData = encodeFunctionData({
    abi: FOURMEME_MANAGER_ABI,
    functionName: "buyTokenAMAP",
    args: [tokenAddress as `0x${string}`],
  });

  return await evmSendTransaction(walletId, {
    to: FOURMEME_TOKEN_MANAGER,
    data: callData,
    value: numberToHex(bnbAmount),
    gas: numberToHex(300000n),
  });
}

// ── Four.meme Sell ──
async function executeFourMemeSell(
  walletId: string,
  walletAddress: string,
  tokenAddress: string,
  tokenAmount: bigint,
  publicClient: any
): Promise<string> {
  // Check & approve
  const currentAllowance = await publicClient.readContract({
    address: tokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [walletAddress as `0x${string}`, FOURMEME_TOKEN_MANAGER as `0x${string}`],
  });

  if (currentAllowance < tokenAmount) {
    console.log(`[bnb-swap] Approving Four.meme TokenManager for ${tokenAddress}`);
    const approveData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: "approve",
      args: [FOURMEME_TOKEN_MANAGER as `0x${string}`, tokenAmount * 2n],
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

  const callData = encodeFunctionData({
    abi: FOURMEME_MANAGER_ABI,
    functionName: "sellToken",
    args: [tokenAddress as `0x${string}`, tokenAmount],
  });

  return await evmSendTransaction(walletId, {
    to: FOURMEME_TOKEN_MANAGER,
    data: callData,
  });
}

// ── OpenOcean Swap ──
async function executeOpenOceanSwap(
  walletId: string,
  walletAddress: string,
  tokenAddress: string,
  action: "buy" | "sell",
  amount: string,
  slippage: number,
  publicClient: any
): Promise<{ txHash: string; estimatedOutput: string }> {
  const inToken = action === "buy" ? BNB_NATIVE : tokenAddress;
  const outToken = action === "buy" ? tokenAddress : BNB_NATIVE;

  const swapUrl = `${OPENOCEAN_API}/swap?inTokenAddress=${inToken}&outTokenAddress=${outToken}&amount=${amount}&gasPrice=3&slippage=${slippage}&account=${walletAddress}`;
  console.log(`[bnb-swap] OpenOcean URL: ${swapUrl}`);

  const swapRes = await fetch(swapUrl);
  const swapData = await swapRes.json();

  if (swapData.code !== 200 || !swapData.data) {
    if (isNoLiquidityError(swapData)) {
      throw new NoLiquidityError("openocean");
    }
    throw new Error(`OpenOcean swap failed: ${JSON.stringify(swapData)}`);
  }

  // For sells, approve the router first
  if (action === "sell") {
    const sellAmountRaw = parseEther(amount);
    const routerAddress = swapData.data.to as string;
    const currentAllowance = await publicClient.readContract({
      address: tokenAddress as `0x${string}`,
      abi: ERC20_ABI,
      functionName: "allowance",
      args: [walletAddress as `0x${string}`, routerAddress as `0x${string}`],
    });

    if (currentAllowance < sellAmountRaw) {
      console.log(`[bnb-swap] Approving OpenOcean router ${routerAddress}`);
      const approveData = encodeFunctionData({
        abi: ERC20_ABI,
        functionName: "approve",
        args: [routerAddress as `0x${string}`, sellAmountRaw * 2n],
      });
      const approveHash = await evmSendTransaction(walletId, {
        to: tokenAddress,
        data: approveData,
      });
      await publicClient.waitForTransactionReceipt({
        hash: approveHash as `0x${string}`,
        confirmations: 1,
        timeout: 20_000,
      });
    }
  }

  const txHash = await evmSendTransaction(walletId, {
    to: swapData.data.to,
    data: swapData.data.data,
    value: numberToHex(BigInt(swapData.data.value || "0")),
  });

  return { txHash, estimatedOutput: swapData.data.outAmount || "0" };
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
class NoLiquidityError extends Error {
  route: string;
  constructor(route: string) {
    super(`No liquidity available via ${route}`);
    this.route = route;
  }
}

function isNoLiquidityError(data: any): boolean {
  const str = JSON.stringify(data).toLowerCase();
  return str.includes("no avail liquidity") || str.includes("insufficient liquidity");
}

// ── Wallet Resolution ──
async function resolveWallet(
  body: SwapRequest,
  supabase: any
): Promise<{ walletId: string; walletAddress: string }> {
  let walletId: string | null = null;
  let walletAddress: string = body.userWallet;

  if (body.privyUserId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("privy_evm_wallet_id, evm_wallet_address")
      .eq("privy_did", body.privyUserId)
      .maybeSingle();

    if (profile?.privy_evm_wallet_id) {
      walletId = profile.privy_evm_wallet_id;
      walletAddress = profile.evm_wallet_address || body.userWallet;
    } else {
      const user = await getPrivyUser(body.privyUserId);
      const evmWallet = findEvmEmbeddedWallet(user);
      if (!evmWallet) throw new Error("No EVM embedded wallet found.");
      walletId = evmWallet.walletId;
      walletAddress = evmWallet.address;
      await supabase
        .from("profiles")
        .update({ privy_evm_wallet_id: walletId, evm_wallet_address: walletAddress })
        .eq("privy_did", body.privyUserId);
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

    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
    const slippage = body.slippage ?? 3;
    const portalAddress = Deno.env.get("BNB_PORTAL_ADDRESS") || DEFAULT_PORTAL_ADDRESS;

    // Resolve route
    const { route, graduated } = await resolveTokenRoute(body.tokenAddress, publicClient, portalAddress);

    // Balance check for buys
    if (body.action === "buy") {
      const balance = await publicClient.getBalance({ address: walletAddress as `0x${string}` });
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

    // ── Execute based on route ──
    if (route === "portal") {
      console.log(`[bnb-swap] Executing via SaturnPortal: ${body.action}`);
      txHash = await executePortalSwap(walletId, portalAddress, body.tokenAddress, body.action, body.amount);

    } else if (route === "fourmeme") {
      console.log(`[bnb-swap] Executing via Four.meme: ${body.action}`);
      try {
        if (body.action === "buy") {
          txHash = await executeFourMemeBuy(walletId, body.tokenAddress, parseEther(body.amount));
        } else {
          txHash = await executeFourMemeSell(walletId, walletAddress, body.tokenAddress, parseEther(body.amount), publicClient);
        }
      } catch (fourErr) {
        // Four.meme reverted — token may have migrated, fallback to OpenOcean
        console.log(`[bnb-swap] Four.meme reverted, falling back to OpenOcean: ${(fourErr as Error).message?.slice(0, 100)}`);
        const result = await executeOpenOceanSwap(
          walletId, walletAddress, body.tokenAddress, body.action, body.amount, slippage, publicClient
        );
        txHash = result.txHash;
        estimatedOutput = result.estimatedOutput;
      }

    } else {
      // OpenOcean for graduated/DEX tokens
      console.log(`[bnb-swap] Executing via OpenOcean: ${body.action}`);
      try {
        const result = await executeOpenOceanSwap(
          walletId, walletAddress, body.tokenAddress, body.action, body.amount, slippage, publicClient
        );
        txHash = result.txHash;
        estimatedOutput = result.estimatedOutput;
      } catch (e) {
        if (e instanceof NoLiquidityError) {
          // OpenOcean failed → try Four.meme as fallback
          console.log(`[bnb-swap] OpenOcean no liquidity, trying Four.meme fallback...`);
          try {
            if (body.action === "buy") {
              txHash = await executeFourMemeBuy(walletId, body.tokenAddress, parseEther(body.amount));
            } else {
              txHash = await executeFourMemeSell(walletId, walletAddress, body.tokenAddress, parseEther(body.amount), publicClient);
            }
            // If we get here, Four.meme worked!
            console.log(`[bnb-swap] Four.meme fallback succeeded: ${txHash}`);
          } catch (fourMemeErr) {
            console.log(`[bnb-swap] Four.meme fallback also failed: ${(fourMemeErr as Error).message?.slice(0, 100)}`);
            return new Response(
              JSON.stringify({
                error: "No liquidity on DEXes and token not found on Four.meme bonding curve. The token may not be tradeable yet.",
                route: "openocean",
                reason: "NO_LIQUIDITY",
              }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          throw e;
        }
      }
    }

    console.log(`[bnb-swap] ${body.action} tx: ${txHash!} via ${route}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash! as `0x${string}`,
      confirmations: 1,
      timeout: 30_000,
    });

    // Record trade
    try {
      await supabase.from("alpha_trades").insert({
        token_mint: body.tokenAddress,
        wallet_address: walletAddress,
        trade_type: body.action,
        amount_sol: parseFloat(body.amount),
        amount_tokens: parseFloat(estimatedOutput) || 0,
        tx_hash: txHash!,
        chain: "bnb",
      });
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
        route,
        estimatedOutput,
        explorerUrl: `https://bscscan.com/tx/${txHash!}`,
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
