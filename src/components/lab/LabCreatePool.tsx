import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Rocket, Info } from "lucide-react";

interface Props {
  onPoolCreated: () => void;
}

export function LabCreatePool({ onPoolCreated }: Props) {
  const [name, setName] = useState("");
  const [ticker, setTicker] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [threshold, setThreshold] = useState(1);
  const [feeBps, setFeeBps] = useState(100);
  const [loading, setLoading] = useState(false);

  const virtualSol = 30;
  const virtualTokens = 1_000_000_000;
  const initialPrice = virtualSol / (virtualTokens * 0.8);
  const initialMcap = initialPrice * virtualTokens;

  async function handleCreate() {
    if (!name.trim() || !ticker.trim()) {
      toast.error("Name and ticker are required");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("saturn-curve-create", {
        body: {
          name: name.trim(),
          ticker: ticker.trim().toUpperCase(),
          image_url: imageUrl.trim() || null,
          graduation_threshold_sol: threshold,
          fee_bps: feeBps,
        },
      });
      if (error) throw error;
      toast.success("Pool created!");
      setName("");
      setTicker("");
      setImageUrl("");
      onPoolCreated();
    } catch (e: any) {
      toast.error(e.message || "Failed to create pool");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="p-4 rounded-lg border border-border bg-card space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          Create Test Pool
        </h3>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Token Name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Saturn Test Token" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Ticker</Label>
          <Input value={ticker} onChange={(e) => setTicker(e.target.value.toUpperCase())} placeholder="STT" maxLength={10} />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Image URL (optional)</Label>
          <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Graduation Threshold: {threshold} SOL</Label>
          <Slider
            value={[threshold]}
            onValueChange={([v]) => setThreshold(v)}
            min={0.1}
            max={85}
            step={0.1}
            className="w-full"
          />
          <p className="text-[10px] text-muted-foreground">Test: 1 SOL • Production: 85 SOL</p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Fee: {feeBps / 100}% ({feeBps} bps)</Label>
          <Slider
            value={[feeBps]}
            onValueChange={([v]) => setFeeBps(v)}
            min={0}
            max={500}
            step={10}
            className="w-full"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="p-4 rounded-lg border border-border bg-card/50 space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
          <Info className="h-3 w-3" /> Pool Preview
        </h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="text-muted-foreground">Virtual SOL Reserves</div>
          <div className="text-foreground font-mono">{virtualSol} SOL</div>
          <div className="text-muted-foreground">Virtual Token Reserves</div>
          <div className="text-foreground font-mono">800M tokens</div>
          <div className="text-muted-foreground">Total Supply</div>
          <div className="text-foreground font-mono">1,000,000,000</div>
          <div className="text-muted-foreground">Initial Price</div>
          <div className="text-foreground font-mono">{initialPrice.toFixed(12)} SOL</div>
          <div className="text-muted-foreground">Initial Market Cap</div>
          <div className="text-foreground font-mono">{initialMcap.toFixed(2)} SOL</div>
          <div className="text-muted-foreground">Graduation</div>
          <div className="text-foreground font-mono">{threshold} SOL</div>
        </div>
      </div>

      <Button onClick={handleCreate} disabled={loading || !name || !ticker} className="w-full btn-gradient-green">
        {loading ? "Creating..." : "Create Pool"}
      </Button>
    </div>
  );
}
