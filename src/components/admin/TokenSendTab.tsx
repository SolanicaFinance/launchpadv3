import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Send, Loader2, CheckCircle2, AlertCircle, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

const ADMIN_PASSWORD = "saturn135@";

interface SendResult {
  success: boolean;
  signature?: string;
  error?: string;
  fromAddress?: string;
  toAddress?: string;
  mintAddress?: string;
  amount?: number;
  decimals?: number;
  solscanUrl?: string;
  balance?: number;
}

export function TokenSendTab() {
  const [privateKey, setPrivateKey] = useState("");
  const [mintAddress, setMintAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [showKey, setShowKey] = useState(false);

  const handleSend = async () => {
    if (!privateKey || !mintAddress || !toAddress || !amount) {
      toast.error("All fields are required");
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.error("Invalid amount");
      return;
    }

    setSending(true);
    setResult(null);

    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-send-token`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminPassword: ADMIN_PASSWORD,
          privateKey: privateKey.trim(),
          mintAddress: mintAddress.trim(),
          toAddress: toAddress.trim(),
          amount: numAmount,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setResult({ success: false, error: data.error || "Unknown error" });
        toast.error(data.error || "Send failed");
      } else {
        setResult(data);
        toast.success(`Sent ${numAmount} tokens → ${toAddress.slice(0, 8)}...`);
      }
    } catch (err: any) {
      setResult({ success: false, error: err.message });
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-border/40 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-mono uppercase tracking-wider">
            <Send className="h-4 w-4 text-primary" />
            Send SPL Token
          </CardTitle>
          <p className="text-xs text-muted-foreground font-mono">
            Transfer SPL tokens from any wallet using a private key. Supports any mint address.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Private Key (base58 or JSON array)
            </Label>
            <div className="relative mt-1">
              <Input
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Enter sender private key..."
                type={showKey ? "text" : "password"}
                className="font-mono text-xs pr-10 bg-background border-border/40 rounded-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Token Mint Address
            </Label>
            <Input
              value={mintAddress}
              onChange={(e) => setMintAddress(e.target.value)}
              placeholder="Token mint address..."
              className="font-mono text-xs mt-1 bg-background border-border/40 rounded-sm"
            />
          </div>

          <div>
            <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Destination Wallet
            </Label>
            <Input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="Recipient wallet address..."
              className="font-mono text-xs mt-1 bg-background border-border/40 rounded-sm"
            />
          </div>

          <div>
            <Label className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">
              Amount (human-readable)
            </Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 1000000"
              type="number"
              step="any"
              min="0"
              className="font-mono text-xs mt-1 bg-background border-border/40 rounded-sm"
            />
          </div>

          <Button
            onClick={handleSend}
            disabled={sending || !privateKey || !mintAddress || !toAddress || !amount}
            className="w-full h-10 font-mono uppercase tracking-wider text-xs font-bold rounded-sm"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Tokens...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Execute Token Transfer
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className={`border ${result.success ? "border-primary/30 bg-primary/5" : "border-destructive/30 bg-destructive/5"}`}>
          <CardContent className="pt-4 space-y-2 font-mono text-xs">
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-4 w-4 text-primary flex-shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0" />
              )}
              <span className={`font-bold uppercase ${result.success ? "text-primary" : "text-destructive"}`}>
                {result.success ? "Success" : "Failed"}
              </span>
            </div>

            {result.error && (
              <p className="text-destructive/80 break-all">{result.error}</p>
            )}

            {result.success && result.signature && (
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  <span className="text-foreground">From:</span> {result.fromAddress?.slice(0, 8)}...{result.fromAddress?.slice(-4)}
                </p>
                <p className="text-muted-foreground">
                  <span className="text-foreground">To:</span> {result.toAddress?.slice(0, 8)}...{result.toAddress?.slice(-4)}
                </p>
                <p className="text-muted-foreground">
                  <span className="text-foreground">Mint:</span> {result.mintAddress?.slice(0, 8)}...{result.mintAddress?.slice(-4)}
                </p>
                <p className="text-muted-foreground">
                  <span className="text-foreground">Amount:</span> {result.amount} (decimals: {result.decimals})
                </p>
                <p className="text-muted-foreground break-all">
                  <span className="text-foreground">Sig:</span> {result.signature.slice(0, 20)}...{result.signature.slice(-8)}
                </p>
                {result.solscanUrl && (
                  <a
                    href={result.solscanUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline mt-1"
                  >
                    View on Solscan <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
