import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Search, Plus, Menu } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { useState, useEffect, useCallback } from "react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { EthPriceDisplay } from "./EthPriceDisplay";
import { BnbPriceDisplay } from "./BnbPriceDisplay";
import { useChain } from "@/contexts/ChainContext";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";
import { usePanelNav } from "@/hooks/usePanelNav";
import { HeaderWalletBalance } from "./HeaderWalletBalance";
import { useAuth } from "@/hooks/useAuth";
import saturnLogo from "@/assets/saturn-logo.png";

interface TopBarProps {
  onMobileMenuOpen?: () => void;
  showBack?: boolean;
  backTo?: string;
  backLabel?: string;
}

export function AppHeader({ onMobileMenuOpen }: TopBarProps) {
  const { chain } = useChain();
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const isOnTrade = location.pathname === "/trade";

  const [search, setSearch] = useState(() => isOnTrade ? (searchParams.get("q") || "") : "");

  useEffect(() => {
    if (isOnTrade) {
      setSearch(searchParams.get("q") || "");
    } else {
      setSearch("");
    }
  }, [location.pathname]);

  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    if (isOnTrade) {
      if (value.trim()) {
        setSearchParams({ q: value }, { replace: true });
      } else {
        setSearchParams({}, { replace: true });
      }
    }
  }, [isOnTrade, setSearchParams]);

  const handleSearchKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter" && search.trim() && !isOnTrade) {
      navigate(`/trade?q=${encodeURIComponent(search.trim())}`);
    }
  }, [search, isOnTrade, navigate]);

  const { goToPanel } = usePanelNav();

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 px-3 bg-background/90 backdrop-blur-md border-b border-border"
      style={{ height: "44px" }}
    >
      {/* Mobile hamburger */}
      <button
        className="md:hidden flex items-center justify-center h-7 w-7 rounded-sm text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-200"
        onClick={onMobileMenuOpen}
      >
        <Menu className="h-3.5 w-3.5" />
      </button>

      {/* Chain switcher */}
      <div className="hidden sm:block flex-shrink-0">
        <ChainSwitcher />
      </div>

      {/* Search input */}
      <div className="flex-1 max-w-sm relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 pointer-events-none text-muted-foreground" />
        <input
          type="text"
          placeholder="Search token..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="w-full h-7 pl-8 pr-3 text-[11px] rounded-sm outline-none text-foreground placeholder-muted-foreground bg-surface border border-border transition-all duration-200 focus:border-primary/40 focus:ring-1 focus:ring-primary/20 font-mono"
        />
      </div>

      {/* Right side */}
      <div className="flex items-center gap-1.5 ml-auto">
        {chain === 'bnb' ? <BnbPriceDisplay /> : chain === 'base' ? <EthPriceDisplay /> : <SolPriceDisplay />}

        <a
          href="https://x.com/saturntrade"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center h-7 w-7 rounded-sm transition-all duration-200 text-muted-foreground hover:text-foreground hover:bg-surface-hover"
        >
          <XIcon className="h-3.5 w-3.5" />
        </a>

        {isAuthenticated ? (
          <HeaderWalletBalance />
        ) : (
          <button
            onClick={goToPanel}
            className="hidden sm:flex items-center gap-1.5 h-7 px-2.5 rounded-sm text-[11px] font-bold transition-all duration-200 hover:bg-surface-hover flex-shrink-0 border border-primary/40 text-primary cursor-pointer"
          >
            <img src={saturnLogo} alt="" className="h-3.5 w-3.5 rounded-sm" />
            Panel
          </button>
        )}

        <Link
          to="/launchpad"
          className="hidden sm:flex items-center gap-1 h-7 px-3 rounded-sm text-[11px] font-bold btn-gradient-green flex-shrink-0"
        >
          <Plus className="h-3 w-3" />
          Create
        </Link>
      </div>
    </header>
  );
}
