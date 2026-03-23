import { useBtcWallet } from '@/hooks/useBtcWallet';
import { Button } from '@/components/ui/button';
import { Wallet } from 'lucide-react';

interface BtcConnectWalletModalProps {
  onConnect?: () => void;
}

export function BtcConnectWalletModal({ onConnect }: BtcConnectWalletModalProps) {
  const { connect, isConnecting, availableWallets } = useBtcWallet();

  const installedWallets = availableWallets.filter(w => w.installed);
  const notInstalledWallets = availableWallets.filter(w => !w.installed);

  const handleConnect = async (providerId?: string) => {
    await connect(providerId as any);
    onConnect?.();
  };

  return (
    <div className="space-y-4 pt-2 max-w-sm mx-auto">
      {installedWallets.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground text-center mb-3">
            {installedWallets.length} wallet{installedWallets.length > 1 ? 's' : ''} detected
          </p>
          {installedWallets.map(w => (
            <Button
              key={w.id}
              onClick={() => handleConnect(w.id)}
              disabled={isConnecting}
              variant="outline"
              className="w-full flex items-center justify-between gap-3 h-12 border-border hover:border-[hsl(30,100%,50%)]/50 hover:bg-[hsl(30,100%,50%)]/5"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">{w.icon}</span>
                <span className="font-semibold">{w.name}</span>
              </div>
              <span className="text-xs text-muted-foreground">Detected</span>
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Wallet className="w-4 h-4" />
            <span className="text-sm">No Bitcoin wallets detected</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Install a Bitcoin wallet extension to get started
          </p>
        </div>
      )}

      {notInstalledWallets.length > 0 && (
        <div className="border-t border-border pt-3">
          <p className="text-xs text-muted-foreground mb-2">Get a wallet:</p>
          <div className="flex flex-wrap gap-2 justify-center">
            {notInstalledWallets.map(w => (
              <a
                key={w.id}
                href={w.downloadUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-primary hover:underline px-2 py-1 bg-secondary/50 rounded-md"
              >
                <span>{w.icon}</span>
                {w.name}
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
