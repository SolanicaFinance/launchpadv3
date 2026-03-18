import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Rocket, Plus, Trash2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface TokenEntry {
  id: string;
  name: string;
  ticker: string;
  description: string;
}

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

const DEFAULT_TOKEN_COUNT = 7;

function makeId() {
  return Math.random().toString(36).slice(2, 9);
}

function createEmptyToken(): TokenEntry {
  return { id: makeId(), name: "", ticker: "", description: "" };
}

export default function BatchLaunchAdminPage() {
  const [tokens, setTokens] = useState<TokenEntry[]>(
    Array.from({ length: DEFAULT_TOKEN_COUNT }, createEmptyToken)
  );
  const [imageUrl, setImageUrl] = useState("");
  const [twitter, setTwitter] = useState("https://x.com/saturntrade");
  const [telegram, setTelegram] = useState("");
  const [website, setWebsite] = useState("https://saturntrade.lovable.app");
  const [initialBuySol, setInitialBuySol] = useState("0.01");
  const [isLaunching, setIsLaunching] = useState(false);
  const [results, setResults] = useState<LaunchResult[] | null>(null);
  const [deployerWallet, setDeployerWallet] = useState("");
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  const updateToken = useCallback((id: string, field: keyof TokenEntry, value: string) => {
    setTokens((prev) =>
      prev.map((t) => (t.id === id ? { ...t, [field]: value } : t))
    );
  }, []);

  const addToken = () => {
    if (tokens.length >= 10) return;
    setTokens((prev) => [...prev, createEmptyToken()]);
  };

  const removeToken = (id: string) => {
    if (tokens.length <= 1) return;
    setTokens((prev) => prev.filter((t) => t.id !== id));
  };

  const copyCA = (mint: string, idx: number) => {
    navigator.clipboard.writeText(mint);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const handleLaunch = async () => {
    const validTokens = tokens.filter((t) => t.name.trim() && t.ticker.trim());
    if (validTokens.length === 0) {
      toast.error("Add at least one token with name and ticker");
      return;
    }
    if (!imageUrl.trim()) {
      toast.error("Image URL is required");
      return;
    }

    const confirmed = window.confirm(
      `Launch ${validTokens.length} tokens on pump.fun?\n\nThis will use SOL from the deployer wallet for each token's initial buy (${initialBuySol} SOL × ${validTokens.length} = ${(parseFloat(initialBuySol) * validTokens.length).toFixed(3)} SOL total).`
    );
    if (!confirmed) return;

    setIsLaunching(true);
    setResults(null);

    try {
      const { data, error } = await supabase.functions.invoke("pump-batch-launch", {
        body: {
          adminPassword: "saturn135@",
          tokens: validTokens.map(({ name, ticker, description }) => ({
            name: name.trim(),
            ticker: ticker.trim(),
            description: description.trim(),
          })),
          imageUrl: imageUrl.trim(),
          twitter: twitter.trim() || undefined,
          telegram: telegram.trim() || undefined,
          website: website.trim() || undefined,
          initialBuySol: parseFloat(initialBuySol) || 0.01,
        },
      });

      if (error) throw error;

      setResults(data.results);
      setDeployerWallet(data.deployerWallet || "");
      toast.success(`Launched ${data.success}/${data.total} tokens`);
    } catch (err: any) {
      toast.error(err.message || "Batch launch failed");
    } finally {
      setIsLaunching(false);
    }
  };

  const successCount = results?.filter((r) => r.status === "success").length ?? 0;
  const failCount = results?.filter((r) => r.status === "error").length ?? 0;

  return (
    <div className="space-y-6">
      {/* Shared Config */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-primary flex items-center gap-2">
            <Rocket className="h-4 w-4" /> Batch Launch Config
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Token Image URL (shared)</Label>
              <Input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/token.png"
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Initial Buy (SOL per token)</Label>
              <Input
                type="number"
                step="0.001"
                value={initialBuySol}
                onChange={(e) => setInitialBuySol(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label className="text-xs text-muted-foreground">Twitter URL</Label>
              <Input
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                placeholder="https://x.com/..."
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Telegram</Label>
              <Input
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                placeholder="https://t.me/..."
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://..."
                className="font-mono text-xs"
              />
            </div>
          </div>
          {imageUrl && (
            <div className="flex items-center gap-3">
              <img src={imageUrl} alt="preview" className="h-12 w-12 rounded-lg border border-border object-cover" />
              <span className="text-xs text-muted-foreground">Shared image preview</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Token List */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-mono uppercase tracking-widest text-foreground">
            Tokens ({tokens.length})
          </CardTitle>
          <Button size="sm" variant="outline" onClick={addToken} disabled={tokens.length >= 10}>
            <Plus className="h-3 w-3 mr-1" /> Add
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {tokens.map((token, i) => (
            <div
              key={token.id}
              className="flex flex-col md:flex-row gap-2 p-3 rounded-lg border border-border/50 bg-muted/20"
            >
              <div className="flex items-center gap-2 md:w-8 shrink-0">
                <span className="text-xs font-mono text-muted-foreground font-bold">#{i + 1}</span>
              </div>
              <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                <Input
                  value={token.name}
                  onChange={(e) => updateToken(token.id, "name", e.target.value)}
                  placeholder="Token Name"
                  className="text-xs"
                  maxLength={32}
                />
                <Input
                  value={token.ticker}
                  onChange={(e) => updateToken(token.id, "ticker", e.target.value)}
                  placeholder="TICKER"
                  className="text-xs font-mono uppercase"
                  maxLength={10}
                />
                <Input
                  value={token.description}
                  onChange={(e) => updateToken(token.id, "description", e.target.value)}
                  placeholder="Description (optional)"
                  className="text-xs"
                />
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => removeToken(token.id)}
                disabled={tokens.length <= 1}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Launch Button */}
      <div className="flex flex-col items-center gap-3">
        <Button
          size="lg"
          onClick={handleLaunch}
          disabled={isLaunching}
          className="w-full md:w-auto px-12 py-3 font-mono text-sm uppercase tracking-widest bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isLaunching ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Launching...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" /> Launch {tokens.filter((t) => t.name && t.ticker).length} Tokens
            </>
          )}
        </Button>
        {isLaunching && (
          <p className="text-xs text-muted-foreground animate-pulse">
            Launching tokens sequentially with 2s delay between each...
          </p>
        )}
      </div>

      {/* Results */}
      {results && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-mono uppercase tracking-widest flex items-center gap-3">
              Results
              <Badge variant="outline" className="text-emerald-400 border-emerald-400/30">
                {successCount} success
              </Badge>
              {failCount > 0 && (
                <Badge variant="outline" className="text-destructive border-destructive/30">
                  {failCount} failed
                </Badge>
              )}
            </CardTitle>
            {deployerWallet && (
              <p className="text-xs text-muted-foreground font-mono">
                Deployer: {deployerWallet.slice(0, 8)}...{deployerWallet.slice(-6)}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex flex-col md:flex-row items-start md:items-center gap-2 p-3 rounded-lg border ${
                  r.status === "success"
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-destructive/20 bg-destructive/5"
                }`}
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <Badge
                    variant={r.status === "success" ? "default" : "destructive"}
                    className="text-[10px] shrink-0"
                  >
                    {r.status === "success" ? "✅" : "❌"}
                  </Badge>
                  <span className="text-xs font-mono font-bold truncate">
                    {r.name} (${r.ticker})
                  </span>
                </div>

                {r.status === "success" && r.mintAddress && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <code className="text-[10px] text-muted-foreground font-mono">
                      {r.mintAddress.slice(0, 6)}...{r.mintAddress.slice(-4)}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
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
                      className="text-primary hover:text-primary/80"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {r.status === "error" && (
                  <span className="text-[10px] text-destructive truncate max-w-xs">
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
