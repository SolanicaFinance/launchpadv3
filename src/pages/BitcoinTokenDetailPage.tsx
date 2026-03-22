import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBtcWallet } from '@/hooks/useBtcWallet';
import { BtcTokenComments } from '@/components/bitcoin/BtcTokenComments';
import { BtcConnectWalletModal } from '@/components/bitcoin/BtcConnectWalletModal';
import { BtcWalletConnect } from '@/components/bitcoin/BtcWalletConnect';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || 'ptwytypavumcrbofspno';
const BASE_URL = `https://${PROJECT_ID}.supabase.co/functions/v1`;

interface RuneOrder {
  id: string;
  unitPrice: string;
  amount: string;
  totalPrice: number;
  seller?: string;
}

export default function BitcoinTokenDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { isConnected, address } = useBtcWallet();
  const navigate = useNavigate();

  const [token, setToken] = useState<any>(null);
  const [listings, setListings] = useState<RuneOrder[]>([]);
  const [runeMarketInfo, setRuneMarketInfo] = useState<any>(null);
  const [trades, setTrades] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyAmount, setBuyAmount] = useState('');
  const [sellAmount, setSellAmount] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [activeTab, setActiveTab] = useState<'buy' | 'sell'>('buy');

  // Fetch token from DB
  useEffect(() => {
    if (!id) return;
    supabase
      .from('btc_tokens')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setToken(data);
        setLoading(false);
      });

    // Fetch trades
    supabase
      .from('btc_trades')
      .select('*')
      .eq('btc_token_id', id)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (data) setTrades(data);
      });
  }, [id]);

  // Fetch Magic Eden listings if rune_id exists
  useEffect(() => {
    if (!token?.rune_id) return;
    
    fetch(`${BASE_URL}/btc-trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-listings', runeId: token.rune_id }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.orders) setListings(data.orders);
      })
      .catch(() => {});

    fetch(`${BASE_URL}/btc-trade`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'get-rune-info', runeId: token.rune_id }),
    })
      .then(r => r.json())
      .then(data => {
        if (!data.error) setRuneMarketInfo(data);
      })
      .catch(() => {});
  }, [token?.rune_id]);

  if (!isConnected) {
    return <BtcConnectWalletModal />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-transparent border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/btc')} className="text-muted-foreground hover:text-foreground text-sm">
              ← Back
            </button>
            <h1 className="text-xl font-bold text-foreground">
              {token?.rune_name || 'Rune Token'}
            </h1>
            {token?.status && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                token.status === 'confirmed' ? 'bg-[hsl(var(--success)/0.1)] text-[hsl(var(--success))]' :
                token.status === 'pending' ? 'bg-[hsl(var(--warning)/0.1)] text-[hsl(var(--warning))]' :
                'bg-muted text-muted-foreground'
              }`}>
                {token.status}
              </span>
            )}
          </div>
          <BtcWalletConnect />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Token info */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Symbol', value: token?.rune_symbol || '—' },
                  { label: 'Supply', value: token?.supply ? Number(token.supply).toLocaleString() : '—' },
                  { label: 'Premine', value: token?.premine_pct ? `${token.premine_pct}%` : '0%' },
                  { label: 'Dev Lock', value: token?.lock_days ? `${token.lock_days}d` : 'None' },
                ].map(s => (
                  <div key={s.label}>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{s.label}</div>
                    <div className="text-sm font-semibold text-foreground mt-1">{s.value}</div>
                  </div>
                ))}
              </div>
              {token?.description && (
                <p className="text-sm text-muted-foreground mt-4 border-t border-border pt-4">
                  {token.description}
                </p>
              )}
              {token?.rugshield_score !== null && token?.rugshield_score !== undefined && (
                <div className="mt-4 border-t border-border pt-4 flex items-center gap-2">
                  <span>🛡️</span>
                  <span className="text-xs text-muted-foreground">RugShield Score:</span>
                  <span className={`text-sm font-bold ${
                    token.rugshield_score <= 25 ? 'text-[hsl(var(--success))]' :
                    token.rugshield_score <= 50 ? 'text-[hsl(var(--warning))]' :
                    'text-destructive'
                  }`}>
                    {token.rugshield_score}
                  </span>
                </div>
              )}
            </div>

            {/* Chart placeholder */}
            <div className="bg-card border border-border rounded-2xl p-6 min-h-[300px] flex items-center justify-center">
              <div className="text-center space-y-2">
                <p className="text-muted-foreground text-sm">Price chart</p>
                <p className="text-xs text-muted-foreground">
                  {token?.rune_id ? 'Codex chart integration available' : 'Chart available after on-chain confirmation'}
                </p>
              </div>
            </div>

            {/* Orderbook / Listings */}
            <div className="bg-card border border-border rounded-2xl p-6">
              <h3 className="text-sm font-bold text-foreground mb-3">Orderbook</h3>
              {listings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {token?.rune_id ? 'No active listings on Magic Eden' : 'Listings available after Rune is etched on-chain'}
                </p>
              ) : (
                <div className="space-y-1">
                  <div className="grid grid-cols-3 text-[10px] text-muted-foreground uppercase tracking-wider pb-2 border-b border-border">
                    <span>Price (sats)</span>
                    <span className="text-right">Amount</span>
                    <span className="text-right">Total (BTC)</span>
                  </div>
                  {listings.slice(0, 10).map((order, i) => (
                    <div key={i} className="grid grid-cols-3 text-xs py-1.5">
                      <span className="text-foreground font-mono">{order.unitPrice}</span>
                      <span className="text-right text-muted-foreground font-mono">{order.amount}</span>
                      <span className="text-right text-foreground font-mono">
                        {(order.totalPrice / 1e8).toFixed(6)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent trades */}
            {trades.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-sm font-bold text-foreground mb-3">Recent Trades</h3>
                <div className="space-y-1">
                  {trades.map(trade => (
                    <div key={trade.id} className="flex items-center justify-between text-xs py-1.5 border-b border-border last:border-0">
                      <div className="flex items-center gap-2">
                        <span className={trade.side === 'buy' ? 'text-[hsl(var(--success))]' : 'text-destructive'}>
                          {trade.side.toUpperCase()}
                        </span>
                        <span className="text-muted-foreground font-mono">
                          {trade.trader_wallet?.slice(0, 6)}...
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-foreground font-mono">{trade.btc_amount} BTC</span>
                        <span className={`ml-2 text-[10px] ${
                          trade.status === 'confirmed' ? 'text-[hsl(var(--success))]' : 'text-[hsl(var(--warning))]'
                        }`}>
                          {trade.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Trade panel */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-foreground">Trade</h3>

              {/* Buy/Sell tabs */}
              <div className="grid grid-cols-2 gap-1 bg-background rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('buy')}
                  className={`py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'buy'
                      ? 'bg-[hsl(var(--success))] text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Buy
                </button>
                <button
                  onClick={() => setActiveTab('sell')}
                  className={`py-2 rounded-md text-sm font-medium transition-colors ${
                    activeTab === 'sell'
                      ? 'bg-destructive text-white'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Sell
                </button>
              </div>

              {activeTab === 'buy' ? (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Amount (Runes)</label>
                    <input
                      type="number"
                      value={buyAmount}
                      onChange={e => setBuyAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <Button
                    className="w-full bg-[hsl(var(--success))] hover:bg-[hsl(160,84%,34%)] text-white"
                    disabled={!token?.rune_id || !buyAmount}
                    onClick={() => toast.info('Buy order will match lowest listing via Magic Eden PSBT')}
                  >
                    {token?.rune_id ? 'Buy Runes' : 'Awaiting On-Chain Confirmation'}
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Amount (Runes)</label>
                    <input
                      type="number"
                      value={sellAmount}
                      onChange={e => setSellAmount(e.target.value)}
                      placeholder="0"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground block mb-1">Price per Rune (sats)</label>
                    <input
                      type="number"
                      value={sellPrice}
                      onChange={e => setSellPrice(e.target.value)}
                      placeholder="0"
                      className="w-full bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <Button
                    variant="destructive"
                    className="w-full"
                    disabled={!token?.rune_id || !sellAmount || !sellPrice}
                    onClick={() => toast.info('Sell listing will be created via Magic Eden PSBT')}
                  >
                    {token?.rune_id ? 'Create Sell Listing' : 'Awaiting On-Chain Confirmation'}
                  </Button>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground text-center">
                ~10 min confirmation • $5-34 network fee • 1% platform fee
              </p>
            </div>

            {/* Market info */}
            {runeMarketInfo && (
              <div className="bg-card border border-border rounded-2xl p-6 space-y-2">
                <h4 className="text-sm font-semibold text-foreground">Market Info</h4>
                {runeMarketInfo.floorPrice && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Floor Price</span>
                    <span className="text-foreground font-mono">{runeMarketInfo.floorPrice} sats</span>
                  </div>
                )}
                {runeMarketInfo.totalVolume && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Total Volume</span>
                    <span className="text-foreground font-mono">{(runeMarketInfo.totalVolume / 1e8).toFixed(4)} BTC</span>
                  </div>
                )}
                {runeMarketInfo.holders && (
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Holders</span>
                    <span className="text-foreground font-mono">{runeMarketInfo.holders}</span>
                  </div>
                )}
              </div>
            )}

            {/* Creator info */}
            <div className="bg-card border border-border rounded-2xl p-4">
              <div className="text-xs text-muted-foreground">Creator</div>
              <a
                href={`https://mempool.space/address/${token?.creator_wallet}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-mono text-primary hover:underline break-all"
              >
                {token?.creator_wallet}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
