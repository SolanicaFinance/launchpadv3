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
    <div className="space-y-3 pt-2">
      <Button
        onClick={handleConnect}
        disabled={isConnecting}
        className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white font-semibold"
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
  );
}
