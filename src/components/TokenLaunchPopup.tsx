import { useState, useEffect } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import saturnLogo from '@/assets/saturn-logo.png';

const TOKEN_CA = '0x27a51c96b84c6d9f24d5d054c396ae0e1c96ffff';
const POPUP_KEY = 'saturn-launch-popup-dismissed-v3';

export function TokenLaunchPopup() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dismissed = sessionStorage.getItem(POPUP_KEY);
    if (!dismissed) {
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setOpen(false);
    sessionStorage.setItem(POPUP_KEY, 'true');
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(TOKEN_CA);
    setCopied(true);
    toast.success('Contract address copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="sm:max-w-md border-primary/30 bg-card/95 backdrop-blur-xl p-0 gap-0 overflow-hidden">
        {/* Header glow */}
        <div className="relative px-6 pt-6 pb-4">
          <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent" />
          <div className="relative flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/30 flex items-center justify-center">
              <span className="text-3xl">🪐</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">🪐 Saturn is Live on Binance Chain!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Our native token is now live. Copy the contract address below to get started.
              </p>
            </div>
          </div>
        </div>

        {/* CA Section */}
        <div className="px-6 pb-4">
          <div className="bg-secondary/50 rounded-xl p-3 border border-border">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">Contract Address</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs font-mono text-foreground break-all leading-relaxed">
                {TOKEN_CA}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={handleCopy}
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex flex-col gap-2">
          <Button
            className="w-full bg-primary hover:bg-primary/90"
            onClick={handleCopy}
          >
            {copied ? 'Copied!' : 'Copy Contract Address'}
            <Copy className="h-3.5 w-3.5 ml-2" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={handleDismiss}
          >
            Dismiss
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
