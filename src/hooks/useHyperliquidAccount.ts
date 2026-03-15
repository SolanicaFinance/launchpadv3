import { useState, useCallback, useEffect } from "react";
import { hlUserState, hlOpenOrders, hlUserFills, hlExchange, buildOrderAction, buildCancelAction, orderToWire, buildWithdrawAction } from "@/lib/hyperliquid";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";

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

export function useHyperliquidAccount() {
  const { address, isReady } = usePrivyEvmWallet();
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
      
      // Map HL clearinghouseState to our interface
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
        totalUnrealizedProfit: marginSummary.totalNtlPos ? 
          (parseFloat(marginSummary.accountValue || "0") - parseFloat(state.withdrawable || "0")).toString() : "0",
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

  // Place order - requires EIP-712 signing via wallet
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
    if (!address) throw new Error("Wallet not connected");
    
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

    // The actual EIP-712 signing happens in the component via the wallet
    // Return the action and nonce for the component to sign
    return { action, nonce };
  }, [address]);

  const cancelOrder = useCallback(async (coin: string, oid: number, assetIndex: number) => {
    if (!address) throw new Error("Wallet not connected");
    const action = buildCancelAction([{ asset: assetIndex, oid }]);
    const nonce = Date.now();
    return { action, nonce };
  }, [address]);

  // No-op for HL since leverage is set per-order, not account-wide
  const changeLeverage = useCallback(async (_coin: string, _leverage: number) => {
    // Hyperliquid handles leverage at the order level via updateLeverage action
    // We'll integrate this when actually placing orders
    return true;
  }, []);

  return {
    account, openOrders, orderHistory, tradeHistory, loading, 
    isConnected,
    hasApiKey: isConnected, // For backward compat - HL uses wallet, no API key
    error,
    fetchAccount, fetchOpenOrders, fetchOrderHistory: fetchTradeHistory, fetchTradeHistory,
    placeOrder, cancelOrder, changeLeverage,
    address,
  };
}
