import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Twitter, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface VerifyAccountModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function VerifyAccountModal({ open, onOpenChange }: VerifyAccountModalProps) {
  const { profileId, linkTwitter, linkEmail, linkedAccounts } = useAuth();
  const [updating, setUpdating] = useState(false);

  const twitterLinked = user?.linkedAccounts?.some(a => a.type === "twitter_oauth");
  const emailLinked = user?.linkedAccounts?.some(a => a.type === "email");
  const twitterUsername = user?.linkedAccounts?.find(a => a.type === "twitter_oauth")?.username;

  const handleLinkTwitter = async () => {
    try {
      await linkTwitter();
      await updateVerifiedStatus();
    } catch (err: any) {
      if (!err?.message?.includes("closed")) {
        toast.error("Failed to link X account");
      }
    }
  };

  const handleLinkEmail = async () => {
    try {
      await linkEmail();
    } catch (err: any) {
      if (!err?.message?.includes("closed")) {
        toast.error("Failed to link email");
      }
    }
  };

  const updateVerifiedStatus = async () => {
    if (!profileId) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ verified_type: "blue" } as any)
        .eq("id", profileId);
      if (error) throw error;
      toast.success("Account verified! Badge will appear on your profile.");
    } catch {
      toast.error("Failed to update verification status");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border/60">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono font-bold uppercase tracking-widest text-foreground">
            Verify Your Account
          </DialogTitle>
          <DialogDescription className="text-xs font-mono text-muted-foreground">
            Link your X (Twitter) and email for a verified badge on your profile. Builds trust with traders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Celebrity text */}
          <div className="border border-[#4a5a2a] rounded-lg p-3 bg-[#1a2a0a]/40">
            <p className="text-[11px] font-mono font-bold text-[#c8ff00] uppercase tracking-wider">
              I'm a celebrity and I want to connect my Twitter
            </p>
            <p className="text-[10px] font-mono text-muted-foreground mt-1">
              Connecting your X account proves you are who you say you are.
            </p>
          </div>

          {/* Link X Account */}
          <button
            onClick={handleLinkTwitter}
            disabled={!!twitterLinked}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all font-mono text-sm ${
              twitterLinked
                ? "border-green-500/30 bg-green-500/5 text-green-400 cursor-default"
                : "border-border/40 bg-background/40 text-foreground hover:border-[#4a5a2a] hover:bg-[#1a2a0a]/30"
            }`}
          >
            <Twitter className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">
              {twitterLinked ? `@${twitterUsername || "linked"}` : "Link X Account"}
            </span>
            {twitterLinked && <CheckCircle className="h-4 w-4 text-green-400" />}
          </button>

          {/* Link Email */}
          <button
            onClick={handleLinkEmail}
            disabled={!!emailLinked}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border transition-all font-mono text-sm ${
              emailLinked
                ? "border-green-500/30 bg-green-500/5 text-green-400 cursor-default"
                : "border-border/40 bg-background/40 text-foreground hover:border-[#4a5a2a] hover:bg-[#1a2a0a]/30"
            }`}
          >
            <Mail className="h-4 w-4 shrink-0" />
            <span className="flex-1 text-left">
              {emailLinked ? "Email linked" : "Link Email"}
            </span>
            {emailLinked && <CheckCircle className="h-4 w-4 text-green-400" />}
          </button>

          {/* CTA Button */}
          {twitterLinked && !updating && (
            <button
              onClick={() => onOpenChange(false)}
              className="w-full py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-widest bg-[#c8ff00] text-black hover:bg-[#d9ff33] transition-colors"
            >
              Done
            </button>
          )}

          {!twitterLinked && (
            <button
              onClick={handleLinkTwitter}
              className="w-full py-3 rounded-lg font-mono text-sm font-bold uppercase tracking-widest bg-[#c8ff00] text-black hover:bg-[#d9ff33] transition-colors"
            >
              Add Links
            </button>
          )}

          {/* Terms */}
          <p className="text-[9px] font-mono text-muted-foreground/50 text-center leading-relaxed">
            By linking your accounts you agree to our terms of service. Your linked accounts are used solely for verification purposes.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
