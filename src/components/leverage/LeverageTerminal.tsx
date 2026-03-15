import { useState, useCallback } from "react";
import { useHyperliquidMarkets } from "@/hooks/useHyperliquidMarkets";
import { useHyperliquidKlines, type KlineInterval } from "@/hooks/useHyperliquidKlines";
import { useHyperliquidOrderbook } from "@/hooks/useHyperliquidOrderbook";
import { useHyperliquidAccount } from "@/hooks/useHyperliquidAccount";
import { LeverageMarketSelector } from "./LeverageMarketSelector";
import { LeverageChart } from "./LeverageChart";
import { LeverageOrderbook } from "./LeverageOrderbook";
import { LeverageTradePanel } from "./LeverageTradePanel";
import { LeveragePositions } from "./LeveragePositions";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function LeverageTerminal() {
  const [symbol, setSymbol] = useState("BTC");
  const [interval, setInterval] = useState<KlineInterval>("5m");
  const isMobile = useIsMobile();

  const { markets, allMarkets, loading: marketsLoading, search, setSearch } = useHyperliquidMarkets();
  const { bars, loading: klinesLoading } = useHyperliquidKlines(symbol, interval);
  const orderbook = useHyperliquidOrderbook(symbol);
  const {
    account, openOrders, orderHistory, tradeHistory, isConnected,
    placeOrder, cancelOrder, changeLeverage,
    fetchAccount, fetchOpenOrders, fetchOrderHistory, fetchTradeHistory,
  } = useHyperliquidAccount();

  const selectedMarket = allMarkets.find((m) => m.symbol === symbol);

  const handleCancelOrder = useCallback(async (sym: string, orderId: number) => {
    const market = allMarkets.find(m => m.symbol === sym);
    if (!market) return;
    await cancelOrder(sym, orderId, market.assetIndex);
    await fetchOpenOrders();
  }, [cancelOrder, fetchOpenOrders, allMarkets]);

  const positionsProps = {
    positions: account?.positions || [],
    openOrders,
    orderHistory,
    tradeHistory,
    account,
    onCancelOrder: handleCancelOrder,
    onFetchOrderHistory: fetchOrderHistory,
    onFetchTradeHistory: fetchTradeHistory,
    onRefreshAccount: fetchAccount,
    hasApiKey: isConnected,
    symbol,
  };

  // Mobile: stacked layout
  if (isMobile) {
    return (
      <div className="flex flex-col gap-0">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
          <LeverageMarketSelector markets={markets} selected={symbol} onSelect={setSymbol} search={search} onSearch={setSearch} />
          {selectedMarket && (
            <span className="text-xs font-bold text-foreground ml-auto tabular-nums">
              ${parseFloat(selectedMarket.lastPrice).toLocaleString()}
            </span>
          )}
        </div>
        <div className="h-[300px] border-b border-border">
          <LeverageChart bars={bars} loading={klinesLoading} interval={interval} onIntervalChange={setInterval} symbol={symbol} />
        </div>
        <div className="border-b border-border bg-card">
          <LeverageTradePanel market={selectedMarket} isConnected={isConnected} onPlaceOrder={placeOrder} onChangeLeverage={changeLeverage} />
        </div>
        <div className="h-[300px] border-b border-border bg-card">
          <LeverageOrderbook orderbook={orderbook} />
        </div>
        <div className="min-h-[250px] bg-card">
          <LeveragePositions {...positionsProps} />
        </div>
      </div>
    );
  }

  // Desktop: 3-panel terminal layout
  return (
    <div className="flex flex-col h-[calc(100vh-96px)]">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border bg-card/50">
        <LeverageMarketSelector markets={markets} selected={symbol} onSelect={setSymbol} search={search} onSearch={setSearch} />
        {selectedMarket && (
          <>
            <span className="text-sm font-bold text-foreground tabular-nums">${parseFloat(selectedMarket.lastPrice).toLocaleString()}</span>
            <span className={cn("text-xs tabular-nums", parseFloat(selectedMarket.priceChangePercent) >= 0 ? "text-green-400" : "text-red-400")}>
              {parseFloat(selectedMarket.priceChangePercent) >= 0 ? "+" : ""}
              {parseFloat(selectedMarket.priceChangePercent).toFixed(2)}%
            </span>
            <div className="h-4 w-px bg-border" />
            <span className="text-[10px] text-muted-foreground">24h Vol: <span className="text-foreground">${parseFloat(selectedMarket.quoteVolume).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
            <span className="text-[10px] text-muted-foreground">Funding: <span className={cn(parseFloat(selectedMarket.fundingRate) >= 0 ? "text-green-400" : "text-red-400")}>{(parseFloat(selectedMarket.fundingRate) * 100).toFixed(4)}%</span></span>
            <span className="text-[10px] text-muted-foreground">OI: <span className="text-foreground">${parseFloat(selectedMarket.openInterest).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
          </>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          <div className="flex-1">
            <LeverageChart bars={bars} loading={klinesLoading} interval={interval} onIntervalChange={setInterval} symbol={symbol} />
          </div>
        </div>
        <div className="w-[220px] flex-shrink-0 border-r border-border bg-card/30">
          <LeverageOrderbook orderbook={orderbook} />
        </div>
        <div className="w-[240px] flex-shrink-0 bg-card/50 overflow-y-auto">
          <LeverageTradePanel market={selectedMarket} isConnected={isConnected} onPlaceOrder={placeOrder} onChangeLeverage={changeLeverage} />
        </div>
      </div>

      {/* Bottom: Positions + Account */}
      <div className="h-[220px] border-t border-border bg-card/30">
        <LeveragePositions {...positionsProps} />
      </div>
    </div>
  );
}
