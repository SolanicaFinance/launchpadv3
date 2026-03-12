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

// ── ERC-20 ABI ──
const ERC20_ABI = parseAbi([
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address owner) external view returns (uint256)",
]);

const OPENOCEAN_API = "https://open-api.openocean.finance/v4/bsc";
const BNB_NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
const ALCHEMY_KEY = Deno.env.get("ALCHEMY_BSC_API_KEY");
const BSC_RPC = ALCHEMY_KEY ? `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}` : "https://bsc-dataseed.binance.org";

interface SwapRequest {
  tokenAddress: string;
  action: "buy" | "sell";
  amount: string; // BNB amount for buy, token amount for sell
  userWallet: string;
  privyUserId?: string; // did:privy:... for server-side signing
  slippage?: number;
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

    // ── Resolve user's EVM wallet via Privy ──
    let walletId: string | null = null;
    let walletAddress: string = body.userWallet;

    // First try DB cache
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (body.privyUserId) {
      // Check DB for cached wallet ID
      const { data: profile } = await supabase
        .from("profiles")
        .select("privy_evm_wallet_id, evm_wallet_address")
        .eq("privy_did", body.privyUserId)
        .maybeSingle();

      if (profile?.privy_evm_wallet_id) {
        walletId = profile.privy_evm_wallet_id;
        walletAddress = profile.evm_wallet_address || body.userWallet;
        console.log(`[bnb-swap] Using cached EVM wallet ID: ${walletId}`);
      } else {
        // Fetch from Privy API
        console.log(`[bnb-swap] Fetching EVM wallet from Privy for ${body.privyUserId}`);
        const user = await getPrivyUser(body.privyUserId);
        const evmWallet = findEvmEmbeddedWallet(user);

        if (!evmWallet) {
          return new Response(
            JSON.stringify({ error: "No EVM embedded wallet found. Please ensure your account has an EVM wallet." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        walletId = evmWallet.walletId;
        walletAddress = evmWallet.address;

        // Cache for future calls
        await supabase
          .from("profiles")
          .update({ privy_evm_wallet_id: walletId, evm_wallet_address: walletAddress })
          .eq("privy_did", body.privyUserId);
      }
    } else {
      // Fallback: try to find by wallet address
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

    if (!walletId) {
      return new Response(
        JSON.stringify({ error: "Could not resolve EVM wallet. Please pass privyUserId." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const publicClient = createPublicClient({ chain: bsc, transport: http(BSC_RPC) });
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
        console.log(`[bnb-swap] Token not on portal, routing to OpenOcean`);
        isGraduated = true;
      }
    } else {
      isGraduated = true;
    }

    // ── Check user's balance ──
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

    if (isGraduated) {
      // ── Route through OpenOcean DEX aggregator ──
      console.log(`[bnb-swap] Graduated token — using OpenOcean for ${body.action}`);

      const inToken = body.action === "buy" ? BNB_NATIVE : body.tokenAddress;
      const outToken = body.action === "buy" ? body.tokenAddress : BNB_NATIVE;

      // For sells, approve first
      if (body.action === "sell") {
        const sellAmountRaw = parseEther(body.amount);

        // Get quote first to find router address
        const swapUrl = `${OPENOCEAN_API}/swap?inTokenAddress=${inToken}&outTokenAddress=${outToken}&amount=${body.amount}&gasPrice=3&slippage=${slippage}&account=${walletAddress}`;
        const swapRes = await fetch(swapUrl);
        const swapData = await swapRes.json();

        if (swapData.code !== 200 || !swapData.data) {
          const noLiquidity = JSON.stringify(swapData).includes("No avail liquidity");
          if (noLiquidity) {
            return new Response(
              JSON.stringify({ error: "No liquidity available for this token on BNB Chain DEXes. The token may be too new or not yet listed." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error(`OpenOcean swap failed: ${JSON.stringify(swapData)}`);
        }

        const routerAddress = swapData.data.to as string;

        // Check allowance
        const currentAllowance = await publicClient.readContract({
          address: body.tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "allowance",
          args: [walletAddress as `0x${string}`, routerAddress as `0x${string}`],
        });

        if (currentAllowance < sellAmountRaw) {
          console.log(`[bnb-swap] Approving ${routerAddress} for token ${body.tokenAddress}`);
          const approveData = encodeFunctionData({
            abi: ERC20_ABI,
            functionName: "approve",
            args: [routerAddress as `0x${string}`, sellAmountRaw * 2n],
          });

          const approveHash = await evmSendTransaction(walletId, {
            to: body.tokenAddress,
            data: approveData,
          });
          console.log(`[bnb-swap] Approval tx: ${approveHash}`);

          // Wait for approval confirmation
          await publicClient.waitForTransactionReceipt({
            hash: approveHash as `0x${string}`,
            confirmations: 1,
            timeout: 20_000,
          });
        }

        // Execute the swap
        txHash = await evmSendTransaction(walletId, {
          to: swapData.data.to,
          data: swapData.data.data,
          value: numberToHex(BigInt(swapData.data.value || "0")),
        });
        estimatedOutput = swapData.data.outAmount || "0";
      } else {
        // Buy — get swap data from OpenOcean
        const swapUrl = `${OPENOCEAN_API}/swap?inTokenAddress=${inToken}&outTokenAddress=${outToken}&amount=${body.amount}&gasPrice=3&slippage=${slippage}&account=${walletAddress}`;
        console.log(`[bnb-swap] OpenOcean swap URL: ${swapUrl}`);

        const swapRes = await fetch(swapUrl);
        const swapData = await swapRes.json();

        if (swapData.code !== 200 || !swapData.data) {
          const noLiquidity = JSON.stringify(swapData).includes("No avail liquidity");
          if (noLiquidity) {
            return new Response(
              JSON.stringify({ error: "No liquidity available for this token on BNB Chain DEXes. The token may be too new or not yet listed." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
          throw new Error(`OpenOcean swap failed: ${JSON.stringify(swapData)}`);
        }

        txHash = await evmSendTransaction(walletId, {
          to: swapData.data.to,
          data: swapData.data.data,
          value: numberToHex(BigInt(swapData.data.value || "0")),
        });
        estimatedOutput = swapData.data.outAmount || "0";
      }
    } else {
      // ── Bonding curve swap via SaturnPortal ──
      console.log(`[bnb-swap] Bonding curve token — using SaturnPortal for ${body.action}`);

      if (body.action === "buy") {
        const bnbAmount = parseEther(body.amount);
        const callData = encodeFunctionData({
          abi: PORTAL_ABI,
          functionName: "buy",
          args: [body.tokenAddress as `0x${string}`],
        });

        txHash = await evmSendTransaction(walletId, {
          to: portalAddress!,
          data: callData,
          value: numberToHex(bnbAmount),
        });
      } else {
        const tokenAmount = parseEther(body.amount);
        const callData = encodeFunctionData({
          abi: PORTAL_ABI,
          functionName: "sell",
          args: [body.tokenAddress as `0x${string}`, tokenAmount],
        });

        txHash = await evmSendTransaction(walletId, {
          to: portalAddress!,
          data: callData,
        });
      }
    }

    console.log(`[bnb-swap] ${body.action} tx: ${txHash}`);

    // Wait for confirmation
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash as `0x${string}`,
      confirmations: 1,
      timeout: 30_000,
    });

    // ── Record trade in alpha_trades ──
    try {
      await supabase.from("alpha_trades").insert({
        token_mint: body.tokenAddress,
        wallet_address: walletAddress,
        trade_type: body.action,
        amount_sol: parseFloat(body.amount),
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
