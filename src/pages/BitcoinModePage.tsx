import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { BtcWalletConnect } from '@/components/bitcoin/BtcWalletConnect';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function BitcoinModePage() {
  const { isConnected, address } = useBtcWallet();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">₿</span>
            <div>
              <h1 className="text-xl font-bold text-foreground">Bitcoin Mode</h1>
              <p className="text-xs text-muted-foreground">Runes Launchpad & Trading Terminal</p>
            </div>
          </div>
          <BtcWalletConnect />
        </div>
      </div>

      {!isConnected ? (
        <BtcConnectWalletModal />
      ) : (
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
          {/* Hero */}
          <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
            <h2 className="text-3xl font-bold text-foreground">
              Launch & Trade Bitcoin Runes
            </h2>
            <p className="text-muted-foreground max-w-lg mx-auto">
              The only platform with Rune etching, RugShield deployer scanning, and PSBT trading — all in one app. Built for whales.
            </p>
            <div className="flex items-center justify-center gap-4 pt-2">
              <Button
                onClick={() => navigate('/btc/launch')}
                className="bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
                size="lg"
              >
                Launch a Rune
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: 'Connected Wallet', value: `${address?.slice(0, 8)}...${address?.slice(-4)}` },
              { label: 'Network', value: 'Bitcoin Mainnet' },
              { label: 'Explorer', value: 'mempool.space' },
            ].map((stat) => (
              <div key={stat.label} className="bg-card border border-border rounded-xl p-4">
                <div className="text-xs text-muted-foreground">{stat.label}</div>
                <div className="text-sm font-semibold text-foreground mt-1">{stat.value}</div>
              </div>
            ))}
          </div>

          {/* Placeholder sections */}
          <div className="bg-card border border-border rounded-2xl p-8 text-center">
            <p className="text-muted-foreground">Trending Runes & recent launches coming soon...</p>
          </div>
        </div>
      )}
    </div>
  );
}
