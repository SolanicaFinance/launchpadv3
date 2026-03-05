import { useState, useRef } from "react";
import { X, Camera, Volume2, VolumeX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  profile: { display_name?: string | null; avatar_url?: string | null; username?: string | null } | null;
  onProfileUpdate?: () => void;
}

export function SettingsModal({ open, onClose, profile, onProfileUpdate }: SettingsModalProps) {
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(profile?.display_name || "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || "");
  const fileRef = useRef<HTMLInputElement>(null);

  // Sound preferences
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("pulse-sounds-enabled") === "true");
  const [quickBuyDefault, setQuickBuyDefault] = useState(() => {
    try { const v = localStorage.getItem("pulse-quick-buy-amount"); return v || "0.5"; } catch { return "0.5"; }
  });
  const [slippage, setSlippage] = useState(() => {
    try { return localStorage.getItem("pulse-slippage") || "1"; } catch { return "1"; }
  });

  if (!open) return null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      setAvatarPreview(publicUrl);
      // Update profile
      await supabase.from("profiles").update({ avatar_url: publicUrl }).eq("id", user.id);
      toast({ title: "Avatar updated" });
      onProfileUpdate?.();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      await supabase.from("profiles").update({ display_name: displayName }).eq("id", user.id);
      // Save local prefs
      localStorage.setItem("pulse-sounds-enabled", soundEnabled ? "true" : "false");
      localStorage.setItem("pulse-quick-buy-amount", quickBuyDefault);
      localStorage.setItem("pulse-slippage", slippage);
      toast({ title: "Settings saved" });
      onProfileUpdate?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md mx-4 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <h2 className="text-sm font-bold text-foreground">Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Avatar */}
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
              <div className="h-16 w-16 rounded-full bg-muted border-2 border-border overflow-hidden flex items-center justify-center">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-lg font-bold text-muted-foreground">
                    {displayName?.slice(0, 2)?.toUpperCase() || "?"}
                  </span>
                )}
              </div>
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-4 w-4 text-white" />
              </div>
            </div>
            <div className="flex-1">
              <label className="text-[11px] text-muted-foreground font-medium">Display Name</label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full mt-1 h-8 px-3 text-[12px] rounded-lg bg-muted/40 border border-border/40 text-foreground outline-none focus:border-primary/50 font-mono"
                placeholder="Enter display name"
              />
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Sound */}
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
              <span className="text-[12px] font-medium text-foreground">Trade Sounds</span>
            </div>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`h-6 w-11 rounded-full transition-colors ${soundEnabled ? "bg-primary" : "bg-muted"} relative`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-background shadow-md transition-transform ${soundEnabled ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>

          {/* Quick Buy Default */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium">Default Quick Buy (SOL)</label>
            <input
              value={quickBuyDefault}
              onChange={(e) => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setQuickBuyDefault(e.target.value); }}
              className="w-full mt-1 h-8 px-3 text-[12px] rounded-lg bg-muted/40 border border-border/40 text-foreground outline-none focus:border-primary/50 font-mono"
              placeholder="0.5"
            />
          </div>

          {/* Slippage */}
          <div>
            <label className="text-[11px] text-muted-foreground font-medium">Slippage Tolerance (%)</label>
            <div className="flex items-center gap-2 mt-1">
              {["0.5", "1", "2", "5"].map((v) => (
                <button
                  key={v}
                  onClick={() => setSlippage(v)}
                  className={`px-3 py-1.5 rounded-md text-[11px] font-mono font-bold border transition-colors ${
                    slippage === v ? "border-primary/50 bg-primary/10 text-primary" : "border-border/40 bg-muted/30 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {v}%
                </button>
              ))}
              <input
                value={slippage}
                onChange={(e) => { if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) setSlippage(e.target.value); }}
                className="flex-1 h-8 px-3 text-[12px] rounded-lg bg-muted/40 border border-border/40 text-foreground outline-none focus:border-primary/50 font-mono"
                placeholder="Custom"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/50 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-[12px] font-medium text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || uploading}
            className="px-5 py-2 rounded-lg text-[12px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
