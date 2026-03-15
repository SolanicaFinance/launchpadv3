import { useState, useCallback, useEffect } from "react";
import { hlUserState, hlOpenOrders, hlUserFills, hlExchange, buildOrderAction, buildCancelAction, orderToWire, buildWithdrawAction, HL_DOMAIN, ORDER_TYPES, WITHDRAW_TYPES } from "@/lib/hyperliquid";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { toast } from "@/hooks/use-toast";

export interface HlPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  markPrice: string;
  unRealizedProfit: string;
  liquidationPrice: string;
  leverage: string;
  marginType: string;
  positionSide: string;
  notional: string;
}

export interface HlAccountInfo {
  totalWalletBalance: string;
  totalUnrealizedProfit: string;
  totalMarginBalance: string;
  availableBalance: string;
  totalInitialMargin: string;
  totalMaintMargin: string;
  totalPositionInitialMargin: string;
  totalOpenOrderInitialMargin: string;
  positions: HlPosition[];
  withdrawable: string;
}

export interface HlOpenOrder {
  orderId: number;
  symbol: string;
  type: string;
  side: string;
  price: string;
  origQty: string;
  status: string;
  time: number;
  stopPrice: string;
}

export interface HlOrderHistory {
  orderId: number;
  symbol: string;
  type: string;
  side: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  time: number;
  avgPrice: string;
}

export interface HlTradeHistory {
  id: number;
  symbol: string;
  side: string;
  price: string;
  qty: string;
  realizedPnl: string;
  commission: string;
  commissionAsset: string;
  time: number;
  buyer: boolean;
  maker: boolean;
}

// Sign a typed data payload via the Privy embedded wallet
async function signTypedData(wallet: any, domain: any, types: any, primaryType: string, message: any): Promise<{ r: string; s: string; v: number }> {
  const provider = await wallet.getEthereumProvider();
  const address = wallet.address;

  const sig = await provider.request({
    method: "eth_signTypedData_v4",
    params: [
      address,
      JSON.stringify({
        domain,
        types: {
          EIP712Domain: [
            { name: "name", type: "string" },
            { name: "version", type: "string" },
            { name: "chainId", type: "uint256" },
            { name: "verifyingContract", type: "address" },
          ],
          ...types,
        },
        primaryType,
        message,
      }),
    ],
  });

  // Parse r, s, v from the 65-byte signature
  const sigHex = sig.startsWith("0x") ? sig.slice(2) : sig;
  const r = "0x" + sigHex.slice(0, 64);
  const s = "0x" + sigHex.slice(64, 128);
  const v = parseInt(sigHex.slice(128, 130), 16);

  return { r, s, v };
}

// Build the EIP-712 message for an order action
function buildOrderTypedMessage(action: any, nonce: number) {
  // Hyperliquid uses a phantom agent approach for order signing
  // The primary type depends on grouping
  return {
    primaryType: "Agent" as const,
    // For orders, HL expects the action hash to be signed via Agent type
    // But the simpler approach: sign the full action
    message: {
      source: "a",
      connectionId: action.connectionId || "0x0000000000000000000000000000000000000000000000000000000000000000",
    },
  };
}

export function useHyperliquidAccount() {
  const { address, isReady, wallet } = usePrivyEvmWallet();
  const [account, setAccount] = useState<HlAccountInfo | null>(null);
  const [openOrders, setOpenOrders] = useState<HlOpenOrder[]>([]);
  const [orderHistory] = useState<HlOrderHistory[]>([]);
  const [tradeHistory, setTradeHistory] = useState<HlTradeHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConnected = !!(address && isReady);

  const fetchAccount = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(null);
    try {
      const state = await hlUserState(address);
      const marginSummary = state.marginSummary || {};
      const positions: HlPosition[] = (state.assetPositions || [])
        .filter((ap: any) => ap.position && parseFloat(ap.position.szi) !== 0)
        .map((ap: any) => {
          const pos = ap.position;
          return {
            symbol: pos.coin,
            positionAmt: pos.szi,
            entryPrice: pos.entryPx || "0",
            markPrice: pos.positionValue ? (Math.abs(parseFloat(pos.positionValue)) / Math.abs(parseFloat(pos.szi))).toString() : "0",
            unRealizedProfit: pos.unrealizedPnl || "0",
            liquidationPrice: pos.liquidationPx || "0",
            leverage: pos.leverage?.value || "1",
            marginType: pos.leverage?.type || "cross",
            positionSide: parseFloat(pos.szi) > 0 ? "LONG" : "SHORT",
            notional: pos.positionValue || "0",
          };
        });

      setAccount({
        totalWalletBalance: marginSummary.accountValue || "0",
        totalUnrealizedProfit: marginSummary.totalNtlPos
          ? (parseFloat(marginSummary.accountValue || "0") - parseFloat(state.withdrawable || "0")).toString()
          : "0",
        totalMarginBalance: marginSummary.accountValue || "0",
        availableBalance: state.withdrawable || "0",
        totalInitialMargin: marginSummary.totalMarginUsed || "0",
        totalMaintMargin: marginSummary.totalMarginUsed || "0",
        totalPositionInitialMargin: marginSummary.totalMarginUsed || "0",
        totalOpenOrderInitialMargin: "0",
        positions,
        withdrawable: state.withdrawable || "0",
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [address]);

  const fetchOpenOrders = useCallback(async () => {
    if (!address) return;
    try {
      const orders = await hlOpenOrders(address);
      const mapped: HlOpenOrder[] = (orders || []).map((o: any) => ({
        orderId: o.oid,
        symbol: o.coin,
        type: o.orderType || "Limit",
        side: o.side === "B" ? "BUY" : "SELL",
        price: o.limitPx || "0",
        origQty: o.sz || "0",
        status: "OPEN",
        time: o.timestamp || Date.now(),
        stopPrice: o.triggerPx || "0",
      }));
      setOpenOrders(mapped);
    } catch (err: any) {
      console.error("Failed to fetch open orders:", err);
    }
  }, [address]);

  const fetchTradeHistory = useCallback(async () => {
    if (!address) return;
    try {
      const fills = await hlUserFills(address);
      const mapped: HlTradeHistory[] = (fills || []).map((f: any, idx: number) => ({
        id: idx,
        symbol: f.coin,
        side: f.side === "B" ? "BUY" : "SELL",
        price: f.px || "0",
        qty: f.sz || "0",
        realizedPnl: f.closedPnl || "0",
        commission: f.fee || "0",
        commissionAsset: "USDC",
        time: f.time || Date.now(),
        buyer: f.side === "B",
        maker: f.liquidation === false,
      }));
      setTradeHistory(mapped);
    } catch (err: any) {
      console.error("Failed to fetch trade history:", err);
    }
  }, [address]);

  // Auto-fetch when address is available
  useEffect(() => {
    if (isConnected) {
      fetchAccount();
      fetchOpenOrders();
    }
  }, [isConnected, fetchAccount, fetchOpenOrders]);

  // Place order with EIP-712 signing
  const placeOrder = useCallback(async (params: {
    coin: string;
    isBuy: boolean;
    sz: number;
    limitPx: number;
    orderType: { limit: { tif: string } } | { trigger: { triggerPx: number; isMarket: boolean; tpsl: string } };
    reduceOnly?: boolean;
    assetIndex: number;
    szDecimals: number;
  }) => {
    if (!address || !wallet) throw new Error("Wallet not connected");

    const wire = orderToWire({
      asset: params.assetIndex,
      isBuy: params.isBuy,
      limitPx: params.limitPx,
      sz: params.sz,
      reduceOnly: params.reduceOnly || false,
      orderType: params.orderType,
    }, params.szDecimals);

    const action = buildOrderAction([wire]);
    const nonce = Date.now();

    // Sign via EIP-712 using the Privy wallet
    const { primaryType, message } = buildOrderTypedMessage(action, nonce);
    const signature = await signTypedData(wallet, HL_DOMAIN, ORDER_TYPES, primaryType, message);

    const result = await hlExchange(action, nonce, signature);

    // Refresh after order
    await Promise.all([fetchAccount(), fetchOpenOrders()]);

    toast({
      title: "Order placed",
      description: `${params.isBuy ? "Long" : "Short"} ${params.sz} ${params.coin}`,
    });

    return result;
  }, [address, wallet, fetchAccount, fetchOpenOrders]);

  // Cancel order with EIP-712 signing
  const cancelOrder = useCallback(async (coin: string, oid: number, assetIndex: number) => {
    if (!address || !wallet) throw new Error("Wallet not connected");

    const action = buildCancelAction([{ asset: assetIndex, oid }]);
    const nonce = Date.now();

    const { primaryType, message } = buildOrderTypedMessage(action, nonce);
    const signature = await signTypedData(wallet, HL_DOMAIN, ORDER_TYPES, primaryType, message);

    const result = await hlExchange(action, nonce, signature);
    await fetchOpenOrders();

    toast({ title: "Order cancelled" });
    return result;
  }, [address, wallet, fetchOpenOrders]);

  // Change leverage via updateLeverage exchange action
  const changeLeverage = useCallback(async (coin: string, leverage: number) => {
    if (!address || !wallet) throw new Error("Wallet not connected");

    const action = {
      type: "updateLeverage",
      asset: 0, // will be overridden
      isCross: true,
      leverage,
    };
    const nonce = Date.now();

    // For updateLeverage, HL uses the same Agent signing
    const { primaryType, message } = buildOrderTypedMessage(action, nonce);
    const signature = await signTypedData(wallet, HL_DOMAIN, ORDER_TYPES, primaryType, message);

    const result = await hlExchange(action, nonce, signature);
    return result;
  }, [address, wallet]);

  // Withdraw USDC from Hyperliquid to Arbitrum
  const withdraw = useCallback(async (amount: string) => {
    if (!address || !wallet) throw new Error("Wallet not connected");

    const action = buildWithdrawAction(address, amount);
    const nonce = Date.now();

    const withdrawMessage = {
      hyperliquidChain: "Arbitrum",
      destination: address,
      amount,
      time: nonce.toString(),
    };

    const signature = await signTypedData(
      wallet,
      { ...HL_DOMAIN, chainId: 42161 }, // Arbitrum chain ID for withdraw
      WITHDRAW_TYPES,
      "HyperliquidTransaction:Withdraw",
      withdrawMessage,
    );

    const result = await hlExchange(action, nonce, signature);
    await fetchAccount();

    toast({
      title: "Withdrawal initiated",
      description: `${amount} USDC withdrawal submitted`,
    });

    return result;
  }, [address, wallet, fetchAccount]);

  return {
    account, openOrders, orderHistory, tradeHistory, loading,
    isConnected,
    hasApiKey: isConnected,
    error,
    fetchAccount, fetchOpenOrders, fetchOrderHistory: fetchTradeHistory, fetchTradeHistory,
    placeOrder, cancelOrder, changeLeverage, withdraw,
    address,
  };
}
