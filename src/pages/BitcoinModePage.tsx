import { useState, useEffect } from 'react';
import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { SaturnProtocolExplainer } from '@/components/bitcoin/SaturnProtocolExplainer';
import { BtcNetworkDashboard } from '@/components/bitcoin/BtcNetworkDashboard';
import { Button } from '@/components/ui/button';
import { TrendingRunes } from '@/components/bitcoin/TrendingRunes';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useBtcMemeTokens } from '@/hooks/useBtcMemeTokens';
import { Rocket, TrendingUp, Zap, Shield, Layers, ArrowRight } from 'lucide-react';
import { useChain } from '@/contexts/ChainContext';
import { motion } from 'framer-motion';

function formatBtc(v: number) {
  if (v >= 1) return `${v.toFixed(4)} ₿`;
  if (v >= 0.001) return `${v.toFixed(6)} ₿`;
  return `${v.toFixed(8)} ₿`;
}

function BtcMemeTokenFeed() {
  const { data: tokens, isLoading } = useBtcMemeTokens();
  const navigate = useNavigate();

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> BTC Meme Tokens
        </h3>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-6">Loading...</p>
      ) : !tokens || tokens.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No meme tokens launched yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map(token => {
            const pct = Math.min(token.bonding_progress, 100);
            return (
              <button
                key={token.id}
                onClick={() => navigate(`/btc/meme/${token.id}`)}
                className="w-full flex items-center justify-between bg-background rounded-xl p-3 hover:bg-muted/50 transition-colors text-left border border-transparent hover:border-border"
              >
                <div className="flex items-center gap-3">
                  {token.image_url ? (
                    <img src={token.image_url} alt={token.ticker} className="w-9 h-9 rounded-lg object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-lg bg-primary/20 flex items-center justify-center text-sm font-bold text-primary">{token.ticker.charAt(0)}</div>
                  )}
                  <div>
                    <div className="text-sm font-semibold text-foreground">${token.ticker}</div>
                    <div className="text-[10px] text-muted-foreground">{token.name}</div>
                  </div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-xs font-mono font-bold text-foreground">{formatBtc(token.market_cap_btc)}</div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{pct.toFixed(0)}%</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface FeeEstimates { fastestFee: number; halfHourFee: number; hourFee: number; }

export default function BitcoinModePage() {
  const { isConnected, address, balance } = useBtcWallet();
  const { chain, setChain } = useChain();
  const navigate = useNavigate();
  const [recentTokens, setRecentTokens] = useState<any[]>([]);
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  useEffect(() => {
    if (chain !== 'bitcoin') setChain('bitcoin');
  }, []);

  useEffect(() => {
    supabase.from('btc_tokens').select('*').order('created_at', { ascending: false }).limit(10)
      .then(({ data }) => { if (data) setRecentTokens(data); });
  }, []);

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
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative bg-card border border-border rounded-2xl overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/3 pointer-events-none" />
        <div className="relative px-8 py-10 text-center space-y-5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-semibold text-primary">
            <Zap className="w-3 h-3" /> First-ever Hybrid BTC Settlement Protocol
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            Bitcoin Meme Tokens
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
            The world's first instant Bitcoin meme coin protocol. Trade with <span className="text-foreground font-semibold">Solana speed</span>, 
            backed by <span className="text-foreground font-semibold">Bitcoin security</span>. Every trade is provable, every balance is anchored.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {isConnected ? (
              <Button onClick={() => navigate('/btc/meme/launch')} className="bg-primary hover:bg-primary/90 text-primary-foreground" size="lg">
                <Rocket className="w-4 h-4 mr-2" /> Launch Token
              </Button>
            ) : (
              <BtcConnectWalletModal
                trigger={
                  <Button className="bg-primary hover:bg-primary/90 text-primary-foreground" size="lg">
                    <Rocket className="w-4 h-4 mr-2" /> Connect Wallet to Launch
                  </Button>
                }
              />
            )}
          </div>
        </div>
        <div className="border-t border-border bg-secondary/20 px-6 py-3">
          <div className="flex items-center justify-center gap-6 sm:gap-10 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><Shield className="w-3 h-3 text-primary" /> OP_RETURN Genesis</span>
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-primary" /> &lt;100ms Fills</span>
            <span className="flex items-center gap-1.5"><Layers className="w-3 h-3 text-primary" /> Merkle Anchoring</span>
          </div>
        </div>
      </motion.div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Status</div>
          <div className="text-sm font-semibold text-foreground mt-1 flex items-center gap-1.5">
            {isConnected ? (
              <><span className="w-1.5 h-1.5 rounded-full bg-green-500" /> Connected</>
            ) : (
              <><span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" /> Not connected</>
            )}
          </div>
          {isConnected && address && (
            <div className="text-[10px] font-mono text-muted-foreground mt-0.5 truncate">{address.slice(0, 8)}…{address.slice(-4)}</div>
          )}
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance</div>
          <div className="text-sm font-mono font-semibold text-foreground mt-1">
            {isConnected && balance ? `${(balance.confirmed / 1e8).toFixed(6)} BTC` : '—'}
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Block Height</div>
          <div className="text-sm font-mono font-semibold text-foreground mt-1">{blockHeight?.toLocaleString() || '—'}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Fee (sat/vB)</div>
          <div className="text-sm font-mono font-semibold text-foreground mt-1">{fees ? `${fees.halfHourFee}` : '—'}</div>
          {fees && <div className="text-[10px] text-muted-foreground mt-0.5">Fast: {fees.fastestFee} · Slow: {fees.hourFee}</div>}
        </div>
      </div>

      {/* Saturn Protocol Explainer */}
      <SaturnProtocolExplainer />

      {/* BTC Network Dashboard */}
      <BtcNetworkDashboard />

      {/* Fee Tiers */}
      {fees && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h3 className="text-sm font-bold text-foreground mb-3">Current Network Fees</h3>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Economy (~1h)', rate: fees.hourFee, cost: ((fees.hourFee * 250) / 1e8) },
              { label: 'Normal (~30m)', rate: fees.halfHourFee, cost: ((fees.halfHourFee * 250) / 1e8) },
              { label: 'Fast (~10m)', rate: fees.fastestFee, cost: ((fees.fastestFee * 250) / 1e8) },
            ].map(tier => (
              <div key={tier.label} className="bg-background rounded-xl p-3 text-center border border-border">
                <div className="text-xs text-muted-foreground">{tier.label}</div>
                <div className="text-lg font-bold text-foreground mt-1">{tier.rate}</div>
                <div className="text-[10px] text-muted-foreground">sat/vB</div>
                <div className="text-xs text-muted-foreground mt-1">~{tier.cost.toFixed(6)} BTC</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BTC Meme Tokens Feed */}
      <BtcMemeTokenFeed />

      {/* Runes */}
      <TrendingRunes />

      {/* Recent Rune Launches */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-sm font-bold text-foreground mb-3">Recent Rune Launches</h3>
        {recentTokens.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground text-sm">No Runes launched yet. Be the first!</p>
            {isConnected ? (
              <Button onClick={() => navigate('/btc/launch')} variant="outline" size="sm" className="mt-3">Launch a Rune</Button>
            ) : (
              <BtcConnectWalletModal trigger={<Button variant="outline" size="sm" className="mt-3">Connect Wallet to Launch</Button>} />
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {recentTokens.map(token => (
              <button
                key={token.id}
                onClick={() => navigate(`/btc/token/${token.id}`)}
                className="w-full flex items-center justify-between bg-background rounded-xl p-3 hover:bg-muted/50 transition-colors text-left border border-transparent hover:border-border"
              >
                <div>
                  <div className="text-sm font-semibold text-foreground">{token.rune_name}</div>
                  <div className="text-xs text-muted-foreground">Supply: {Number(token.supply).toLocaleString()} · Status: {token.status}</div>
                </div>
                <div className="text-right">
                  {token.rugshield_score !== null && (
                    <div className={`text-xs font-mono ${token.rugshield_score <= 25 ? 'text-green-500' : token.rugshield_score <= 50 ? 'text-yellow-500' : 'text-destructive'}`}>
                      RS: {token.rugshield_score}
                    </div>
                  )}
                  <div className="text-[10px] text-muted-foreground">{new Date(token.created_at).toLocaleDateString()}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
