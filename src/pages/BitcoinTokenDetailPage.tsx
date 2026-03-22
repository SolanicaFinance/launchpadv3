import { useParams, useNavigate } from 'react-router-dom';
import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { BtcWalletConnect } from '@/components/bitcoin/BtcWalletConnect';
import { Button } from '@/components/ui/button';

export default function BitcoinTokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isConnected } = useBtcWallet();
  const navigate = useNavigate();

  if (!isConnected) {
    return <BtcConnectWalletModal />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/btc')} className="text-muted-foreground hover:text-foreground text-sm">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-foreground">Rune Token</h1>
            <span className="text-xs text-muted-foreground font-mono">{id?.slice(0, 12)}...</span>
          </div>
          <BtcWalletConnect />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Chart area */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 min-h-[400px] flex items-center justify-center">
            <p className="text-muted-foreground">Chart data via Codex API coming soon...</p>
          </div>

          {/* Trade panel */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <h3 className="font-bold text-foreground">Trade</h3>
            <p className="text-xs text-muted-foreground">
              PSBT-based orderbook trading via Magic Eden Runes API. 1% platform fee included.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Amount (Runes)</label>
                <input
                  type="number"
                  placeholder="0"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  className="bg-[hsl(160,84%,39%)] hover:bg-[hsl(160,84%,34%)] text-white"
                  disabled
                >
                  Buy
                </Button>
                <Button variant="destructive" disabled>
                  Sell
                </Button>
              </div>

              <p className="text-[10px] text-muted-foreground text-center">
                ~10 min confirmation • $5-34 network fee • 1% platform fee
              </p>
            </div>

            {/* Token info */}
            <div className="pt-4 border-t border-border space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Token Info</h4>
              <p className="text-xs text-muted-foreground">
                Rune metadata from Hiro API coming soon...
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
