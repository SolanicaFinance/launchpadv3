import { useState, useRef, useEffect } from "react";
import { X, Camera, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import defaultAvatar from "@/assets/saturn-logo.png";

interface EditProfileModalProps {
  open: boolean;
  onClose: () => void;
  profile: {
    display_name?: string | null;
    username?: string | null;
    bio?: string | null;
    location?: string | null;
    website?: string | null;
    avatar_url?: string | null;
    cover_url?: string | null;
    username_changed_at?: string | null;
  } | null;
  onSaved?: () => void;
}

export function EditProfileModal({ open, onClose, profile, onSaved }: EditProfileModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const avatarRef = useRef<HTMLInputElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [website, setWebsite] = useState("");
  const [avatarPreview, setAvatarPreview] = useState("");
  const [coverPreview, setCoverPreview] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync form when profile changes or modal opens
  useEffect(() => {
    if (open && profile) {
      setDisplayName(profile.display_name || "");
      setUsername(profile.username || "");
      setBio(profile.bio || "");
      setLocation(profile.location || "");
      setWebsite(profile.website || "");
      setAvatarPreview(profile.avatar_url || "");
      setCoverPreview(profile.cover_url || "");
      setAvatarFile(null);
      setCoverFile(null);
    }
  }, [open, profile]);

  if (!open) return null;

  const canChangeUsername = !profile?.username_changed_at ||
    Date.now() - new Date(profile.username_changed_at).getTime() > 30 * 24 * 60 * 60 * 1000;

  const handleFileSelect = (type: "avatar" | "cover") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5MB", variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(file);
    if (type === "avatar") {
      setAvatarFile(file);
      setAvatarPreview(url);
    } else {
      setCoverFile(file);
      setCoverPreview(url);
    }
  };

  const uploadFile = async (file: File, path: string): Promise<string> => {
    const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
    return publicUrl;
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const privyUserId = user.privyId;
      const updates: Record<string, unknown> = {};

      if (displayName !== (profile?.display_name || "")) updates.display_name = displayName;
      if (bio !== (profile?.bio || "")) updates.bio = bio;
      if (location !== (profile?.location || "")) updates.location = location;
      if (website !== (profile?.website || "")) updates.website = website;
      if (username !== (profile?.username || "") && canChangeUsername) {
        updates.username = username;
        updates.username_changed_at = new Date().toISOString();
      }

      // Upload avatar if changed
      if (avatarFile) {
        const ext = avatarFile.name.split(".").pop();
        const path = `${privyUserId}/avatar.${ext}`;
        const url = await uploadFile(avatarFile, path);
        updates.avatar_url = url;
      }

      // Upload cover if changed
      if (coverFile) {
        const ext = coverFile.name.split(".").pop();
        const path = `${privyUserId}/cover.${ext}`;
        const url = await uploadFile(coverFile, path);
        updates.cover_url = url;
      }

      if (Object.keys(updates).length === 0) {
        onClose();
        return;
      }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-profile`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ privyUserId, ...updates }),
        }
      );

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");

      toast({ title: "Profile updated" });
      onSaved?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[5vh] bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-bold text-foreground">Edit profile</h2>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 rounded-full text-[13px] font-bold bg-foreground text-background hover:bg-foreground/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
          </button>
        </div>

        <div className="max-h-[75vh] overflow-y-auto">
          {/* Cover photo */}
          <div className="relative h-32 md:h-40 bg-muted/30">
            {coverPreview && (
              <img src={coverPreview} alt="" className="w-full h-full object-cover" />
            )}
            <button
              onClick={() => coverRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity"
            >
              <div className="h-10 w-10 rounded-full bg-black/60 flex items-center justify-center">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>
            <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect("cover")} />
          </div>

          {/* Avatar */}
          <div className="px-5 -mt-10 mb-4">
            <div className="relative inline-block">
              <div className="h-20 w-20 rounded-full border-4 border-background bg-muted overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
                ) : (
                  <img src={defaultAvatar} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <button
                onClick={() => avatarRef.current?.click()}
                className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
              >
                <Camera className="h-5 w-5 text-white" />
              </button>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect("avatar")} />
            </div>
          </div>

          {/* Form fields */}
          <div className="px-5 pb-6 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground">Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                maxLength={50}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Username</Label>
              <div className="relative mt-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="username"
                  maxLength={30}
                  disabled={!canChangeUsername}
                  className="pl-7"
                />
              </div>
              {!canChangeUsername && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  Username can only be changed once every 30 days
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Bio</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell the world about yourself"
                maxLength={160}
                rows={3}
                className="mt-1 resize-none"
              />
              <p className="text-[10px] text-muted-foreground text-right mt-0.5">{bio.length}/160</p>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Location</Label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Where are you based?"
                maxLength={50}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Website</Label>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://your-site.com"
                maxLength={100}
                className="mt-1"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
