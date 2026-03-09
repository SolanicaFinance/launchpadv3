export interface PositionSummary {
  wallet_address: string;
  token_mint: string;
  token_ticker: string | null;
  total_bought_sol: number;
  total_sold_sol: number;
  total_bought_tokens: number;
  total_sold_tokens: number;
  net_tokens: number;
  avg_buy_price_sol: number;
  realized_pnl_sol: number;
  status: "HOLDING" | "SOLD" | "PARTIAL";
}

export interface TradeRecord {
  wallet_address: string;
  token_mint: string;
  token_ticker: string | null;
  trade_type: string;
  amount_sol: number;
  amount_tokens: number;
}

export function computePositions(trades: TradeRecord[]): Map<string, PositionSummary> {
  const map = new Map<string, PositionSummary>();

  for (const t of trades) {
    const key = `${t.wallet_address}::${t.token_mint}`;
    let pos = map.get(key);
    if (!pos) {
      pos = {
        wallet_address: t.wallet_address,
        token_mint: t.token_mint,
        token_ticker: t.token_ticker,
        total_bought_sol: 0,
        total_sold_sol: 0,
        total_bought_tokens: 0,
        total_sold_tokens: 0,
        net_tokens: 0,
        avg_buy_price_sol: 0,
        realized_pnl_sol: 0,
        status: "HOLDING",
      };
      map.set(key, pos);
    }

    if (t.trade_type === "buy") {
      pos.total_bought_sol += t.amount_sol;
      pos.total_bought_tokens += t.amount_tokens;
    } else {
      pos.total_sold_sol += t.amount_sol;
      pos.total_sold_tokens += t.amount_tokens;
    }
  }

  for (const pos of map.values()) {
    pos.net_tokens = pos.total_bought_tokens - pos.total_sold_tokens;
    pos.avg_buy_price_sol =
      pos.total_bought_tokens > 0
        ? pos.total_bought_sol / pos.total_bought_tokens
        : 0;
    const costOfSold = pos.avg_buy_price_sol * pos.total_sold_tokens;
    pos.realized_pnl_sol = pos.total_sold_sol - costOfSold;

    if (pos.net_tokens <= 0) {
      pos.status = "SOLD";
    } else if (pos.total_sold_tokens > 0) {
      pos.status = "PARTIAL";
    } else {
      pos.status = "HOLDING";
    }
  }

  return map;
}

export function timeAgo(dateStr: string) {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function formatTokenAmt(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}

export function formatMcap(v: number): string {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toFixed(1);
}

export function formatSol(val: number | null) {
  if (val === null || val === undefined) return "—";
  if (val >= 1000) return (val / 1000).toFixed(1) + "K";
  return val.toFixed(2);
}

export function truncateWallet(addr: string | null) {
  if (!addr) return "—";
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}
