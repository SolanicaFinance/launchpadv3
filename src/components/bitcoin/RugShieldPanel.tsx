import { useState, useEffect } from 'react';
import { useBtcWallet } from '@/hooks/useBtcWallet';

interface RiskAnalysis {
  address: string;
  walletAge: string | null;
  totalTxCount: number;
  totalReceived: number;
  totalSent: number;
  fundedTxCount: number;
  spentTxCount: number;
  firstSeenBlock: number | null;
  riskScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  positives: string[];
}

const RISK_COLORS: Record<string, string> = {
  low: 'text-[hsl(var(--success))]',
  medium: 'text-[hsl(var(--warning))]',
  high: 'text-destructive',
  critical: 'text-destructive',
};

const RISK_BG: Record<string, string> = {
  low: 'bg-[hsl(var(--success)/0.1)] border-[hsl(var(--success)/0.3)]',
  medium: 'bg-[hsl(var(--warning)/0.1)] border-[hsl(var(--warning)/0.3)]',
  high: 'bg-destructive/10 border-destructive/30',
  critical: 'bg-destructive/10 border-destructive/30',
};

const RISK_BADGE: Record<string, string> = {
  low: '✅ Low Risk',
  medium: '⚠️ Medium Risk',
  high: '🔴 High Risk',
  critical: '🚨 Critical Risk',
};

interface RugShieldPanelProps {
  onScoreChange?: (score: number) => void;
}

export function RugShieldPanel({ onScoreChange }: RugShieldPanelProps) {
  const { address, isConnected } = useBtcWallet();
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scanWallet = async (addr: string) => {
    setLoading(true);
    setError(null);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/btc-rugshield`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: addr }),
        }
      );
      if (!res.ok) throw new Error('Scan failed');
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isConnected && address) {
      scanWallet(address);
    }
  }, [address, isConnected]);

  return (
    <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🛡️</span>
        <h3 className="font-bold text-foreground">RugShield</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Deployer wallet scan via mempool.space. Analyzes on-chain history to build trust with buyers.
      </p>

      {!isConnected && (
        <div className="bg-background rounded-lg p-4 text-center">
          <p className="text-sm text-muted-foreground">Connect wallet to scan</p>
        </div>
      )}

      {loading && (
        <div className="bg-background rounded-lg p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <div className="w-4 h-4 border-2 border-transparent border-t-primary rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Scanning wallet...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <p className="text-xs text-destructive">{error}</p>
          {address && (
            <button
              onClick={() => scanWallet(address)}
              className="text-xs text-primary hover:underline mt-1"
            >
              Retry scan
            </button>
          )}
        </div>
      )}

      {analysis && !loading && (
        <div className="space-y-3">
          {/* Risk badge */}
          <div className={`rounded-lg border p-3 ${RISK_BG[analysis.riskLevel]}`}>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-bold ${RISK_COLORS[analysis.riskLevel]}`}>
                {RISK_BADGE[analysis.riskLevel]}
              </span>
              <span className={`text-2xl font-bold ${RISK_COLORS[analysis.riskLevel]}`}>
                {analysis.riskScore}
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: 'Wallet Age', value: analysis.walletAge || 'New' },
              { label: 'Transactions', value: analysis.totalTxCount.toString() },
              { label: 'Received', value: `${(analysis.totalReceived / 1e8).toFixed(6)} BTC` },
              { label: 'Sent', value: `${(analysis.totalSent / 1e8).toFixed(6)} BTC` },
            ].map((stat) => (
              <div key={stat.label} className="bg-background rounded-lg p-2">
                <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                <div className="text-xs font-semibold text-foreground">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {analysis.warnings.length > 0 && (
            <div className="space-y-1">
              {analysis.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="text-destructive mt-0.5">⚠</span>
                  <span className="text-muted-foreground">{w}</span>
                </div>
              ))}
            </div>
          )}

          {/* Positives */}
          {analysis.positives.length > 0 && (
            <div className="space-y-1">
              {analysis.positives.map((p, i) => (
                <div key={i} className="flex items-start gap-1.5 text-xs">
                  <span className="text-[hsl(var(--success))] mt-0.5">✓</span>
                  <span className="text-muted-foreground">{p}</span>
                </div>
              ))}
            </div>
          )}

          {/* Rescan */}
          <button
            onClick={() => address && scanWallet(address)}
            className="text-xs text-primary hover:underline w-full text-center"
          >
            Rescan wallet
          </button>
        </div>
      )}
    </div>
  );
}
