import { useEffect, useState, useRef, useCallback } from "react";
import { Copy, Check, Wallet, LogOut, ChevronDown, Settings, Crosshair, Shield, User, Zap, ArrowDownToLine } from "lucide-react";
import defaultAvatar from "@/assets/moondexo-logo.png";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePrivyAvailable } from "@/providers/PrivyProviderWrapper";
import { useSolanaWalletWithPrivy } from "@/hooks/useSolanaWalletPrivy";
import { copyToClipboard } from "@/lib/clipboard";
import { useToast } from "@/hooks/use-toast";
import { SettingsModal } from "@/components/settings/SettingsModal";
import { AccountSecurityModal } from "@/components/settings/AccountSecurityModal";
import { PortfolioModal } from "@/components/portfolio/PortfolioModal";
import { DepositDialog } from "@/components/wallet/DepositDialog";
import { useChain } from "@/contexts/ChainContext";
import { useEvmWallet } from "@/hooks/useEvmWallet";
import { usePrivyEvmWallet } from "@/hooks/usePrivyEvmWallet";
import { fetchBnbBalance as fetchBnbBalanceRpc } from "@/lib/bscRpc";

function HeaderWalletBalanceInner() {
  const { isAuthenticated, logout } = useAuth();
  const { walletAddress: embeddedAddress, getBalance } = useSolanaWalletWithPrivy();
  const { chain } = useChain();
  const evmWallet = useEvmWallet();
  const privyEvm = usePrivyEvmWallet();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<{ display_name?: string | null; avatar_url?: string | null; username?: string | null; evm_wallet_address?: string | null } | null>(null);

  const isBnb = chain === 'bnb';
  const evmAddress = privyEvm.address || evmWallet.address || '';
  const displayAddress = isBnb ? evmAddress : (embeddedAddress || '');
  const currencyLabel = isBnb ? 'BNB' : 'SOL';

  useEffect(() => {
    if (!embeddedAddress && !evmAddress) return;
    const fetchProfile = async () => {
      // Try fetching by solana address first, then evm
      let data = null;
      if (embeddedAddress) {
        const res = await (supabase as any).from("profiles").select("display_name, avatar_url, username, evm_wallet_address").eq("solana_wallet_address", embeddedAddress).maybeSingle();
        data = res.data;
      }
      if (!data && evmAddress) {
        const res = await (supabase as any).from("profiles").select("display_name, avatar_url, username, evm_wallet_address").eq("evm_wallet_address", evmAddress).maybeSingle();
        data = res.data;
      }
      if (data) setProfile(data);
    };
    fetchProfile();
  }, [embeddedAddress, evmAddress, settingsOpen]);

  const [balanceLoading, setBalanceLoading] = useState(true);

  useEffect(() => {
    if (isBnb) {
      const bnbAddress = evmAddress;
      if (!bnbAddress) { setBalance(null); setBalanceLoading(false); return; }
      let cancelled = false;
      setBalanceLoading(true);
      const fetchBnbBal = async () => {
        try {
          const bal = await fetchBnbBalanceRpc(bnbAddress);
          if (!cancelled) {
            setBalance(bal);
            setBalanceLoading(false);
          }
        } catch (e) { console.warn("BNB balance fetch failed:", e); if (!cancelled) setBalanceLoading(false); }
      };
      fetchBnbBal();
      const interval = setInterval(fetchBnbBal, 15000);
      return () => { cancelled = true; clearInterval(interval); };
    } else {
      if (!embeddedAddress) { setBalanceLoading(false); return; }
      let cancelled = false;
      setBalanceLoading(true);

      // Fast path: use edge function for quick server-side balance
      const fetchViaEdge = async () => {
        try {
          const { data } = await supabase.functions.invoke("fetch-sol-balances", {
            body: { wallets: [embeddedAddress] },
          });
          if (!cancelled && data?.balances?.[embeddedAddress] !== undefined) {
            setBalance(data.balances[embeddedAddress]);
            setBalanceLoading(false);
          }
        } catch (e) {
          console.warn("Edge balance fetch failed, falling back to RPC:", e);
        }
      };

      // Also fetch via RPC as backup / refresh
      const fetchViaRpc = async () => {
        try {
          const bal = await getBalance();
          if (!cancelled) { setBalance(bal); setBalanceLoading(false); }
        } catch (e) { console.warn("Header RPC balance fetch failed:", e); if (!cancelled) setBalanceLoading(false); }
      };

      // Race: edge function (fast) + RPC (accurate)
      fetchViaEdge();
      fetchViaRpc();

      const interval = setInterval(fetchViaRpc, 15000);
      return () => { cancelled = true; clearInterval(interval); };
    }
  }, [embeddedAddress, getBalance, chain, evmWallet.isConnected, evmWallet.address, privyEvm.address]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [menuOpen]);

  if (!isAuthenticated || (!embeddedAddress && !evmAddress)) return null;

  const handleCopy = async () => {
    const ok = await copyToClipboard(displayAddress);
    if (ok) {
      setCopied(true);
      toast({ title: "Address copied", description: `Send ${currencyLabel} to this address to top up` });
      setTimeout(() => setCopied(false), 2000);
    }
    setMenuOpen(false);
  };

  const handleLogout = async () => {
    setMenuOpen(false);
    try { await logout(); } catch (e) { console.warn("Logout error:", e); }
    window.location.href = "/";
  };

  const handleProfileClick = () => {
    setMenuOpen(false);
    navigate('/panel');
  };

  return (
    <>
      <div className="relative" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="hidden sm:flex items-center gap-2 h-9 px-3 rounded-lg text-xs font-bold
                     transition-all duration-200 flex-shrink-0
                     border border-border/30 bg-card/20 backdrop-blur-sm
                     hover:bg-card/40 hover:border-primary/30 hover:scale-[1.03]
                     hover:shadow-[0_0_16px_hsl(84_81%_44%/0.08)]
                     cursor-pointer group"
          title="Wallet menu"
        >
          <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_hsl(152_69%_53%/0.6)]" />
          <span className="text-foreground font-mono tracking-wide">
            {balanceLoading && balance === null
              ? <span className="inline-block h-3.5 w-16 bg-muted/60 rounded animate-pulse align-middle" />
              : balance !== null
                ? `${balance.toFixed(3)} ${currencyLabel}`
                : `${displayAddress.slice(0, 4)}..${displayAddress.slice(-4)}`}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground group-hover:text-foreground transition-colors" />
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-56 rounded-2xl overflow-hidden z-50 border border-border/60 shadow-xl"
            style={{ background: "hsl(var(--background) / 0.97)", backdropFilter: "blur(16px)" }}
          >
            {/* Profile header */}
            <button
              onClick={handleProfileClick}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border/40"
            >
              <div className="h-9 w-9 rounded-full bg-muted border border-border overflow-hidden flex items-center justify-center flex-shrink-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <img src={defaultAvatar} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="text-left min-w-0">
                <div className="text-[13px] font-bold text-foreground truncate">
                  {profile?.display_name || displayAddress.slice(0, 6) + '...' + displayAddress.slice(-4)}
                </div>
                <div className="text-[11px] text-muted-foreground">Edit profile</div>
              </div>
            </button>

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
                icon={<Wallet className="h-4 w-4" />}
                label="Portfolio"
                onClick={() => { setMenuOpen(false); navigate("/portfolio"); }}
              />
              <MenuItem
                icon={<ArrowDownToLine className="h-4 w-4" />}
                label="Deposit"
                onClick={() => { setMenuOpen(false); setDepositOpen(true); }}
              />
              <MenuItem
                icon={<Zap className="h-4 w-4" />}
                label="Pulse"
                onClick={() => { setMenuOpen(false); navigate("/trade"); }}
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

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} profile={null} onProfileUpdate={() => {}} />
      <AccountSecurityModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <PortfolioModal open={portfolioOpen} onClose={() => setPortfolioOpen(false)} />
      <DepositDialog
        open={depositOpen}
        onOpenChange={setDepositOpen}
        address={displayAddress}
        chain={isBnb ? "bnb" : "solana"}
        getBalance={isBnb ? undefined : getBalance}
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
