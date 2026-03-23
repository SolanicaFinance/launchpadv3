import { useState, useEffect } from 'react';
import { Activity, Cpu, Database, Clock, Box, Pickaxe, TrendingUp, Layers } from 'lucide-react';
import { motion } from 'framer-motion';

interface MempoolStats { count: number; vsize: number; total_fee: number; }
interface HashrateData { hashrate: number | null; difficulty: number | null; difficultyChange: number | null; remainingBlocks: number | null; progressPercent: number | null; estimatedRetargetDate: string | null; }
interface SupplyData { totalSupply: number; circulatingSupply: number; percentMined: string; currentSubsidy: number; currentEpoch: number; nextHalvingBlock: number; blocksUntilHalving: number; halvingEstimateDate: string; }
interface BlockInfo { height: number; hash: string; timestamp: number; tx_count: number; size: number; pool: string; totalFees: number | null; }

function formatHash(h: number | null): string {
  if (!h) return '—';
  const eh = h / 1e18;
  if (eh >= 1000) return `${(eh / 1000).toFixed(1)} ZH/s`;
  return `${eh.toFixed(1)} EH/s`;
}

function formatDifficulty(d: number | null): string {
  if (!d) return '—';
  const t = d / 1e12;
  return `${t.toFixed(2)} T`;
}

function formatBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)} MB`;
  return `${(b / 1e3).toFixed(0)} KB`;
}

function timeAgo(ts: number): string {
  const diff = Math.floor(Date.now() / 1000 - ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

export function BtcNetworkDashboard() {
  const [mempool, setMempool] = useState<MempoolStats | null>(null);
  const [hashrate, setHashrate] = useState<HashrateData | null>(null);
  const [supply, setSupply] = useState<SupplyData | null>(null);
  const [blocks, setBlocks] = useState<BlockInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
    const base = `https://${projectId}.supabase.co/functions/v1/btc-market-data`;

    Promise.all([
      fetch(`${base}?action=mempool-stats`).then(r => r.json()).catch(() => null),
      fetch(`${base}?action=hashrate`).then(r => r.json()).catch(() => null),
      fetch(`${base}?action=supply`).then(r => r.json()).catch(() => null),
      fetch(`${base}?action=recent-blocks`).then(r => r.json()).catch(() => null),
    ]).then(([mem, hash, sup, blk]) => {
      if (mem && !mem.error) setMempool(mem);
      if (hash && !hash.error) setHashrate(hash);
      if (sup && !sup.error) setSupply(sup);
      if (blk?.blocks) setBlocks(blk.blocks);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-1/4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[...Array(8)].map((_, i) => <div key={i} className="h-20 bg-muted rounded-xl" />)}
          </div>
        </div>
      </div>
    );
  }

  const halvingDays = supply ? Math.floor(supply.blocksUntilHalving * 10 / 1440) : null;

  return (
    <div className="space-y-4">
      {/* Stats Grid */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" /> Bitcoin Network Live
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Mempool */}
          <StatCard icon={Database} label="Mempool TXs" value={mempool?.count?.toLocaleString() || '—'} sub={mempool ? `${formatBytes(mempool.vsize)} vsize` : undefined} />
          <StatCard icon={TrendingUp} label="Mempool Fees" value={mempool ? `${(mempool.total_fee / 1e8).toFixed(4)} BTC` : '—'} sub="total pending" />
          {/* Hashrate */}
          <StatCard icon={Cpu} label="Hashrate" value={formatHash(hashrate?.hashrate || null)} sub={hashrate?.difficultyChange ? `${hashrate.difficultyChange > 0 ? '+' : ''}${hashrate.difficultyChange.toFixed(2)}% adj` : undefined} />
          <StatCard icon={Pickaxe} label="Difficulty" value={formatDifficulty(hashrate?.difficulty || null)} sub={hashrate?.remainingBlocks ? `${hashrate.remainingBlocks} blocks to retarget` : undefined} />
          {/* Supply */}
          <StatCard icon={Layers} label="Circulating" value={supply ? `${(supply.circulatingSupply / 1e6).toFixed(3)}M` : '—'} sub={supply ? `${supply.percentMined}% mined` : undefined} />
          <StatCard icon={Box} label="Block Subsidy" value={supply ? `${supply.currentSubsidy} BTC` : '—'} sub={supply ? `Epoch ${supply.currentEpoch}` : undefined} />
          <StatCard icon={Clock} label="Next Halving" value={halvingDays !== null ? `${halvingDays}d` : '—'} sub={supply ? `Block #${supply.nextHalvingBlock.toLocaleString()}` : undefined} />
          <StatCard icon={Activity} label="Blocks Left" value={supply?.blocksUntilHalving?.toLocaleString() || '—'} sub="until halving" />
        </div>
      </div>

      {/* Recent Blocks */}
      {blocks.length > 0 && (
        <div className="bg-card border border-border rounded-2xl p-5">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2 mb-3">
            <Box className="w-4 h-4 text-primary" /> Recent Blocks
          </h3>
          <div className="space-y-1.5">
            {blocks.map((block, i) => (
              <motion.a
                key={block.height}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                href={`https://mempool.space/block/${block.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-secondary/40 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-primary w-16">#{block.height.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground">{block.tx_count} txs</span>
                  <span className="text-xs text-muted-foreground hidden sm:inline">· {formatBytes(block.size)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-medium text-foreground/70">{block.pool}</span>
                  {block.totalFees !== null && (
                    <span className="text-[10px] text-muted-foreground font-mono">{(block.totalFees / 1e8).toFixed(4)} BTC fees</span>
                  )}
                  <span className="text-[10px] text-muted-foreground">{timeAgo(block.timestamp)}</span>
                </div>
              </motion.a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-background border border-border rounded-xl p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <Icon className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-sm font-mono font-bold text-foreground">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}
