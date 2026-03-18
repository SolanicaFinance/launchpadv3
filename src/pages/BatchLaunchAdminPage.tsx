import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, Copy, Check, ExternalLink, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "batch-launch-config";

interface LaunchResult {
  index: number;
  name: string;
  ticker: string;
  status: "success" | "error";
  mintAddress?: string;
  signature?: string;
  pumpfunUrl?: string;
  error?: string;
}

interface SavedConfig {
  name: string;
  ticker: string;
  description: string;
  imageUrl: string;
  twitter: string;
  telegram: string;
  website: string;
  initialBuySol: string;
  count: number;
}

const DEFAULT_CONFIG: SavedConfig = {
  name: "",
  ticker: "",
  description: "",
  imageUrl: "",
  twitter: "https://x.com/saturntrade",
  telegram: "",
  website: "https://saturntrade.lovable.app",
  initialBuySol: "0.01",
  count: 7,
};

export default function BatchLaunchAdminPage() {
  const [config, setConfig] = useState<SavedConfig>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT_CONFIG, ...JSON.parse(saved) } : DEFAULT_CONFIG;
    } catch {
      return DEFAULT_CONFIG;
    }
  });

  const [isLaunching, setIsLaunching] = useState(false);
  const [results, setResults] = useState<LaunchResult[] | null>(null);
  const [deployerWallet, setDeployerWallet] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const update = useCallback((field: keyof SavedConfig, value: string | number) => {
    setConfig((prev) => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const copyCA = (mint: string, idx: number) => {
    navigator.clipboard.writeText(mint);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleLaunch = async () => {
    if (!config.name.trim() || !config.ticker.trim()) {
      toast.error("Name and ticker are required");
      return;
    }
    if (!config.imageUrl.trim()) {
      toast.error("Image URL is required");
      return;
    }

    const totalSol = (parseFloat(config.initialBuySol) || 0.01) * config.count;
    const confirmed = window.confirm(
      `Launch ${config.count}× $${config.ticker.toUpperCase()} on pump.fun?\n\nTotal SOL needed: ~${totalSol.toFixed(3)} SOL (${config.initialBuySol} × ${config.count})`
    );
    if (!confirmed) return;

    setIsLaunching(true);
    setResults(null);

    try {
      const tokens = Array.from({ length: config.count }, () => ({
        name: config.name.trim(),
        ticker: config.ticker.trim(),
        description: config.description.trim(),
      }));

      const { data, error } = await supabase.functions.invoke("pump-batch-launch", {
        body: {
          adminPassword: "saturn135@",
          tokens,
          imageUrl: config.imageUrl.trim(),
          twitter: config.twitter.trim() || undefined,
          telegram: config.telegram.trim() || undefined,
          website: config.website.trim() || undefined,
          initialBuySol: parseFloat(config.initialBuySol) || 0.01,
        },
      });

      if (error) throw error;

      setResults(data.results);
      setDeployerWallet(data.deployerWallet || "");
      const s = data.success;
      const f = data.failed;
      toast.success(`Done: ${s} launched, ${f} failed`);
    } catch (err: any) {
      toast.error(err.message || "Batch launch failed");
    } finally {
      setIsLaunching(false);
    }
  };

  const successCount = results?.filter((r) => r.status === "success").length ?? 0;
  const failCount = results?.filter((r) => r.status === "error").length ?? 0;
  const isReady = config.name.trim() && config.ticker.trim() && config.imageUrl.trim();

  return (
    <div className="space-y-6">
      {/* Config */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-primary flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Batch Launch — Same Token × {config.count}
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Config auto-saves. Fill once, click launch anytime.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Token Name</Label>
              <Input
                value={config.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Saturn"
                className="font-mono text-xs"
                maxLength={32}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Ticker</Label>
              <Input
                value={config.ticker}
                onChange={(e) => update("ticker", e.target.value)}
                placeholder="STRN"
                className="font-mono text-xs uppercase"
                maxLength={10}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">How Many</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={config.count}
                onChange={(e) => update("count", Math.min(10, Math.max(1, parseInt(e.target.value) || 1)))}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs text-muted-foreground">Description</Label>
            <Input
              value={config.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Optional description"
              className="text-xs"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Image URL (shared for all)</Label>
              <Input
                value={config.imageUrl}
                onChange={(e) => update("imageUrl", e.target.value)}
                placeholder="https://example.com/token.png"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Dev Buy (SOL each)</Label>
              <Input
                type="number"
                step="0.001"
                value={config.initialBuySol}
                onChange={(e) => update("initialBuySol", e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground">Twitter</Label>
              <Input
                value={config.twitter}
                onChange={(e) => update("twitter", e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telegram</Label>
              <Input
                value={config.telegram}
                onChange={(e) => update("telegram", e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input
                value={config.website}
                onChange={(e) => update("website", e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>

          {config.imageUrl && (
            <div className="flex items-center gap-3">
              <img
                src={config.imageUrl}
                alt="preview"
                className="h-12 w-12 rounded-lg border border-border object-cover"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              <span className="text-xs text-muted-foreground">Image preview</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Launch */}
      <Button
        size="lg"
        onClick={handleLaunch}
        disabled={isLaunching || !isReady}
        className="w-full py-4 font-mono text-sm uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
      >
        {isLaunching ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Launching {config.count} tokens...
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4 mr-2" /> Launch {config.count}× ${config.ticker.toUpperCase() || "???"}
          </>
        )}
      </Button>

      {isLaunching && (
        <p className="text-xs text-muted-foreground text-center animate-pulse">
          Deploying sequentially with 2s delay between each...
        </p>
      )}

      {/* Results */}
      {results && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono uppercase tracking-widest flex items-center gap-3">
              Results
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                {successCount} ✅
              </Badge>
              {failCount > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  {failCount} ❌
                </Badge>
              )}
            </CardTitle>
            {deployerWallet && (
              <p className="text-xs text-muted-foreground font-mono">
                Deployer: {deployerWallet.slice(0, 8)}…{deployerWallet.slice(-6)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex flex-col sm:flex-row items-start sm:items-center gap-2 p-3 rounded-lg border ${
                  r.status === "success"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-destructive/20 bg-destructive/5"
                }`}
              >
                <span className="text-xs font-mono font-bold">
                  #{i + 1} {r.status === "success" ? "✅" : "❌"}
                </span>

                {r.status === "success" && r.mintAddress && (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <code className="text-[11px] text-muted-foreground font-mono truncate">
                      {r.mintAddress}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 shrink-0"
                      onClick={() => copyCA(r.mintAddress!, i)}
                    >
                      {copiedIdx === i ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <a
                      href={r.pumpfunUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {r.status === "error" && (
                  <span className="text-[10px] text-destructive truncate">
                    {r.error}
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
