import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserPlus, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface AddResult {
  success?: boolean;
  error?: string;
  kol?: {
    username: string;
    display_name: string;
    profile_image_url: string | null;
    follower_count: number;
  };
  follower_count?: number;
  display_name?: string;
  profile_image_url?: string | null;
}

export function AddKolDialog() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AddResult | null>(null);
  const queryClient = useQueryClient();

  const handleSubmit = async () => {
    if (!username.trim()) return;
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("add-kol", {
        body: { username: username.trim() },
      });

      if (error) {
        setResult({ error: "Failed to check user. Please try again." });
      } else if (data?.error) {
        setResult(data as AddResult);
      } else if (data?.success) {
        setResult(data as AddResult);
        queryClient.invalidateQueries({ queryKey: ["community-kols"] });
        queryClient.invalidateQueries({ queryKey: ["kol-tweets"] });
      }
    } catch (e) {
      setResult({ error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setTimeout(() => {
      setUsername("");
      setResult(null);
    }, 300);
  };

  const profileImage = result?.kol?.profile_image_url || result?.profile_image_url;
  const displayName = result?.kol?.display_name || result?.display_name;
  const followerCount = result?.kol?.follower_count || result?.follower_count;

  return (
    <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs">
          <UserPlus className="w-3.5 h-3.5" />
          Add KOL
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg">Add KOL to Tracker</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="flex gap-2">
            <Input
              placeholder="@username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSubmit()}
              disabled={loading}
              className="flex-1"
            />
            <Button onClick={handleSubmit} disabled={loading || !username.trim()} size="sm">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check & Add"}
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Only accounts with 50,000+ followers can be added to the KOL list.
          </p>

          {result && (
            <div className={`rounded-xl border p-4 ${
              result.success 
                ? "border-green-500/30 bg-green-500/5" 
                : "border-red-500/30 bg-red-500/5"
            }`}>
              {/* Profile display */}
              {(profileImage || displayName) && (
                <div className="flex items-center gap-3 mb-3">
                  {profileImage ? (
                    <img
                      src={profileImage}
                      alt={displayName || ""}
                      className="w-12 h-12 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-lg font-bold text-muted-foreground">
                      {(displayName || username)[0]?.toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-semibold text-foreground">{displayName}</div>
                    <div className="text-xs text-muted-foreground">@{result.kol?.username || username.replace("@", "")}</div>
                    {followerCount !== undefined && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {followerCount.toLocaleString()} followers
                      </div>
                    )}
                  </div>
                </div>
              )}

              {result.success ? (
                <div className="flex items-center gap-2 text-green-400">
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">This user was added to the KOL list!</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-red-400">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm">{result.error}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
