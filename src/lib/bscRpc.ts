/**
 * Centralized BSC RPC URL helper.
 * Frontend calls go through the edge function proxy which uses Alchemy,
 * with a fallback to public BSC RPC if the proxy is unreachable.
 */
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "ptwytypavumcrbofspno";

export const BSC_RPC_URL = `https://${PROJECT_ID}.supabase.co/functions/v1/bsc-rpc`;
const BSC_PUBLIC_RPC = "https://bsc-dataseed1.binance.org";

/**
 * Make a JSON-RPC call to BSC via the Alchemy proxy, with public RPC fallback.
 */
export async function bscRpcCall(method: string, params: unknown[] = []): Promise<any> {
  const body = JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 });
  const headers = { "Content-Type": "application/json" };

  try {
    const res = await fetch(BSC_RPC_URL, { method: "POST", headers, body });
    if (!res.ok) throw new Error(`proxy ${res.status}`);
    return await res.json();
  } catch {
    // Fallback to public BSC RPC
    const res = await fetch(BSC_PUBLIC_RPC, { method: "POST", headers, body });
    return res.json();
  }
}

/**
 * Fetch BNB balance for an address (proxy → public RPC fallback).
 */
export async function fetchBnbBalance(address: string): Promise<number> {
  const data = await bscRpcCall("eth_getBalance", [address, "latest"]);
  if (data?.result) {
    return Number(BigInt(data.result)) / 1e18;
  }
  return 0;
}
