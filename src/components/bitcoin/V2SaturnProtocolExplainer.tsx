import { Shield, Zap, Layers, Hash, Clock, ArrowRight, Lock, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    icon: Lock,
    title: 'OP_RETURN Genesis Stamp',
    subtitle: 'Token Birth on Bitcoin Mainnet',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    description: 'Every TAT token\'s existence is permanently recorded on Bitcoin Mainnet via an OP_RETURN transaction at creation time. The payload encodes protocol prefix (TAT\\x01), token ID, ticker, supply, creator pubkey hash, and timestamp — all within Bitcoin\'s 80-byte OP_RETURN limit (~63 bytes actual).',
    technical: 'OP_RETURN TAT\\x01 <version> <token_id> <ticker> <supply> <creator_pubkey_hash> <timestamp>',
  },
  {
    icon: Zap,
    title: 'Constant-Product AMM (CPAMM)',
    subtitle: 'Instant Execution on Saturn Layer',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    description: 'Trades execute using x·y=k bonding curve denominated in satoshis. Virtual reserves (0.3 BTC + 1.073B tokens) provide initial liquidity. 800M tokens available for purchase. Fees deducted BEFORE entering the pool — 1% platform fee + 0-8% creator fee.',
    technical: 'x·y=k | Δy = (y·Δx)/(x+Δx) | Graduation at real_btc_reserves ≥ 0.5 BTC',
  },
  {
    icon: Cpu,
    title: 'Layer 2 Proof Receipts',
    subtitle: 'Execution Verification',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    description: 'Each trade generates a verifiable proof receipt on the execution layer. V1 Hybrid uses Solana SPL Memo (~400ms finality, ~0.000005 SOL/proof). V2 Pure Bitcoin uses Fractal Bitcoin OP_RETURN (~30s blocks, merge-mined). Both provide cryptographic trade verification.',
    technical: 'MEMO: TAT|<trade_id>|<token_id>|<type>|<btc_amount>|<token_amount>|<price>|<timestamp>',
  },
  {
    icon: Hash,
    title: 'Merkle Solvency Anchoring',
    subtitle: 'State Proofs on Bitcoin Mainnet',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    description: 'Periodically, the entire protocol state is anchored to Bitcoin Mainnet. A SHA-256 Merkle tree of all balances produces a root hash recorded via OP_RETURN. Anyone can independently verify platform solvency by reconstructing the tree against the published root.',
    technical: 'OP_RETURN TAT_ANCHOR <merkle_root_32B> <epoch_4B> <token_count_4B> <account_count_4B>',
  },
];

export function V2SaturnProtocolExplainer() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">TAT Protocol — Graduated Rune Architecture</h3>
            <p className="text-xs text-muted-foreground">Genesis on Bitcoin L1 · Trades on Saturn Execution Layer · Graduates to Native Rune at 0.5 BTC</p>
          </div>
        </div>
      </div>

      {/* Intro — matches PDF Section 1 Executive Summary */}
      <div className="px-6 py-4 border-b border-border bg-secondary/10">
        <p className="text-sm text-muted-foreground leading-relaxed">
          <span className="text-foreground font-semibold">TAT (Transaction-Attributed Tokens)</span> implements a hybrid lifecycle model where tokens are born as platform-managed assets with Bitcoin-grade provenance, then graduate to native Bitcoin Runes upon reaching bonding curve completion.
          Phase 1: Virtual bonding curve on Saturn's execution layer, with Bitcoin OP_RETURN genesis proof.
          Phase 2: Native Rune etched on Bitcoin L1, visible in all compatible wallets (UniSat, Xverse, Leather, OKX).
          Architecturally analogous to pump.fun → Raydium graduation, but for Bitcoin-native assets.
        </p>
      </div>

      {/* Steps */}
      <div className="divide-y divide-border">
        {steps.map((step, i) => (
          <motion.div
            key={step.title}
            initial={{ opacity: 0, x: -10 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="px-6 py-5 hover:bg-secondary/20 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className={`w-10 h-10 rounded-xl ${step.bg} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                <step.icon className={`w-5 h-5 ${step.color}`} />
              </div>
              <div className="flex-1 min-w-0 space-y-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Layer {i + 1}</span>
                    <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
                    <span className={`text-xs font-semibold ${step.color}`}>{step.subtitle}</span>
                  </div>
                  <h4 className="text-sm font-bold text-foreground mt-1">{step.title}</h4>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                <div className="bg-background rounded-lg px-3 py-2 border border-border">
                  <code className="text-[10px] font-mono text-primary break-all">{step.technical}</code>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Graduation Section — from PDF Section 4 */}
      <div className="px-6 py-5 border-t border-border bg-secondary/10">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-400/10 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Layers className="w-5 h-5 text-orange-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h4 className="text-sm font-bold text-foreground">Graduation → Native Bitcoin Rune</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">
              When real_btc_reserves ≥ 0.5 BTC: trading locks → balance snapshot & Merkle anchor → Rune etched on Bitcoin L1 → Runes distributed to all holders proportionally → remaining ~0.498 BTC permanently locked as LP (tokens burned). Post-graduation: native Rune visible in UniSat, Xverse, Leather, OKX, and tradable on Magic Eden + Saturn DEX.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[10px]">
              <div className="bg-background rounded-lg px-2 py-1.5 border border-border">
                <span className="text-muted-foreground">Etching cost</span>
                <span className="block font-mono text-foreground">~3,000 sats</span>
              </div>
              <div className="bg-background rounded-lg px-2 py-1.5 border border-border">
                <span className="text-muted-foreground">LP locked</span>
                <span className="block font-mono text-foreground">~99.5% of pool</span>
              </div>
              <div className="bg-background rounded-lg px-2 py-1.5 border border-border">
                <span className="text-muted-foreground">DEX fee</span>
                <span className="block font-mono text-foreground">0.5% post-grad</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 bg-secondary/20 border-t border-border">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> Instant execution</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 1% platform + 0-8% creator</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> 0.5 BTC → Native Rune</span>
          </div>
        </div>
      </div>
    </div>
  );
}
