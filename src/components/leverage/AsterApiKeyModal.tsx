import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ExternalLink, Key, Shield } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
  onSave: (apiKey: string, apiSecret: string) => Promise<void>;
}

export function AsterApiKeyModal({ open, onClose, onSave }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!apiKey.trim() || !apiSecret.trim()) {
      setError("Both API key and secret are required");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave(apiKey.trim(), apiSecret.trim());
      setApiKey("");
      setApiSecret("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to save API key");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-4 w-4 text-primary" />
            Connect Aster DEX
          </DialogTitle>
          <DialogDescription>
            Enter your API credentials to enable leverage trading
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Instructions */}
          <div className="flex items-start gap-2 p-3 rounded-sm bg-secondary border border-border text-xs">
            <Shield className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-foreground font-medium">Your keys are encrypted and stored securely</p>
              <p className="text-muted-foreground">
                Generate API keys at{" "}
                <a href="https://www.asterdex.com" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                  asterdex.com <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p className="text-muted-foreground">Enable "Futures" permission. IP restriction recommended.</p>
            </div>
          </div>

          {/* API Key */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Enter your API key"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* API Secret */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="Enter your API secret"
              className="w-full px-3 py-2 bg-secondary border border-border rounded-sm text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 py-2 text-xs font-medium rounded-sm bg-secondary hover:bg-surface-hover text-foreground transition-colors border border-border">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !apiKey || !apiSecret}
              className="flex-1 py-2 text-xs font-bold rounded-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? "Saving..." : "Connect"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
