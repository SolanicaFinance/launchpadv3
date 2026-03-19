import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, CheckCircle, XCircle, Search, Settings } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { TokenLookupCard } from "@/components/dexlist/TokenLookupCard";
import { ListedTokensTable } from "@/components/dexlist/ListedTokensTable";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function callDexlistAdmin(body: Record<string, unknown>) {
  return supabase.functions.invoke("dexlist-admin", { body });
}

export default function DexListingAdminTab() {
  // X Config state
  const [configLoading, setConfigLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullCookie, setFullCookie] = useState("");
  const [socks5Input, setSocks5Input] = useState("");
  const [hasCookie, setHasCookie] = useState(false);
  const [socks5Count, setSocks5Count] = useState(0);
  const [configOpen, setConfigOpen] = useState(false);

  // Listing state
  const [mintInput, setMintInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [postXStatus, setPostXStatus] = useState<"idle" | "posting" | "success" | "error">("idle");
  const [tweetUrl, setTweetUrl] = useState<string | null>(null);
  const [postXError, setPostXError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<{ tokenInfo: any; pools: any[] } | null>(null);
  const [listedTokens, setListedTokens] = useState<any[]>([]);

  useEffect(() => {
    fetchConfig();
    fetchListedTokens();
  }, []);

  const fetchConfig = async () => {
    setConfigLoading(true);
    try {
      const { data } = await callDexlistAdmin({ action: "get-x-config", modPassword: "mod135@" });
      if (data?.config) {
        setHasCookie(data.config.has_cookie || false);
        setSocks5Count(data.config.socks5_count || 0);
        if (data.config.socks5_urls?.length) {
          setSocks5Input(data.config.socks5_urls.join("\n"));
        }
      }
    } catch (e) {
      console.error("Failed to fetch config:", e);
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const socks5Urls = socks5Input.split("\n").map(s => s.trim()).filter(Boolean);
      const { data, error } = await callDexlistAdmin({
        action: "save-x-config",
        modPassword: "mod135@",
        fullCookie: fullCookie || undefined,
        socks5Urls,
      });
      if (error || data?.error) throw new Error(data?.error || "Save failed");
      toast.success("Dex listing X config saved");
      setFullCookie("");
      fetchConfig();
    } catch (e: any) {
      toast.error(e.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const fetchListedTokens = async () => {
    const { data } = await callDexlistAdmin({ action: "fetch", modPassword: "mod135@" });
    if (data?.tokens) setListedTokens(data.tokens);
  };

  const handleLookup = async () => {
    if (!mintInput.trim()) return;
    setLoading(true);
    setLookupResult(null);
    setGeneratedImageBase64(null);
    setPostXStatus("idle");
    setTweetUrl(null);
    setPostXError(null);
    try {
      const { data, error } = await callDexlistAdmin({
        action: "lookup",
        modPassword: "mod135@",
        mintAddress: mintInput.trim(),
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      if (!data?.pools?.length) { toast.error("No pools found"); return; }
      setLookupResult(data);
    } catch (e: any) {
      toast.error(e.message || "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (poolAddress: string, maxLeverage: number) => {
    if (!lookupResult) return;
    setSubmitting(true);
    try {
      const selectedPool = lookupResult.pools.find((p: any) => p.pairAddress === poolAddress);
      const { data, error } = await callDexlistAdmin({
        action: "list",
        modPassword: "mod135@",
        mintAddress: mintInput.trim(),
        poolAddress,
        tokenInfo: {
          ...lookupResult.tokenInfo,
          market_cap: selectedPool?.market_cap || 0,
          liquidity_usd: selectedPool?.liquidity_usd || 0,
        },
        maxLeverage,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Token listed!");
      fetchListedTokens();

      // Auto-post to X
      if (generatedImageBase64) {
        setPostXStatus("posting");
        try {
          const { data: xData, error: xError } = await callDexlistAdmin({
            action: "post-to-x",
            modPassword: "mod135@",
            imageBase64: generatedImageBase64,
            ticker: lookupResult.tokenInfo.ticker,
            maxLeverage,
            mintAddress: mintInput.trim(),
          });
          if (xError) throw xError;
          if (xData?.error) throw new Error(xData.error);
          setPostXStatus("success");
          setTweetUrl(xData?.tweetUrl || null);
          toast.success("Posted to X!");
        } catch (xErr: any) {
          setPostXStatus("error");
          setPostXError(xErr.message || "Failed to post to X");
          toast.error(xErr.message || "Failed to post to X");
        }
      }

      setLookupResult(null);
      setMintInput("");
      setGeneratedImageBase64(null);
    } catch (e: any) {
      toast.error(e.message || "Failed to list");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, maxLeverage?: number, isActive?: boolean) => {
    const { data, error } = await callDexlistAdmin({ action: "update", modPassword: "mod135@", id, maxLeverage, isActive });
    if (error || data?.error) { toast.error("Update failed"); return; }
    fetchListedTokens();
  };

  const handleRemove = async (id: string) => {
    const { data, error } = await callDexlistAdmin({ action: "remove", modPassword: "mod135@", id });
    if (error || data?.error) { toast.error("Remove failed"); return; }
    toast.success("Token deactivated");
    fetchListedTokens();
  };

  return (
    <div className="space-y-6">
      {/* Token Listing Section */}
      <div className="border-l-2 border-primary pl-4">
        <h2 className="font-mono text-sm text-primary uppercase tracking-widest">Add Listing</h2>
        <p className="text-xs text-muted-foreground mt-1">Look up a token, preview listing image, and list for leverage trading</p>
      </div>

      <div className="flex gap-2 max-w-2xl">
        <Input
          placeholder="Enter Solana token CA..."
          value={mintInput}
          onChange={(e) => setMintInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
          className="font-mono text-sm"
        />
        <Button onClick={handleLookup} disabled={loading || !mintInput.trim()}>
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </Button>
      </div>

      {lookupResult && (
        <TokenLookupCard
          tokenInfo={lookupResult.tokenInfo}
          pools={lookupResult.pools}
          mintAddress={mintInput.trim()}
          onConfirm={handleConfirm}
          isSubmitting={submitting}
          onImageGenerated={setGeneratedImageBase64}
        />
      )}

      {/* Post to X status */}
      {postXStatus === "posting" && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground p-3 rounded-lg bg-secondary/50">
          <Loader2 className="w-4 h-4 animate-spin" /> Posting to X...
        </div>
      )}
      {postXStatus === "success" && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <span className="text-sm text-primary">✅ Posted to X!</span>
          {tweetUrl && (
            <a href={tweetUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline font-mono">
              View Tweet →
            </a>
          )}
        </div>
      )}
      {postXStatus === "error" && (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <span className="text-sm text-destructive flex-1">❌ {postXError}</span>
          <Button variant="outline" size="sm" onClick={() => setPostXStatus("idle")}>Dismiss</Button>
        </div>
      )}

      {/* Listed Tokens */}
      <div className="space-y-3 pt-4">
        <h2 className="text-lg font-semibold text-foreground">Listed Tokens</h2>
        <ListedTokensTable tokens={listedTokens} onUpdate={handleUpdate} onRemove={handleRemove} />
      </div>

      {/* X Account Config - Collapsible */}
      <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="gap-2 text-xs">
            <Settings className="w-3 h-3" />
            X Account Settings
            <span className="ml-1 text-muted-foreground">
              {hasCookie ? "✅" : "⚠️"}
            </span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-4 space-y-4 max-w-2xl">
          {configLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs font-mono">Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 py-2">
                  <div className="flex items-center gap-2 text-sm">
                    {hasCookie ? <CheckCircle className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-destructive" />}
                    <span className="text-foreground">Cookie: {hasCookie ? "Configured" : "Not set"}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">SOCKS5 Proxies: {socks5Count}</div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-xs font-mono">Update Credentials</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 py-2">
                  <div className="space-y-2">
                    <Label className="text-xs">Full Cookie String</Label>
                    <Input
                      type="password"
                      placeholder={hasCookie ? "Leave empty to keep current" : "Paste full cookie string..."}
                      value={fullCookie}
                      onChange={(e) => setFullCookie(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">Must contain auth_token and ct0</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">SOCKS5 Proxies (one per line)</Label>
                    <textarea
                      placeholder="socks5://user:pass@host:port"
                      value={socks5Input}
                      onChange={(e) => setSocks5Input(e.target.value)}
                      rows={3}
                      className="flex w-full rounded-[10px] border border-border bg-secondary/50 px-4 py-2 text-xs font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:border-transparent focus-visible:bg-background transition-all duration-200"
                    />
                  </div>
                  <Button onClick={handleSaveConfig} disabled={saving} className="w-full gap-2" size="sm">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Configuration
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
