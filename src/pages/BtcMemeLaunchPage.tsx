import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useBtcWallet } from "@/hooks/useBtcWallet";
import { BtcConnectWalletModal } from "@/components/bitcoin/BtcConnectWalletModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Rocket } from "lucide-react";

export default function BtcMemeLaunchPage() {
  const { isConnected, address } = useBtcWallet();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    initialBuyBtc: 0.0001,
  });

  const handleLaunch = async () => {
    if (!address) return;
    if (!form.name.trim() || !form.ticker.trim()) {
      toast.error("Name and ticker are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("btc-meme-create", {
        body: {
          name: form.name,
          ticker: form.ticker,
          description: form.description,
          imageUrl: form.imageUrl,
          websiteUrl: form.websiteUrl,
          twitterUrl: form.twitterUrl,
          creatorWallet: address,
          creatorFeeBps: 100,
          initialBuyBtc: form.initialBuyBtc,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success(`$${data.token.ticker} launched!`);
      navigate(`/btc/meme/${data.token.id}`);
    } catch (e: any) {
      toast.error(e.message || "Launch failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-card border border-border rounded-2xl p-8 text-center space-y-4">
          <div className="text-5xl">₿</div>
          <h2 className="text-2xl font-bold text-foreground">Connect Wallet to Launch</h2>
          <p className="text-muted-foreground text-sm">Connect your UniSat wallet to create a BTC meme token.</p>
          <BtcConnectWalletModal />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/btc")} className="text-muted-foreground hover:text-foreground text-sm">
          ← Back
        </button>
        <h1 className="text-xl font-bold text-foreground">Launch BTC Meme Token</h1>
      </div>

      <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg p-3 border border-border/50">
          ⚡ Instant trading — your token goes live immediately with a bonding curve pool. No blockchain confirmations needed.
        </div>

        <div className="space-y-3">
          <div>
            <Label htmlFor="name">Token Name *</Label>
            <Input id="name" placeholder="Bitcoin Doge" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label htmlFor="ticker">Ticker *</Label>
            <Input id="ticker" placeholder="BTCDOGE" maxLength={10} value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })} />
          </div>
          <div>
            <Label htmlFor="desc">Description</Label>
            <Textarea id="desc" placeholder="Tell the world about your token..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
          </div>
          <div>
            <Label htmlFor="img">Image URL</Label>
            <Input id="img" placeholder="https://..." value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="web">Website</Label>
              <Input id="web" placeholder="https://..." value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="tw">Twitter</Label>
              <Input id="tw" placeholder="https://x.com/..." value={form.twitterUrl} onChange={(e) => setForm({ ...form, twitterUrl: e.target.value })} />
            </div>
          </div>
          <div>
            <Label htmlFor="devbuy">Initial Dev Buy (BTC)</Label>
            <Input id="devbuy" type="number" step="0.00001" min="0" value={form.initialBuyBtc} onChange={(e) => setForm({ ...form, initialBuyBtc: parseFloat(e.target.value) || 0 })} />
            <p className="text-[10px] text-muted-foreground mt-1">Optional initial buy to seed the bonding curve</p>
          </div>
        </div>

        <div className="bg-muted/20 rounded-lg p-3 space-y-1 text-xs">
          <div className="flex justify-between"><span className="text-muted-foreground">Pool Model</span><span className="text-foreground font-semibold">Bonding Curve (x·y=k)</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Total Supply</span><span className="text-foreground">1,000,000,000</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Graduation</span><span className="text-foreground">~0.015 BTC in reserves</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Platform Fee</span><span className="text-foreground">1%</span></div>
        </div>

        <Button onClick={handleLaunch} disabled={submitting || !form.name || !form.ticker} className="w-full bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white" size="lg">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Launching...</> : <><Rocket className="w-4 h-4 mr-2" /> Launch Token</>}
        </Button>
      </div>
    </div>
  );
}