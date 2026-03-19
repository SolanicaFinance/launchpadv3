import { useState, useEffect } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TokenLookupCard } from "@/components/dexlist/TokenLookupCard";
import { ListedTokensTable } from "@/components/dexlist/ListedTokensTable";
import { Lock, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "dexlist_mod_auth";

function callDexlistAdmin(body: Record<string, unknown>) {
  return supabase.functions.invoke("dexlist-admin", { body });
}

export default function DexListPage() {
  const [authed, setAuthed] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [password, setPassword] = useState("");
  const [mintInput, setMintInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [generatedImageBase64, setGeneratedImageBase64] = useState<string | null>(null);
  const [postXStatus, setPostXStatus] = useState<"idle" | "posting" | "success" | "error">("idle");
  const [tweetUrl, setTweetUrl] = useState<string | null>(null);
  const [postXError, setPostXError] = useState<string | null>(null);

  const [lookupResult, setLookupResult] = useState<{ tokenInfo: any; pools: any[] } | null>(null);
  const [listedTokens, setListedTokens] = useState<any[]>([]);

  const handleLogin = () => {
    if (password === "mod135@") {
      localStorage.setItem(STORAGE_KEY, "true");
      setAuthed(true);
      fetchListedTokens();
    } else {
      toast.error("Invalid password");
    }
  };

  const fetchListedTokens = async () => {
    const { data } = await callDexlistAdmin({ action: "fetch", modPassword: "mod135@" });
    if (data?.tokens) setListedTokens(data.tokens);
  };

  useEffect(() => {
    if (authed) fetchListedTokens();
  }, [authed]);

  const handleLookup = async () => {
    if (!mintInput.trim()) return;
    setLoading(true);
    setLookupResult(null);
    try {
      const { data, error } = await callDexlistAdmin({
        action: "lookup",
        modPassword: "mod135@",
        mintAddress: mintInput.trim(),
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }
      if (!data?.pools?.length) {
        toast.error("No pools found for this token");
        return;
      }
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
      toast.success("Token listed successfully!");
      setLookupResult(null);
      setMintInput("");
      fetchListedTokens();
    } catch (e: any) {
      toast.error(e.message || "Failed to list");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdate = async (id: string, maxLeverage?: number, isActive?: boolean) => {
    const { data, error } = await callDexlistAdmin({
      action: "update",
      modPassword: "mod135@",
      id,
      maxLeverage,
      isActive,
    });
    if (error || data?.error) {
      toast.error("Update failed");
      return;
    }
    fetchListedTokens();
  };

  const handleRemove = async (id: string) => {
    const { data, error } = await callDexlistAdmin({
      action: "remove",
      modPassword: "mod135@",
      id,
    });
    if (error || data?.error) {
      toast.error("Remove failed");
      return;
    }
    toast.success("Token deactivated");
    fetchListedTokens();
  };

  if (!authed) {
    return (
      <LaunchpadLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-full max-w-sm space-y-4 text-center">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
            <h1 className="text-xl font-bold text-foreground">Moderator Access</h1>
            <p className="text-sm text-muted-foreground">Enter the moderator password to continue</p>
            <div className="flex gap-2">
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
              />
              <Button onClick={handleLogin}>Enter</Button>
            </div>
          </div>
        </div>
      </LaunchpadLayout>
    );
  }

  return (
    <LaunchpadLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-foreground">Dex Leverage Listing</h1>
        <p className="text-sm text-muted-foreground">Look up a Solana token, select its pool, and set maximum leverage.</p>

        {/* Search */}
        <div className="flex gap-2">
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

        {/* Lookup result */}
        {lookupResult && (
          <TokenLookupCard
            tokenInfo={lookupResult.tokenInfo}
            pools={lookupResult.pools}
            mintAddress={mintInput.trim()}
            onConfirm={handleConfirm}
            isSubmitting={submitting}
          />
        )}

        {/* Listed tokens */}
        <div className="space-y-3 pt-4">
          <h2 className="text-lg font-semibold text-foreground">Listed Tokens</h2>
          <ListedTokensTable tokens={listedTokens} onUpdate={handleUpdate} onRemove={handleRemove} />
        </div>
      </div>
    </LaunchpadLayout>
  );
}
