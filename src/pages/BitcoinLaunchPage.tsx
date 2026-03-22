import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { BtcWalletConnect } from '@/components/bitcoin/BtcWalletConnect';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';

export default function BitcoinLaunchPage() {
  const { isConnected } = useBtcWallet();
  const navigate = useNavigate();

  if (!isConnected) {
    return <BtcConnectWalletModal />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/btc')} className="text-muted-foreground hover:text-foreground text-sm">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-foreground">Launch a Rune</h1>
          </div>
          <BtcWalletConnect />
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Launch Form */}
          <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 space-y-6">
            <h2 className="text-lg font-bold text-foreground">Rune Details</h2>

            <div className="space-y-4">
              {[
                { label: 'Rune Name', placeholder: 'MY•RUNE•TOKEN', type: 'text' },
                { label: 'Symbol', placeholder: 'MRT', type: 'text' },
                { label: 'Total Supply', placeholder: '1000000000', type: 'number' },
                { label: 'Divisibility (0-38)', placeholder: '0', type: 'number' },
                { label: 'Premine %', placeholder: '10', type: 'number' },
                { label: 'Description', placeholder: 'Describe your Rune...', type: 'text' },
              ].map((field) => (
                <div key={field.label}>
                  <label className="text-sm font-medium text-foreground block mb-1.5">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    placeholder={field.placeholder}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              ))}
            </div>

            {/* Anti-rug timelock */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">
                Dev Lock Period
              </label>
              <select className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground">
                <option value="0">No lock</option>
                <option value="30">30 days</option>
                <option value="60">60 days</option>
                <option value="90">90 days</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                Locks premined tokens via Miniscript timelock for trust
              </p>
            </div>

            <Button
              className="w-full bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
              size="lg"
              disabled
            >
              Etch Rune (Coming Soon)
            </Button>
          </div>

          {/* RugShield Panel Placeholder */}
          <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-lg">🛡️</span>
              <h3 className="font-bold text-foreground">RugShield</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Deployer wallet scan powered by GPT-5. Analyzes your wallet history before launch to build trust with buyers.
            </p>
            <div className="bg-background rounded-lg p-4 text-center">
              <p className="text-sm text-muted-foreground">Connect wallet to scan</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
