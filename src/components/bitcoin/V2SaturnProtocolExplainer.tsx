import { Shield, Zap, Layers, Hash, Clock, ArrowRight, Lock, Cpu } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    icon: Lock,
    title: 'OP_RETURN Genesis Stamp',
    subtitle: 'Token Birth on Bitcoin Mainnet',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    description: 'Every token is born with an immutable Bitcoin mainnet transaction. An OP_RETURN output encodes the token\'s identity — ticker, name, image hash (SHA-256), creator address, and timestamp — directly into the Bitcoin blockchain.',
    technical: 'OP_RETURN: www.Saturn.Trade|TICKER|NAME|IMG_SHA256|CREATOR|UNIX_TS',
  },
  {
    icon: Zap,
    title: 'Instant Bonding Curve AMM',
    subtitle: '~30s Settlement on Fractal',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    description: 'Trades execute using a constant-product AMM (x·y=k) denominated in satoshis. Virtual reserves provide initial liquidity. Settlement occurs on Fractal Bitcoin with ~30-second block times via merge-mined security.',
    technical: 'price = virtualBtcReserves / virtualTokenReserves · Δy = (y·Δx)/(x+Δx)',
  },
  {
    icon: Cpu,
    title: 'Fractal Bitcoin Settlement',
    subtitle: 'Native UTXO Trade Receipts',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    description: 'Every trade settles as a native UTXO transfer on Fractal Bitcoin (~30s blocks, merge-mined security). Fully verifiable via the Fractal explorer and compatible with Unisat/Xverse wallets — no bridges, no wrapping, pure Bitcoin.',
    technical: 'FRACTAL TX: TAT|BUY|TICKER|AMOUNT|PRICE|WALLET|UTXO_REF',
  },
  {
    icon: Hash,
    title: 'Merkle Anchoring',
    subtitle: 'Solvency Proofs on Mainnet',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    description: 'A Merkle tree of all system balances is computed and its root hash is anchored to Bitcoin mainnet via OP_RETURN every 10 minutes. Anyone can independently verify the platform\'s solvency by reconstructing the tree.',
    technical: 'MERKLE_ROOT = SHA256(SHA256(account₁) || SHA256(account₂) || ...)',
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
            <h3 className="text-base font-bold text-foreground">TAT Protocol — Pure Bitcoin Edition</h3>
            <p className="text-xs text-muted-foreground">Born on Mainnet · Trades on Fractal · Audited on Mainnet · Graduates to Rune at 0.5 BTC</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="px-6 py-4 border-b border-border bg-secondary/10">
        <p className="text-sm text-muted-foreground leading-relaxed">
          The <span className="text-foreground font-semibold">TAT Protocol (Transaction-Attributed Tokens)</span> implements a tri-layer settlement architecture that is 100% Bitcoin-native. 
          Tokens are genesis-stamped on Bitcoin mainnet, trade instantly via Fractal Bitcoin (~30s blocks, merge-mined), 
          and are anchored back to mainnet every 10 minutes with Merkle solvency proofs. Fixed 1% platform fee, zero creator tax. Graduation to native Bitcoin Rune at 0.5 BTC.
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

      {/* Footer */}
      <div className="px-6 py-4 bg-secondary/20 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> ~30s Fractal blocks</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 1% fee · No creator tax</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> 0.5 BTC → Rune</span>
          </div>
        </div>
      </div>
    </div>
  );
}
