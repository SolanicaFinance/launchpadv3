import { corsHeaders } from "../_shared/cors.ts";

const ADMIN_PASSWORD = "saturn135@";
const BSC_RPC = "https://bsc-dataseed1.binance.org";

// Minimal ABI for ERC-20 transfer + balanceOf + decimals
const ERC20_TRANSFER_SIG = "0xa9059cbb"; // transfer(address,uint256)
const ERC20_BALANCE_SIG = "0x70a08231"; // balanceOf(address)
const ERC20_DECIMALS_SIG = "0x313ce567"; // decimals()

function padAddress(addr: string): string {
  return addr.toLowerCase().replace("0x", "").padStart(64, "0");
}

function padUint256(hex: string): string {
  return hex.replace("0x", "").padStart(64, "0");
}

function toHex(n: bigint): string {
  return "0x" + n.toString(16);
}

async function rpcCall(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BSC_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = await res.json();
  if (json.error) throw new Error(`RPC error: ${JSON.stringify(json.error)}`);
  return json.result;
}

async function getDecimals(tokenAddress: string): Promise<number> {
  const result = await rpcCall("eth_call", [
    { to: tokenAddress, data: ERC20_DECIMALS_SIG },
    "latest",
  ]) as string;
  return parseInt(result, 16);
}

async function getTokenBalance(tokenAddress: string, wallet: string): Promise<bigint> {
  const data = ERC20_BALANCE_SIG + padAddress(wallet);
  const result = await rpcCall("eth_call", [
    { to: tokenAddress, data },
    "latest",
  ]) as string;
  return BigInt(result);
}

// Minimal secp256k1 + RLP + keccak via Web Crypto is complex,
// so we use the ethers-compatible approach with raw signing via npm
import { Wallet, JsonRpcProvider, Contract, parseUnits, formatUnits } from "npm:ethers@6.13.4";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { adminPassword, privateKey, tokenAddress, toAddress, amount } = await req.json();

    if (adminPassword !== ADMIN_PASSWORD) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!privateKey || !tokenAddress || !toAddress || !amount || Number(amount) <= 0) {
      return new Response(
        JSON.stringify({ error: "privateKey, tokenAddress, toAddress, and amount (>0) are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const provider = new JsonRpcProvider(BSC_RPC, 56);
    const wallet = new Wallet(privateKey.trim(), provider);
    const fromAddress = wallet.address;

    console.log(`[admin-send-token] From: ${fromAddress}, Token: ${tokenAddress}, To: ${toAddress}`);

    // Get token info
    const erc20 = new Contract(tokenAddress, [
      "function decimals() view returns (uint8)",
      "function balanceOf(address) view returns (uint256)",
      "function symbol() view returns (string)",
      "function transfer(address to, uint256 amount) returns (bool)",
    ], wallet);

    const [decimals, balance, symbol] = await Promise.all([
      erc20.decimals(),
      erc20.balanceOf(fromAddress),
      erc20.symbol().catch(() => "???"),
    ]);

    const rawAmount = parseUnits(String(amount), decimals);
    const balanceFormatted = formatUnits(balance, decimals);

    console.log(`[admin-send-token] ${symbol} decimals=${decimals}, balance=${balanceFormatted}, sending=${amount}`);

    if (balance < rawAmount) {
      return new Response(
        JSON.stringify({
          error: `Insufficient ${symbol} balance. Have ${balanceFormatted}, need ${amount}`,
          fromAddress,
          balance: balanceFormatted,
          symbol,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check BNB for gas
    const bnbBalance = await provider.getBalance(fromAddress);
    if (bnbBalance < BigInt(1e15)) { // < 0.001 BNB
      return new Response(
        JSON.stringify({
          error: `Insufficient BNB for gas. Have ${formatUnits(bnbBalance, 18)} BNB`,
          fromAddress,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Execute transfer
    const tx = await erc20.transfer(toAddress, rawAmount);
    console.log(`[admin-send-token] ✅ TX sent: ${tx.hash}`);

    const receipt = await tx.wait(1);
    console.log(`[admin-send-token] ✅ TX confirmed in block ${receipt.blockNumber}`);

    return new Response(
      JSON.stringify({
        success: true,
        txHash: tx.hash,
        fromAddress,
        toAddress,
        tokenAddress,
        symbol,
        amount: Number(amount),
        decimals: Number(decimals),
        bscscanUrl: `https://bscscan.com/tx/${tx.hash}`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[admin-send-token] Error:", error);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
