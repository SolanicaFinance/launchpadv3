import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Link2 } from "lucide-react";
import type { XBotAccountWithRules } from "@/hooks/useXBotAccounts";

interface XBotAccountFormProps {
  open: boolean;
  onClose: () => void;
  account?: XBotAccountWithRules | null;
  onSave: (account: Partial<XBotAccountWithRules>) => Promise<void>;
}

export function XBotAccountForm({
  open,
  onClose,
  account,
  onSave,
}: XBotAccountFormProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: account?.name || "",
    username: account?.username || "",
    email: account?.email || "",
    password_encrypted: "",
    totp_secret_encrypted: "",
    full_cookie_encrypted: "",
    proxy_url: account?.proxy_url || "",
    socks5_urls: account?.socks5_urls || [],
    is_active: account?.is_active ?? true,
    subtuna_ticker: account?.subtuna_ticker || "",
  });
  const [newSocks5, setNewSocks5] = useState("");

  // Reset form when account changes
  useEffect(() => {
    if (open) {
      setFormData({
        name: account?.name || "",
        username: account?.username || "",
        email: account?.email || "",
        password_encrypted: "",
        totp_secret_encrypted: "",
        full_cookie_encrypted: "",
        proxy_url: account?.proxy_url || "",
        socks5_urls: account?.socks5_urls || [],
        is_active: account?.is_active ?? true,
        subtuna_ticker: account?.subtuna_ticker || "",
      });
      setNewSocks5("");
    }
  }, [open, account]);

  // Validate socks5 format: either socks5://... or user:pass@host:port
  const isValidSocks5 = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) return false;
    // Accept socks5:// prefix or user:pass@host:port format
    if (trimmed.startsWith("socks5://")) return true;
    // Match pattern: user:pass@host:port
    const simplePattern = /^[^:]+:[^@]+@[^:]+:\d+$/;
    return simplePattern.test(trimmed);
  };

  const normalizeSocks5Url = (url: string) => {
    const trimmed = url.trim();
    if (trimmed.startsWith("socks5://")) return trimmed;
    return `socks5://${trimmed}`;
  };

  const handleAddSocks5 = () => {
    if (isValidSocks5(newSocks5)) {
      setFormData((p) => ({
        ...p,
        socks5_urls: [...p.socks5_urls, normalizeSocks5Url(newSocks5)],
      }));
      setNewSocks5("");
    }
  };

  const handleRemoveSocks5 = (index: number) => {
    setFormData((p) => ({
      ...p,
      socks5_urls: p.socks5_urls.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        ...formData,
        password_encrypted: formData.password_encrypted || undefined,
        totp_secret_encrypted: formData.totp_secret_encrypted || undefined,
        subtuna_ticker: formData.subtuna_ticker || null,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {account ? "Edit Account" : "Add New Account"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="basic">Basic</TabsTrigger>
              <TabsTrigger value="auth">Authentication</TabsTrigger>
              <TabsTrigger value="proxy">SOCKS5</TabsTrigger>
              <TabsTrigger value="subtuna">Community</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Display Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, name: e.target.value }))
                    }
                    placeholder="My Bot Account"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">X Username</Label>
                  <Input
                    id="username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData((p) => ({ ...p, username: e.target.value }))
                    }
                    placeholder="username (no @)"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email (optional)</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, email: e.target.value }))
                  }
                  placeholder="account@example.com"
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="is_active">Account Enabled</Label>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((p) => ({ ...p, is_active: checked }))
                  }
                />
              </div>
            </TabsContent>

            <TabsContent value="auth" className="space-y-4">
              <div className="text-sm text-muted-foreground mb-2">
                Paste the full cookie string from your browser. Must include auth_token and ct0.
              </div>

              <div className="space-y-2">
                <Label htmlFor="full_cookie">Full Cookie String</Label>
                <Textarea
                  id="full_cookie"
                  value={formData.full_cookie_encrypted}
                  onChange={(e) =>
                    setFormData((p) => ({
                      ...p,
                      full_cookie_encrypted: e.target.value,
                    }))
                  }
                  placeholder="auth_token=xxx; ct0=yyy; guest_id=...; ..."
                  rows={4}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Copy all cookies from browser DevTools → Application → Cookies → x.com
                </p>
              </div>

              <div className="border-t pt-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Optional: Credentials for dynamic login (rarely needed)
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password_encrypted}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          password_encrypted: e.target.value,
                        }))
                      }
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="totp">TOTP Secret</Label>
                    <Input
                      id="totp"
                      type="password"
                      value={formData.totp_secret_encrypted}
                      onChange={(e) =>
                        setFormData((p) => ({
                          ...p,
                          totp_secret_encrypted: e.target.value,
                        }))
                      }
                      placeholder="2FA secret key"
                    />
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="proxy" className="space-y-4">
              <div className="space-y-3">
                <Label>SOCKS5 Proxies ({formData.socks5_urls.length})</Label>
                <p className="text-xs text-muted-foreground">
                  Add multiple SOCKS5 proxies for failover. If one fails, the bot will
                  automatically try the next one. You can add more proxies anytime.
                </p>
                
                {/* Existing proxies list */}
                {formData.socks5_urls.length > 0 && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {formData.socks5_urls.map((url, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <div className="flex-1 bg-muted/50 rounded px-2 py-1.5 font-mono text-xs truncate">
                          {index + 1}. {url}
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveSocks5(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Add new proxy */}
                <div className="flex gap-2">
                  <Input
                    value={newSocks5}
                    onChange={(e) => setNewSocks5(e.target.value)}
                    placeholder="user:pass@host:port"
                    className="font-mono text-xs flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddSocks5();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddSocks5}
                    disabled={!isValidSocks5(newSocks5)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
                {newSocks5 && !isValidSocks5(newSocks5) && (
                  <p className="text-xs text-destructive">
                    Format: user:pass@host:port (e.g., cd83:cd83@216.22.49.34:59147)
                  </p>
                )}
              </div>
            </TabsContent>

            <TabsContent value="subtuna" className="space-y-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Link2 className="h-4 w-4" />
                <span className="text-sm">Link to community for synchronized posting</span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subtuna_ticker">Community Ticker</Label>
                <Input
                  id="subtuna_ticker"
                  value={formData.subtuna_ticker}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, subtuna_ticker: e.target.value }))
                  }
                  placeholder="e.g., 67"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">
                  Enter the ticker (without t/) to link this X account to a community. 
                  When enabled, community posts will be cross-posted to X.
                </p>
              </div>

              {formData.subtuna_ticker && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">
                    Linked Community: <span className="text-primary">t/{formData.subtuna_ticker}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Community posts will be automatically posted to @{formData.username || "username"}'s X wall.
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : account ? "Save Changes" : "Create Account"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
