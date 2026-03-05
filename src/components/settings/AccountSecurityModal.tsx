import { useState } from "react";
import { X, Shield, Key, Smartphone, Mail, ExternalLink } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";

interface AccountSecurityModalProps {
  open: boolean;
  onClose: () => void;
}

export function AccountSecurityModal({ open, onClose }: AccountSecurityModalProps) {
  const { user } = useAuth();
  const { walletAddress } = useSolanaWalletWithPrivy();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const handleCopyAddress = async () => {
    if (!walletAddress) return;
    const ok = await copyToClipboard(walletAddress);
    if (ok) {
      setCopied(true);
      toast({ title: "Address copied" });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg mx-4 rounded-xl border border-border bg-background/95 backdrop-blur-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">Account & Security</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Identity Section */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Identity</h3>
            <div className="space-y-2">
              <InfoRow
                icon={<Mail className="h-3.5 w-3.5" />}
                label="Login Method"
                value={user?.twitter?.username ? `Twitter (@${user.twitter.username})` : "Email / Social"}
              />
              <InfoRow
                icon={<Key className="h-3.5 w-3.5" />}
                label="User ID"
                value={user?.privyId?.slice(0, 16) + "..." || "—"}
              />
            </div>
          </div>

          {/* Wallet Section */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Embedded Wallet</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="text-[12px] font-mono text-foreground truncate">
                    {walletAddress || "No wallet"}
                  </span>
                </div>
                {walletAddress && (
                  <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                    <button
                      onClick={handleCopyAddress}
                      className="text-[10px] font-bold text-primary hover:text-primary/80 transition-colors"
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                    <a
                      href={`https://solscan.io/account/${walletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Security Section */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Security</h3>
            <div className="p-3 rounded-lg bg-muted/30 border border-border/30">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[12px] text-foreground font-medium">Session Active</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Your wallet is secured by Privy's MPC infrastructure. Private keys are split across multiple parties and never stored in one place.
              </p>
            </div>
          </div>

          {/* Export / Recovery */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Recovery</h3>
            <p className="text-[11px] text-muted-foreground">
              Your embedded wallet is linked to your login method. As long as you can sign in, you can access your wallet. For additional security, export your private key from the Privy recovery flow.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-[12px] font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
      <div className="flex items-center gap-2">
        <span className="text-muted-foreground">{icon}</span>
        <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      </div>
      <span className="text-[12px] text-foreground font-mono">{value}</span>
    </div>
  );
}
