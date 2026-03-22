import { useState, useEffect } from 'react';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1`;

interface TrendingRune {
  id: string;
  name: string;
  spaced_name: string;
  symbol: string;
  number: number;
  supply: string;
  premine: string;
  divisibility: number;
  timestamp: number;
}

export function TrendingRunes() {
  const [runes, setRunes] = useState<TrendingRune[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${BASE_URL}/btc-rune-launch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list-runes', limit: 12 }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.results) setRunes(data.results);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-bold text-foreground mb-3">Trending Runes (Network)</h3>
        <div className="flex items-center justify-center py-8">
          <div className="w-5 h-5 border-2 border-transparent border-t-primary rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (runes.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <h3 className="text-sm font-bold text-foreground mb-3">Trending Runes (Network)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {runes.map((rune) => (
          <a
            key={rune.id || rune.name}
            href={`https://mempool.space/rune/${encodeURIComponent(rune.spaced_name || rune.name)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-background rounded-lg p-3 hover:bg-muted/50 transition-colors block"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{rune.symbol || '◆'}</span>
              <span className="text-sm font-semibold text-foreground truncate">
                {rune.spaced_name || rune.name}
              </span>
            </div>
            <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
              <span>#{rune.number}</span>
              <span>Supply: {formatSupply(rune.supply, rune.divisibility)}</span>
            </div>
            {rune.premine && rune.premine !== '0' && (
              <div className="text-[10px] text-[hsl(var(--warning))] mt-0.5">
                Premine: {formatPercent(rune.premine, rune.supply)}
              </div>
            )}
          </a>
        ))}
      </div>
    </div>
  );
}

function formatSupply(supply: string, divisibility: number): string {
  const num = BigInt(supply);
  const divisor = BigInt(10 ** divisibility);
  const actual = num / divisor;
  if (actual >= 1_000_000_000n) return `${(Number(actual) / 1e9).toFixed(1)}B`;
  if (actual >= 1_000_000n) return `${(Number(actual) / 1e6).toFixed(1)}M`;
  if (actual >= 1_000n) return `${(Number(actual) / 1e3).toFixed(1)}K`;
  return actual.toString();
}

function formatPercent(premine: string, supply: string): string {
  const p = BigInt(premine);
  const s = BigInt(supply);
  if (s === 0n) return '0%';
  return `${((Number(p) / Number(s)) * 100).toFixed(1)}%`;
}
