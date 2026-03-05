import { useEffect, useState, useRef } from "react";
import { Copy, Check, Wallet, LogOut, ChevronDown, Settings, Crosshair, Shield, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { AccountSecurityModal } from "@/components/settings/AccountSecurityModal";

function HeaderWalletBalanceInner() {
  const { isAuthenticated, logout } = useAuth();
  const { walletAddress: embeddedAddress, getBalance } = useSolanaWalletWithPrivy();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!embeddedAddress) return;
    let cancelled = false;
    const fetchBal = async () => {
      try {
        const bal = await getBalance();
        if (!cancelled) setBalance(bal);
      } catch (e) {
        console.warn("Header balance fetch failed:", e);
      }
    };
    fetchBal();
    const interval = setInterval(fetchBal, 15000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [embeddedAddress, getBalance]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (!isAuthenticated || !embeddedAddress) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(embeddedAddress);
    if (ok) {
      setCopied(true);
      toast({ title: "Address copied", description: "Send SOL to this address to top up" });
      setTimeout(() => setCopied(false), 2000);
    }
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try { await logout(); } catch (e) { console.warn("Logout error:", e); }
    window.location.href = "/";
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="hidden sm:flex items-center gap-1.5 h-8 px-3 rounded-xl text-[12px] font-bold transition-all duration-200 hover:bg-surface-hover flex-shrink-0 border border-border cursor-pointer group"
          title="Wallet menu"
        >
          <Wallet className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-foreground font-mono">
            {balance !== null
              ? `${balance.toFixed(3)} SOL`
              : `${embeddedAddress.slice(0, 4)}..${embeddedAddress.slice(-4)}`}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden z-50 border border-border/60 shadow-xl"
            style={{ background: "hsl(var(--background) / 0.97)", backdropFilter: "blur(16px)" }}
          >
            {/* Menu items — Axiom style: clean rows, no profile header, just actions */}
            <div className="py-2">
              <MenuItem
                icon={<User className="h-4 w-4" />}
                label="Account and Security"
                onClick={() => { setMenuOpen(false); setAccountOpen(true); }}
              />
              <MenuItem
                icon={<Settings className="h-4 w-4" />}
                label="Settings"
                onClick={() => { setMenuOpen(false); setSettingsOpen(true); }}
              />
              <MenuItem
                icon={<Crosshair className="h-4 w-4" />}
                label="Alpha Tracker"
                onClick={() => { setMenuOpen(false); navigate("/alpha-tracker"); }}
              />
            </div>

            <div className="border-t border-border/40">
              <div className="py-2">
                <MenuItem
                  icon={<LogOut className="h-4 w-4" />}
                  label="Log Out"
                  onClick={handleLogout}
                  destructive
                />
              </div>
            </div>
          </div>
        )}
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        profile={null}
        onProfileUpdate={() => {}}
      />

      <AccountSecurityModal
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
      />
    </>
  );
}

function MenuItem({ icon, label, onClick, destructive }: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 text-[13px] font-medium transition-colors cursor-pointer ${
        destructive
          ? "text-destructive hover:bg-destructive/10"
          : "text-foreground hover:bg-muted/50"
      }`}
    >
      <span className={destructive ? "" : "text-muted-foreground"}>{icon}</span>
      {label}
    </button>
  );
}

export function HeaderWalletBalance() {
  const privyAvailable = usePrivyAvailable();
  const { isAuthenticated } = useAuth();

  if (!privyAvailable || !isAuthenticated) return null;

  return <HeaderWalletBalanceInner />;
}
