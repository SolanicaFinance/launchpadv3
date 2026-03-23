import { useState, useEffect } from 'react';
import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { RugShieldPanel } from '@/components/bitcoin/RugShieldPanel';
import { Button } from '@/components/ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

interface FeeEstimates {
  fastestFee: number;
  halfHourFee: number;
  hourFee: number;
  economyFee: number;
}

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1`;

export default function BitcoinLaunchPage() {
  const { isConnected, address, signPsbt } = useBtcWallet();
  const navigate = useNavigate();

  const [runeName, setRuneName] = useState('');
  const [symbol, setSymbol] = useState('');
  const [supply, setSupply] = useState('');
  const [divisibility, setDivisibility] = useState('0');
  const [preminePercent, setPreminePercent] = useState('0');
  const [description, setDescription] = useState('');
  const [lockDays, setLockDays] = useState('0');
  const [fees, setFees] = useState<FeeEstimates | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [rugshieldScore, setRugshieldScore] = useState<number | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/btc-market-data?action=fees`)
      .then(r => r.json())
      .then(setFees)
      .catch(() => {});
  }, []);

  const isFormValid = runeName.trim().length >= 2 && symbol.trim() && supply && parseInt(supply) > 0;

  const handleLaunch = async () => {
    if (!isFormValid || !address) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/btc-rune-launch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'prepare-etch',
          runeName,
          runeSymbol: symbol,
          supply,
          divisibility,
          preminePercent: parseFloat(preminePercent) || 0,
          description,
          lockDays,
          creatorWallet: address,
          rugshieldScore,
        }),
      });

      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
        return;
      }

      toast.success(`Rune "${runeName}" registered! Token ID: ${data.tokenId?.slice(0, 8)}...`);
      
      if (data.message) {
        toast.info(data.message, { duration: 6000 });
      }

      if (data.tokenId) {
        navigate(`/btc/token/${data.tokenId}`);
      }
    } catch (e) {
      toast.error('Launch failed — check connection');
    } finally {
      setSubmitting(false);
    }
  };

  const estimatedVsize = 250;
  const selectedFeeRate = fees?.halfHourFee || 10;
  const estimatedFeeSats = estimatedVsize * selectedFeeRate;
  const estimatedFeeBtc = estimatedFeeSats / 1e8;

  if (!isConnected) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-5xl">₿</div>
          <h2 className="text-2xl font-bold text-foreground">Connect Bitcoin Wallet</h2>
          <p className="text-muted-foreground text-sm">Connect your UniSat wallet to launch a Rune.</p>
          <BtcConnectWalletModal />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/btc')} className="text-muted-foreground hover:text-foreground text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-foreground">Launch a Rune</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Launch Form */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-bold text-foreground">Rune Details</h2>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Rune Name</label>
              <input
                type="text"
                value={runeName}
                onChange={e => setRuneName(e.target.value.toUpperCase().replace(/[^A-Z•]/g, ''))}
                placeholder="MY•RUNE•TOKEN"
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Letters and • separators only. Min 13 chars for free etching.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Symbol</label>
                <input
                  type="text"
                  value={symbol}
                  onChange={e => setSymbol(e.target.value.slice(0, 1))}
                  placeholder="🔥"
                  maxLength={1}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Divisibility</label>
                <input
                  type="number"
                  value={divisibility}
                  onChange={e => setDivisibility(e.target.value)}
                  min={0}
                  max={38}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Total Supply</label>
                <input
                  type="number"
                  value={supply}
                  onChange={e => setSupply(e.target.value)}
                  placeholder="1000000000"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground block mb-1.5">Premine %</label>
                <input
                  type="number"
                  value={preminePercent}
                  onChange={e => setPreminePercent(e.target.value)}
                  min={0}
                  max={100}
                  placeholder="10"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground block mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Describe your Rune..."
                rows={3}
                className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
              />
            </div>
          </div>

          {/* Anti-rug timelock */}
          <div>
            <label className="text-sm font-medium text-foreground block mb-1.5">Dev Lock Period</label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: '0', label: 'None' },
                { value: '30', label: '30d' },
                { value: '60', label: '60d' },
                { value: '90', label: '90d' },
              ].map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setLockDays(opt.value)}
                  className={`py-2 rounded-lg text-sm font-medium border transition-colors ${
                    lockDays === opt.value
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Locks premined tokens via Miniscript timelock — builds buyer trust
            </p>
          </div>

          {/* Fee estimate */}
          <div className="bg-background rounded-lg p-4 space-y-2">
            <h4 className="text-sm font-semibold text-foreground">Estimated Costs</h4>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Network fee ({selectedFeeRate} sat/vB)</span>
              <span className="text-foreground font-mono">{estimatedFeeBtc.toFixed(6)} BTC</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Platform fee (1%)</span>
              <span className="text-foreground font-mono">On trades only</span>
            </div>
            {fees && (
              <div className="flex gap-2 mt-2">
                {[
                  { label: 'Economy', rate: fees.economyFee },
                  { label: 'Normal', rate: fees.halfHourFee },
                  { label: 'Fast', rate: fees.fastestFee },
                ].map(f => (
                  <div key={f.label} className="flex-1 bg-card rounded p-1.5 text-center">
                    <div className="text-[10px] text-muted-foreground">{f.label}</div>
                    <div className="text-xs font-mono text-foreground">{f.rate} sat/vB</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            onClick={handleLaunch}
            disabled={!isFormValid || submitting}
            className="w-full bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white"
            size="lg"
          >
            {submitting ? 'Preparing Etch...' : 'Etch Rune'}
          </Button>
        </div>

        {/* RugShield Panel */}
        <RugShieldPanel onScoreChange={setRugshieldScore} />
      </div>
    </div>
  );
}
