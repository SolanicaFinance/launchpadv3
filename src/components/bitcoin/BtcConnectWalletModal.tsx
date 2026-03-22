import { Button } from '@/components/ui/button';
import { useBtcWallet } from '@/hooks/useBtcWallet';

interface BtcConnectWalletModalProps {
  onConnect?: () => void;
}

export function BtcConnectWalletModal({ onConnect }: BtcConnectWalletModalProps) {
  const { connect, isInstalled, isConnecting } = useBtcWallet();

  const handleConnect = async () => {
    await connect();
    onConnect?.();
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6">
        <div className="text-5xl">₿</div>
        <h2 className="text-2xl font-bold text-foreground">Connect Bitcoin Wallet</h2>
        <p className="text-muted-foreground text-sm">
          Bitcoin Mode uses native BTC wallets. Connect your UniSat or Xverse wallet to continue.
        </p>

        <div className="space-y-3">
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="w-full bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white font-semibold"
            size="lg"
          >
            {isConnecting
              ? 'Connecting...'
              : isInstalled
                ? 'Connect UniSat Wallet'
                : 'Install UniSat Wallet'}
          </Button>

          {!isInstalled && (
            <p className="text-xs text-muted-foreground">
              Don't have UniSat?{' '}
              <a
                href="https://unisat.io"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Download here
              </a>
            </p>
          )}
        </div>

        <div className="pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Bitcoin Runes • Whale-grade trading • RugShield protection
          </p>
        </div>
      </div>
    </div>
  );
}
