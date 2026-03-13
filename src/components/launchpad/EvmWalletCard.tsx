import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, ExternalLink, AlertCircle, Copy, Check, LogOut } from 'lucide-react';
import { useEvmWallet } from '@/hooks/useEvmWallet';
import { useState } from 'react';
import { toast } from 'sonner';

export function EvmWalletCard() {
  const { 
    address, 
    shortAddress, 
    isConnected, 
    balance, 
    isOnBase, 
    switchToBase,
    connect,
    disconnect,
    isBalanceLoading 
  } = useEvmWallet();
  
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!address) return;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('Address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-card/50 backdrop-blur border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wallet className="h-5 w-5 text-blue-400" />
          Base Wallet
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Connect your wallet to launch tokens on Base
            </p>
            <Button 
              onClick={connect}
              className="w-full bg-blue-500 hover:bg-blue-600"
            >
              <Wallet className="mr-2 h-4 w-4" />
              Connect Wallet
            </Button>
          </div>
        ) : (
          <>
            {/* Connected Address */}
            <div className="flex items-center justify-between p-3 bg-secondary/30 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-mono">{shortAddress}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </Button>
                <a
                  href={`https://basescan.org/address/${address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-primary transition-colors p-1"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            {/* Chain Warning */}
            {!isOnBase && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                <span className="text-sm text-destructive">Wrong network</span>
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={switchToBase}
                  className="ml-auto text-xs"
                >
                  Switch to Base
                </Button>
              </div>
            )}

            {/* Balance */}
            <div className="space-y-2">
              <div className="flex justify-between items-center p-2 bg-secondary/20 rounded">
                <span className="text-sm text-muted-foreground">ETH Balance</span>
                <span className="font-mono font-medium">
                  {isBalanceLoading ? (
                    <span className="text-muted-foreground">...</span>
                  ) : (
                    <span className="text-blue-400">{balance} ETH</span>
                  )}
                </span>
              </div>
            </div>

            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => disconnect()}
              className="w-full"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Disconnect Wallet
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
