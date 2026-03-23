import { useBtcWallet } from '@/hooks/useBtcWallet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, ExternalLink, Copy, Check, LogOut } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { BtcConnectWalletModal } from './BtcConnectWalletModal';

import unisatLogo from '@/assets/wallets/unisat.png';
import xverseLogo from '@/assets/wallets/xverse.png';
import leatherLogo from '@/assets/wallets/leather.png';
import okxLogo from '@/assets/wallets/okx.png';
import phantomLogo from '@/assets/wallets/phantom.png';

const WALLET_IMAGES: Record<string, string> = {
  unisat: unisatLogo,
  xverse: xverseLogo,
  leather: leatherLogo,
  okx: okxLogo,
  phantom: phantomLogo,
};

export function BtcWalletConnect() {
  const { address, balance, isConnected, disconnect, activeProvider, availableWallets } = useBtcWallet();
  const [copied, setCopied] = useState(false);

  const providerName = availableWallets.find(w => w.id === activeProvider)?.name || 'BTC Wallet';
  const providerLogo = activeProvider ? WALLET_IMAGES[activeProvider] : null;

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
            {providerLogo && (
              <img src={providerLogo} alt={providerName} className="w-4 h-4 rounded" />
            )}
            <span className="text-xs font-mono text-foreground">
              {address.slice(0, 6)}…{address.slice(-4)}
            </span>
            {balance && (
              <span className="text-xs font-mono text-primary">
                {(balance.confirmed / 1e8).toFixed(6)} ₿
              </span>
            )}
            <ChevronDown className="h-3 w-3 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60 bg-card border-border">
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2.5">
            {providerLogo && (
              <img src={providerLogo} alt={providerName} className="w-6 h-6 rounded-md" />
            )}
            <div className="min-w-0">
              <div className="text-xs font-semibold text-foreground">{providerName}</div>
              <div className="text-[11px] font-mono text-muted-foreground truncate">{address}</div>
            </div>
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
            <LogOut className="h-3.5 w-3.5 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Not connected — show the modal trigger
  return (
    <BtcConnectWalletModal
      trigger={
        <Button
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
          size="sm"
        >
          Connect Wallet
        </Button>
      }
    />
  );
}
