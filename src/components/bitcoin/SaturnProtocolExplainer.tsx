import { Shield, Zap, Layers, Hash, Clock, ArrowRight, Lock } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  {
    icon: Lock,
    title: 'OP_RETURN Genesis Stamp',
    subtitle: 'Token Birth on Bitcoin L1',
    color: 'text-orange-400',
    bg: 'bg-orange-400/10',
    description: 'Every token is born with an immutable Bitcoin transaction. An OP_RETURN output encodes the token\'s identity — ticker, name, image hash (SHA-256), creator address, and timestamp — directly into the Bitcoin blockchain.',
    technical: 'OP_RETURN: www.Saturn.Trade|TICKER|NAME|IMG_SHA256|CREATOR|UNIX_TS',
  },
  {
    icon: Zap,
    title: 'Instant Bonding Curve AMM',
    subtitle: 'Sub-second Trading on Saturn',
    color: 'text-yellow-400',
    bg: 'bg-yellow-400/10',
    description: 'Trades execute instantly using a constant-product AMM (x·y=k) denominated in satoshis. Virtual reserves provide initial liquidity. No blockchain confirmations needed — balances update in real-time.',
    technical: 'price = virtualBtcReserves / virtualTokenReserves · Δy = (y·Δx)/(x+Δx)',
  },
  {
    icon: Layers,
    title: 'L2 Proof Receipts',
    subtitle: 'Immutable Trade Verification',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    description: 'Every trade generates a cryptographic proof receipt on the Saturn Execution Layer, creating an immutable verification trail linked to the Bitcoin genesis stamp.',
    technical: 'OP_RETURN TAT_TRADE|TICKER|AMOUNT|PRICE|WALLET|TXID',
  },
  {
    icon: Hash,
    title: 'Merkle Anchoring',
    subtitle: 'Solvency Proofs Every 10 Minutes',
    color: 'text-green-400',
    bg: 'bg-green-400/10',
    description: 'A Merkle tree of all system balances is computed and its root hash is anchored to Bitcoin via OP_RETURN every 10 minutes. Anyone can independently verify the platform\'s solvency by reconstructing the tree.',
    technical: 'MERKLE_ROOT = SHA256(SHA256(account₁) || SHA256(account₂) || ...)',
  },
];

export function SaturnProtocolExplainer() {
  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">Saturn BTC Protocol</h3>
            <p className="text-xs text-muted-foreground">How we invented instant Bitcoin meme trading</p>
          </div>
        </div>
      </div>

      {/* Intro */}
      <div className="px-6 py-4 border-b border-border bg-secondary/10">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Saturn pioneered a <span className="text-foreground font-semibold">hybrid settlement architecture</span> that combines 
          Bitcoin's security with Solana's speed. Tokens are born on Bitcoin, traded instantly via internal bonding curves, 
          verified through Solana memo receipts, and anchored back to Bitcoin every 10 minutes with Merkle solvency proofs.
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
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Step {i + 1}</span>
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
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 10min anchoring</span>
            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> 1% platform fee</span>
            <span className="flex items-center gap-1"><Zap className="w-3 h-3" /> &lt;100ms fills</span>
          </div>
        </div>
      </div>
    </div>
  );
}
