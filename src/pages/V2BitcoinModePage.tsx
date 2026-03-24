import { useState, useEffect } from 'react';
import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { V2SaturnProtocolExplainer } from '@/components/bitcoin/V2SaturnProtocolExplainer';
import { BtcNetworkDashboard } from '@/components/bitcoin/BtcNetworkDashboard';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { useBtcMemeTokens } from '@/hooks/useBtcMemeTokens';
import { Rocket, TrendingUp, Zap, Shield, Layers, Cpu } from 'lucide-react';
import { useChain } from '@/contexts/ChainContext';
import { motion } from 'framer-motion';

function formatBtc(v: number) {
  if (v >= 1) return `${v.toFixed(4)} ₿`;
  if (v >= 0.001) return `${v.toFixed(6)} ₿`;
  return `${v.toFixed(8)} ₿`;
}

function V2BtcMemeTokenFeed() {
  const { data: tokens, isLoading } = useBtcMemeTokens();
  const navigate = useNavigate();

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> TAT Meme Tokens
        </h3>
        <span className="text-[10px] text-muted-foreground bg-primary/10 px-2 py-0.5 rounded-full font-semibold text-primary">Pure Bitcoin</span>
      </div>
      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-6">Loading...</p>
      ) : !tokens || tokens.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground text-sm">No TAT tokens launched yet. Be the first!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map(token => {
            const pct = Math.min(token.bonding_progress, 100);
            return (
              <button
                key={token.id}
                onClick={() => navigate(`/v2btc/meme/${token.id}`)}
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

export default function V2BitcoinModePage() {
  const { isConnected, address, balance } = useBtcWallet();
  const { chain, setChain } = useChain();
  const navigate = useNavigate();
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);

  useEffect(() => {
    if (chain !== 'bitcoin') setChain('bitcoin');
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
            <Cpu className="w-3 h-3" /> TAT Protocol — Transaction-Attributed Tokens
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
            TAT Protocol
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto text-sm leading-relaxed">
            Born on <span className="text-foreground font-semibold">Bitcoin Mainnet</span>, 
            trades on <span className="text-foreground font-semibold">Fractal Bitcoin</span> (~30s blocks), 
            audited on <span className="text-foreground font-semibold">Mainnet</span>. 100% Bitcoin-native. No bridges. No alt-chains.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            {isConnected ? (
              <Button onClick={() => navigate('/v2btc/meme/launch')} className="bg-primary hover:bg-primary/90 text-primary-foreground" size="lg">
                <Rocket className="w-4 h-4 mr-2" /> Launch TAT Token
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
            <span className="flex items-center gap-1.5"><Zap className="w-3 h-3 text-primary" /> ~30s Fractal Blocks</span>
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

      {/* V2 Protocol Explainer */}
      <V2SaturnProtocolExplainer />

      {/* BTC Network Dashboard */}
      <BtcNetworkDashboard />

      {/* TAT Meme Tokens Feed */}
      <V2BtcMemeTokenFeed />
    </div>
  );
}
