import { Button } from '@/components/ui/button';
import { useBtcWallet } from '@/hooks/useBtcWallet';

export function BtcWalletConnect() {
  const { address, balance, isConnected, connect, disconnect, isConnecting } = useBtcWallet();

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            {address.slice(0, 6)}...{address.slice(-4)}
          </div>
          {balance && (
            <div className="text-xs font-mono text-foreground">
              {(balance.confirmed / 1e8).toFixed(6)} BTC
            </div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={disconnect}>
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <Button
      onClick={connect}
      disabled={isConnecting}
      className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
      size="sm"
    >
      {isConnecting ? 'Connecting...' : 'Connect BTC Wallet'}
    </Button>
  );
}
