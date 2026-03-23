import { useBtcWallet, BtcWalletProvider } from '@/hooks/useBtcWallet';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ExternalLink, Loader2, ChevronRight, Shield, ChevronDown, Star } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BtcWalletBrandIcon } from './BtcWalletBrandIcon';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BtcConnectWalletModalProps {
  onConnect?: () => void;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const WALLET_DESCRIPTIONS: Record<string, string> = {
  unisat: 'Most popular BTC wallet for Ordinals & Runes',
  xverse: 'Full-featured Bitcoin & Stacks wallet',
  leather: 'Secure Bitcoin wallet by Trust Machines',
  okx: 'Multi-chain wallet with BTC support',
  phantom: 'Multi-chain wallet with Bitcoin support',
};

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function BtcConnectWalletModal({ onConnect, trigger, open: controlledOpen, onOpenChange }: BtcConnectWalletModalProps) {
  const { connect, isConnecting, availableWallets } = useBtcWallet();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [internalOpen, setInternalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [othersOpen, setOthersOpen] = useState(false);

  const isOpen = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const inIframe = isInIframe();

  // Split wallets: UniSat is always primary, rest are secondary
  const unisatWallet = availableWallets.find(w => w.id === 'unisat');
  const otherWallets = availableWallets.filter(w => w.id !== 'unisat');
  const otherInstalled = otherWallets.filter(w => w.installed);
  const otherNotInstalled = otherWallets.filter(w => !w.installed);

  const handleConnect = useCallback(async (walletId: string) => {
    setConnectingId(walletId);
    setError(null);
    try {
      await connect(walletId as BtcWalletProvider);
      setOpen(false);
      onConnect?.();
    } catch (e: any) {
      setError(e?.message || 'Connection failed. Please try again.');
    } finally {
      setConnectingId(null);
    }
  }, [connect, onConnect, setOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" size="sm">
            Connect Wallet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 bg-card border-border overflow-hidden">
        <div className="px-6 pt-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-foreground text-center">
              Connect a Bitcoin Wallet
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground text-center mt-1.5">
            Choose your preferred wallet to get started
          </p>
        </div>

        {/* Iframe warning banner */}
        {inIframe && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
            <p className="text-[11px] text-primary">
              ⚡ Preview mode detected. UniSat will open in a new tab for connection.
            </p>
          </div>
        )}

        <div className="px-4 py-3 space-y-1.5 max-h-[360px] overflow-y-auto">
          {/* UniSat — always first, always prominent */}
          {unisatWallet && (
            <>
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold px-2 pt-1 pb-1">
                Recommended
              </p>
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => handleConnect('unisat')}
                disabled={isConnecting}
                className="w-full flex items-center gap-3 px-3 py-3.5 rounded-xl bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-all duration-150 disabled:opacity-50 group relative"
              >
                <div className="flex-shrink-0">
                  <BtcWalletBrandIcon walletId="unisat" name="UniSat" size="md" />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">UniSat</span>
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-primary/15 text-[9px] font-bold text-primary uppercase tracking-wide">
                      <Star className="w-2.5 h-2.5" />
                      Preferred
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {WALLET_DESCRIPTIONS.unisat}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  {connectingId === 'unisat' ? (
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-0.5 transition-transform" />
                  )}
                </div>
              </motion.button>
            </>
          )}

          {/* Other wallets in collapsible */}
          {otherWallets.length > 0 && (
            <Collapsible open={othersOpen} onOpenChange={setOthersOpen} className="pt-2">
              <CollapsibleTrigger className="w-full flex items-center justify-between px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-semibold hover:text-foreground transition-colors">
                <span>Other wallets ({otherWallets.length})</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${othersOpen ? 'rotate-180' : ''}`} />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-1 pt-1">
                <AnimatePresence>
                  {otherInstalled.map((w, i) => (
                    <motion.button
                      key={w.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      onClick={() => handleConnect(w.id)}
                      disabled={isConnecting}
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary/60 transition-all duration-150 disabled:opacity-50 group relative"
                    >
                      <div className="flex-shrink-0">
                        <BtcWalletBrandIcon walletId={w.id} name={w.name} size="md" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{w.name}</span>
                          <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {WALLET_DESCRIPTIONS[w.id] || 'Bitcoin wallet'}
                        </p>
                      </div>
                      <div className="flex-shrink-0">
                        {connectingId === w.id ? (
                          <Loader2 className="w-4 h-4 text-primary animate-spin" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        )}
                      </div>
                    </motion.button>
                  ))}
                  {otherNotInstalled.map((w) => (
                    <a
                      key={w.id}
                      href={w.connectUrl || w.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary/40 transition-all duration-150 group"
                    >
                      <div className="flex-shrink-0">
                        <BtcWalletBrandIcon walletId={w.id} name={w.name} size="md" muted />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <span className="font-medium text-sm text-foreground/80 group-hover:text-foreground transition-colors">{w.name}</span>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {WALLET_DESCRIPTIONS[w.id] || 'Bitcoin wallet'}
                        </p>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/70 group-hover:text-foreground flex-shrink-0" />
                    </a>
                  ))}
                </AnimatePresence>
              </CollapsibleContent>
            </Collapsible>
          )}

          {availableWallets.length === 0 && (
            <div className="text-center py-8 space-y-2">
              <p className="text-sm text-muted-foreground">Loading wallet extensions…</p>
              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin mx-auto" />
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        <div className="px-6 py-3 border-t border-border bg-secondary/20">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Shield className="w-3 h-3" />
            <span>Non-custodial. We never access your keys.</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
