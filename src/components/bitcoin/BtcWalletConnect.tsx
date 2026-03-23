import { useBtcWallet, BtcWalletInfo } from '@/hooks/useBtcWallet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export function BtcWalletConnect() {
  const { address, balance, isConnected, connect, disconnect, isConnecting, activeProvider, availableWallets } = useBtcWallet();
  const [copied, setCopied] = useState(false);

  const installedWallets = availableWallets.filter(w => w.installed);
  const providerName = availableWallets.find(w => w.id === activeProvider)?.name || 'BTC Wallet';

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied');
    setTimeout(() => setCopied(false), 1500);
  };

  if (isConnected && address) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 bg-secondary/50 border border-border hover:bg-secondary"
          >
            <span className="text-xs font-mono text-foreground">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            {balance && (
              <span className="text-xs font-mono text-[hsl(30,100%,50%)]">
                {(balance.confirmed / 1e8).toFixed(6)} ₿
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56 bg-card border-border">
          <div className="px-3 py-2 border-b border-border">
            <div className="text-xs text-muted-foreground">{providerName}</div>
            <div className="text-xs font-mono text-foreground truncate">{address}</div>
          </div>
          <DropdownMenuItem onClick={copyAddress} className="cursor-pointer">
            {copied ? <Check className="h-3.5 w-3.5 mr-2 text-green-500" /> : <Copy className="h-3.5 w-3.5 mr-2" />}
            Copy Address
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="cursor-pointer">
            <a
              href={`https://mempool.space/address/${address}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="h-3.5 w-3.5 mr-2" />
              View on Mempool
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={disconnect} className="cursor-pointer text-destructive focus:text-destructive">
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Multiple wallets installed → show dropdown
  if (installedWallets.length > 1) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            disabled={isConnecting}
            className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
            size="sm"
          >
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 bg-card border-border">
          {installedWallets.map(w => (
            <DropdownMenuItem
              key={w.id}
              onClick={() => connect(w.id)}
              className="cursor-pointer flex items-center gap-3 py-2.5"
            >
              <span className="text-lg">{w.icon}</span>
              <span className="font-medium">{w.name}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Single or no wallets
  return (
    <Button
      onClick={() => connect()}
      disabled={isConnecting}
      className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
      size="sm"
    >
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
}
