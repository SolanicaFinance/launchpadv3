import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function DexListingAdminTab() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullCookie, setFullCookie] = useState("");
  const [socks5Input, setSocks5Input] = useState("");
  const [hasCookie, setHasCookie] = useState(false);
  const [socks5Count, setSocks5Count] = useState(0);

  const adminPassword = localStorage.getItem("admin_panel_auth_v2") === "true" ? "saturn135@" : "";

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.functions.invoke("dexlist-admin", {
        body: { action: "get-x-config", modPassword: "mod135@" },
      });
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
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const socks5Urls = socks5Input.split("\n").map(s => s.trim()).filter(Boolean);
      const { data, error } = await supabase.functions.invoke("dexlist-admin", {
        body: {
          action: "save-x-config",
          modPassword: "mod135@",
          fullCookie: fullCookie || undefined,
          socks5Urls,
        },
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="border-l-2 border-primary pl-4">
        <h2 className="font-mono text-sm text-primary uppercase tracking-widest">Dex Listing X Account</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure the X account used for automated listing announcements
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-mono">Account Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            {hasCookie ? (
              <CheckCircle className="w-4 h-4 text-green-500" />
            ) : (
              <XCircle className="w-4 h-4 text-destructive" />
            )}
            <span className="text-foreground">
              Cookie: {hasCookie ? "Configured" : "Not set"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">
              SOCKS5 Proxies: {socks5Count}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-mono">Update Credentials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Full Cookie String</Label>
            <Input
              type="password"
              placeholder={hasCookie ? "Leave empty to keep current" : "Paste full cookie string..."}
              value={fullCookie}
              onChange={(e) => setFullCookie(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Must contain auth_token and ct0 values
            </p>
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

          <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Configuration
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
