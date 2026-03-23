import { useState, useEffect } from 'react';
import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { BtcWalletConnect } from '@/components/bitcoin/BtcWalletConnect';
import { Button } from '@/components/ui/button';
import { TrendingRunes } from '@/components/bitcoin/TrendingRunes';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface FeeEstimates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
}

export default function BitcoinModePage() {
  const { isConnected, address, balance } = useBtcWallet();
  const navigate = useNavigate();
  const [recentTokens, setRecentTokens] = useState<any[]>([]);
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  // Fetch recent launches from DB
  useEffect(() => {
    supabase
      .from('btc_tokens')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data) setRecentTokens(data);
      });
  }, []);

  // Fetch live market data
  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
    const base = `https://${projectId}.supabase.co/functions/v1/btc-market-data`;
    
    Promise.all([
      fetch(`${base}?action=fees`).then(r => r.json()).catch(() => null),
      fetch(`${base}?action=block-tip`).then(r => r.json()).catch(() => null),
    ]).then(([feeData, blockData]) => {
      if (feeData && !feeData.error) setFees(feeData);
      if (blockData?.blockHeight) setBlockHeight(blockData.blockHeight);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      {!isConnected ? (
        <BtcConnectWalletModal />
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
          {/* Hero */}
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">
              Launch & Trade Bitcoin Runes
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              The only platform with Rune etching, RugShield deployer scanning, and PSBT trading — all in one app. Built for whales.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                onClick={() => navigate('/btc/launch')}
                className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
                size="lg"
              >
                Launch a Rune
              </Button>
            </div>
          </div>

          {/* Live Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Wallet</div>
              <div className="text-sm font-mono font-semibold text-foreground mt-1 truncate">
                {address?.slice(0, 8)}...{address?.slice(-4)}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance</div>
              <div className="text-sm font-mono font-semibold text-foreground mt-1">
                {balance ? `${(balance.confirmed / 1e8).toFixed(6)} BTC` : '—'}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Block Height</div>
              <div className="text-sm font-mono font-semibold text-foreground mt-1">
                {blockHeight?.toLocaleString() || '—'}
              </div>
            </div>
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Fee (sat/vB)</div>
              <div className="text-sm font-mono font-semibold text-foreground mt-1">
                {fees ? `${fees.halfHourFee}` : '—'}
              </div>
              {fees && (
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  Fast: {fees.fastestFee} · Slow: {fees.hourFee}
                </div>
              )}
            </div>
          </div>

          {/* Fee tiers */}
          {fees && (
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-bold text-foreground mb-3">Current Network Fees</h3>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Economy (~1h)', rate: fees.hourFee, cost: ((fees.hourFee * 250) / 1e8) },
                  { label: 'Normal (~30m)', rate: fees.halfHourFee, cost: ((fees.halfHourFee * 250) / 1e8) },
                  { label: 'Fast (~10m)', rate: fees.fastestFee, cost: ((fees.fastestFee * 250) / 1e8) },
                ].map(tier => (
                  <div key={tier.label} className="bg-background rounded-lg p-3 text-center">
                    <div className="text-xs text-muted-foreground">{tier.label}</div>
                    <div className="text-lg font-bold text-foreground mt-1">{tier.rate}</div>
                    <div className="text-[10px] text-muted-foreground">sat/vB</div>
                    <div className="text-xs text-muted-foreground mt-1">~{tier.cost.toFixed(6)} BTC</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Runes from the network */}
          <TrendingRunes />

          {/* Recent launches */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <h3 className="text-sm font-bold text-foreground mb-3">Recent Rune Launches</h3>
            {recentTokens.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground text-sm">No Runes launched yet. Be the first!</p>
                <Button
                  onClick={() => navigate('/btc/launch')}
                  variant="outline"
                  size="sm"
                  className="mt-3"
                >
                  Launch a Rune
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {recentTokens.map(token => (
                  <button
                    key={token.id}
                    onClick={() => navigate(`/btc/token/${token.id}`)}
                    className="w-full flex items-center justify-between bg-background rounded-lg p-3 hover:bg-muted/50 transition-colors text-left"
                  >
                    <div>
                      <div className="text-sm font-semibold text-foreground">{token.rune_name}</div>
                      <div className="text-xs text-muted-foreground">
                        Supply: {Number(token.supply).toLocaleString()} · Status: {token.status}
                      </div>
                    </div>
                    <div className="text-right">
                      {token.rugshield_score !== null && (
                        <div className={`text-xs font-mono ${
                          token.rugshield_score <= 25 ? 'text-[hsl(var(--success))]' :
                          token.rugshield_score <= 50 ? 'text-[hsl(var(--warning))]' :
                          'text-destructive'
                        }`}>
                          RS: {token.rugshield_score}
                        </div>
                      )}
                      <div className="text-[10px] text-muted-foreground">
                        {new Date(token.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
