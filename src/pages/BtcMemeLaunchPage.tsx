import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useBtcWallet } from "@/hooks/useBtcWallet";
import { BtcConnectWalletModal } from "@/components/bitcoin/BtcConnectWalletModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Rocket, Upload, X } from "lucide-react";

export default function BtcMemeLaunchPage() {
  const { isConnected, address } = useBtcWallet();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    name: "",
    ticker: "",
    description: "",
    imageUrl: "",
    websiteUrl: "",
    twitterUrl: "",
    initialBuyBtc: 0.0001,
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5MB");
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const removeImage = () => {
    setImageFile(null);
    setImagePreview(null);
    setForm({ ...form, imageUrl: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return form.imageUrl || null;
    setUploading(true);
    try {
      const ext = imageFile.name.split(".").pop() || "png";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("btc-token-images").upload(path, imageFile, {
        contentType: imageFile.type,
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("btc-token-images").getPublicUrl(path);
      return urlData.publicUrl;
    } catch (e: any) {
      toast.error("Image upload failed: " + (e.message || "Unknown error"));
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleLaunch = async () => {
    if (!address) return;
    if (!form.name.trim() || !form.ticker.trim()) {
      toast.error("Name and ticker are required");
      return;
    }
    setSubmitting(true);
    try {
      const imageUrl = await uploadImage();

      const { data, error } = await supabase.functions.invoke("btc-meme-create", {
        body: {
          name: form.name,
          ticker: form.ticker,
          description: form.description,
          imageUrl,
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
          <p className="text-muted-foreground text-sm">Connect your Bitcoin wallet to create a BTC meme token.</p>
          <BtcConnectWalletModal
            trigger={
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold" size="lg">
                Connect Wallet
              </Button>
            }
          />
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

          {/* Image Upload */}
          <div>
            <Label>Token Image</Label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            {imagePreview ? (
              <div className="relative w-24 h-24 mt-1">
                <img src={imagePreview} alt="Preview" className="w-24 h-24 rounded-xl object-cover border border-border" />
                <button onClick={removeImage} className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-0.5">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-1 w-full border border-dashed border-border rounded-xl p-4 flex flex-col items-center gap-1 text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
              >
                <Upload className="w-5 h-5" />
                <span className="text-xs">Upload image (max 5MB)</span>
              </button>
            )}
            <p className="text-[10px] text-muted-foreground mt-1">SHA-256 hash inscribed in Bitcoin OP_RETURN genesis</p>
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
          <div className="flex justify-between"><span className="text-muted-foreground">Bitcoin Genesis</span><span className="text-foreground">Saturn.Trade OP_RETURN</span></div>
        </div>

        <Button onClick={handleLaunch} disabled={submitting || uploading || !form.name || !form.ticker} className="w-full bg-[hsl(30,100%,50%)] hover:bg-[hsl(30,100%,45%)] text-white" size="lg">
          {submitting ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> {uploading ? "Uploading..." : "Launching..."}</> : <><Rocket className="w-4 h-4 mr-2" /> Launch Token</>}
        </Button>
      </div>
    </div>
  );
}
