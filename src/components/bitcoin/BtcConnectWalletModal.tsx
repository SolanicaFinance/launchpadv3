import { useBtcWallet, BtcWalletInfo } from '@/hooks/useBtcWallet';
import { Button } from '@/components/ui/button';
import { Wallet, RefreshCw, ExternalLink } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';

interface BtcConnectWalletModalProps {
  onConnect?: () => void;
}

const WALLET_LOGOS: Record<string, string> = {
  unisat: '🟧',
  xverse: '🟪',
  leather: '🟫',
  okx: '⬛',
  phantom: '👻',
};

export function BtcConnectWalletModal({ onConnect }: BtcConnectWalletModalProps) {
  const { connect, isConnecting, availableWallets } = useBtcWallet();
  const [connectingId, setConnectingId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Re-trigger wallet detection periodically for slow-loading extensions
  useEffect(() => {
    if (retryCount >= 5) return;
    const timer = setTimeout(() => setRetryCount(r => r + 1), 1000);
    return () => clearTimeout(timer);
  }, [retryCount]);

  const installedWallets = availableWallets.filter(w => w.installed);
  const notInstalledWallets = availableWallets.filter(w => !w.installed);

  const handleConnect = useCallback(async (wallet: BtcWalletInfo) => {
    setConnectingId(wallet.id);
    try {
      await connect(wallet.id);
      onConnect?.();
    } finally {
      setConnectingId(null);
    }
  }, [connect, onConnect]);

  const handleRefresh = () => setRetryCount(0);

  return (
    <div className="w-full max-w-sm mx-auto space-y-5">
      {/* Installed wallets */}
      {installedWallets.length > 0 ? (
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <p className="text-xs text-muted-foreground">
              {installedWallets.length} wallet{installedWallets.length > 1 ? 's' : ''} detected
            </p>
            <button
              onClick={handleRefresh}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3 h-3" />
              Refresh
            </button>
          </div>

          {installedWallets.map(w => {
            const isThis = connectingId === w.id;
            return (
              <button
                key={w.id}
                onClick={() => handleConnect(w)}
                disabled={isConnecting}
                className="w-full flex items-center justify-between gap-3 h-14 px-4 rounded-xl border border-border bg-secondary/30 hover:bg-secondary/60 hover:border-primary/40 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{WALLET_LOGOS[w.id] || '💰'}</span>
                  <span className="font-semibold text-foreground">{w.name}</span>
                </div>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                  isThis
                    ? 'bg-primary/20 text-primary animate-pulse'
                    : 'bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary'
                }`}>
                  {isThis ? 'Connecting…' : 'Detected'}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="space-y-3 py-4">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Wallet className="w-5 h-5" />
            <span className="text-sm font-medium">No Bitcoin wallets detected</span>
          </div>
          <p className="text-xs text-muted-foreground text-center max-w-xs mx-auto">
            Install a Bitcoin wallet browser extension to connect
          </p>
          <div className="flex justify-center">
            <button
              onClick={handleRefresh}
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              Re-scan for wallets
            </button>
          </div>
        </div>
      )}

      {/* Get a wallet section */}
      {notInstalledWallets.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="text-xs text-muted-foreground mb-3 text-center">Get a wallet:</p>
          <div className="grid grid-cols-2 gap-2">
            {notInstalledWallets.map(w => (
              <a
                key={w.id}
                href={w.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-foreground/70 hover:text-foreground px-3 py-2.5 bg-secondary/30 hover:bg-secondary/50 rounded-lg transition-colors border border-transparent hover:border-border"
              >
                <span className="text-base">{WALLET_LOGOS[w.id] || '💰'}</span>
                <span className="font-medium">{w.name}</span>
                <ExternalLink className="w-3 h-3 ml-auto opacity-40" />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
