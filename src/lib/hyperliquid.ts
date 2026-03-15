// Hyperliquid API client & EIP-712 signing utilities
// Docs: https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api

export const HL_API = "https://api.hyperliquid.xyz";

// EIP-712 domain for Hyperliquid actions (mainnet)
export const HL_DOMAIN = {
  name: "Exchange",
  version: "1",
  chainId: 421614, // 0x66eee
  verifyingContract: "0x0000000000000000000000000000000000000000" as const,
};

// Canonical asset index mapping (common ones - full list from /info meta)
// These are fetched dynamically but we keep a fallback for common pairs
export const COMMON_ASSETS: Record<string, number> = {
  BTC: 0, ETH: 1, SOL: 2, DOGE: 3, AVAX: 4, ARB: 5, OP: 6,
  MATIC: 7, BNB: 8, APT: 9, SUI: 10, SEI: 11, TIA: 12, 
  LINK: 13, WIF: 14, PEPE: 15, BONK: 16, JTO: 17, INJ: 18,
};

// ── Info API (public, no auth) ──

export async function hlInfo(type: string, params: Record<string, any> = {}): Promise<any> {
  const res = await fetch(`${HL_API}/info`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type, ...params }),
  });
  if (!res.ok) throw new Error(`HL info error: ${res.status}`);
  return res.json();
}

// Get meta info (all perp assets, universe)
export async function hlMeta() {
  return hlInfo("meta");
}

// Get all mids (current prices)
export async function hlAllMids(): Promise<Record<string, string>> {
  return hlInfo("allMids");
}

// Get L2 orderbook
export async function hlL2Book(coin: string, nSigFigs?: number) {
  return hlInfo("l2Book", { coin, ...(nSigFigs ? { nSigFigs } : {}) });
}

// Get candles
export async function hlCandles(coin: string, interval: string, startTime: number, endTime?: number) {
  return hlInfo("candleSnapshot", { 
    req: { coin, interval, startTime, endTime: endTime || Date.now() } 
  });
}

// Get user state (positions, margin, etc.)
export async function hlUserState(user: string) {
  return hlInfo("clearinghouseState", { user });
}

// Get open orders
export async function hlOpenOrders(user: string) {
  return hlInfo("openOrders", { user });
}

// Get user fills (trade history)
export async function hlUserFills(user: string, startTime?: number) {
  return hlInfo("userFills", { user, ...(startTime ? { aggregateByTime: true } : {}) });
}

// Get funding history for a coin
export async function hlFundingHistory(coin: string, startTime: number, endTime?: number) {
  return hlInfo("fundingHistory", { coin, startTime, endTime });
}

// Get meta + asset contexts (prices, funding, OI in one call)
export async function hlMetaAndAssetCtxs() {
  return hlInfo("metaAndAssetCtxs");
}

// ── EIP-712 Order Signing Types ──

export const ORDER_TYPES = {
  Order: [
    { name: "a", type: "uint32" },      // asset index
    { name: "b", type: "bool" },        // is buy
    { name: "p", type: "uint64" },      // price (float → wire)
    { name: "s", type: "uint64" },      // size (float → wire)
    { name: "r", type: "bool" },        // reduce only
    { name: "t", type: "uint8" },       // order type: 2=limit, 3=stop
    { name: "c", type: "uint64" },      // cloid (client order id)
  ],
  Agent: [
    { name: "source", type: "string" },
    { name: "connectionId", type: "bytes32" },
  ],
};

// Withdrawal EIP-712 types
export const WITHDRAW_TYPES = {
  "HyperliquidTransaction:Withdraw": [
    { name: "hyperliquidChain", type: "string" },
    { name: "destination", type: "string" },
    { name: "amount", type: "string" },
    { name: "time", type: "uint64" },
  ],
};

// USD Transfer types
export const USD_SEND_TYPES = {
  "HyperliquidTransaction:UsdSend": [
    { name: "hyperliquidChain", type: "string" },
    { name: "destination", type: "string" },
    { name: "amount", type: "string" },
    { name: "time", type: "uint64" },
  ],
};

// Convert float price to Hyperliquid wire format
export function floatToWire(x: number, szDecimals: number): string {
  const rounded = parseFloat(x.toFixed(szDecimals));
  return rounded.toString();
}

// Convert order parameters to the wire format Hyperliquid expects
export function orderToWire(order: {
  asset: number;
  isBuy: boolean;
  limitPx: number;
  sz: number;
  reduceOnly: boolean;
  orderType: { limit: { tif: string } } | { trigger: { triggerPx: number; isMarket: boolean; tpsl: string } };
  cloid?: string;
}, szDecimals: number): any {
  const wire: any = {
    a: order.asset,
    b: order.isBuy,
    p: floatToWire(order.limitPx, 8),
    s: floatToWire(order.sz, szDecimals),
    r: order.reduceOnly,
    t: "limit" in order.orderType ? { limit: order.orderType.limit } : { trigger: order.orderType.trigger },
  };
  if (order.cloid) wire.c = order.cloid;
  return wire;
}

// Build the exchange action for placing orders
export function buildOrderAction(orders: any[], grouping: "na" | "normalTpsl" | "positionTpsl" = "na") {
  return {
    type: "order",
    orders,
    grouping,
  };
}

// Build the exchange action for canceling orders
export function buildCancelAction(cancels: { asset: number; oid: number }[]) {
  return {
    type: "cancel",
    cancels,
  };
}

// Build withdraw action
export function buildWithdrawAction(destination: string, amount: string) {
  return {
    type: "withdraw3",
    hyperliquidChain: "Arbitrum",
    signatureChainId: "0xa4b1",
    destination,
    amount,
    time: Date.now(),
  };
}

// Post a signed action to the exchange endpoint
export async function hlExchange(action: any, nonce: number, signature: { r: string; s: string; v: number }, vaultAddress?: string) {
  const body: any = {
    action,
    nonce,
    signature,
  };
  if (vaultAddress) body.vaultAddress = vaultAddress;

  const res = await fetch(`${HL_API}/exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.status === "err") throw new Error(data.response || "Exchange error");
  return data;
}

// Hyperliquid deposit: send USDC to the Arbitrum bridge contract
export const HL_BRIDGE_ADDRESS = "0x2Df1c51E09aECF9cacB7bc98cB1742757f163dF7"; // Bridge2 on Arbitrum
export const ARBITRUM_USDC = "0xaf88d065e77c8cC2239327C5EDb3A432268e5831"; // Native USDC on Arbitrum

// Interval mapping: Hyperliquid uses different interval strings
export const HL_INTERVALS: Record<string, string> = {
  "1m": "1m",
  "3m": "3m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "1h": "1h",
  "2h": "2h",
  "4h": "4h",
  "1d": "1d",
  "1w": "1w",
};
