import { Link, useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { Search, Plus, Menu, X, Gift } from "lucide-react";
import { XIcon } from "@/components/icons/XIcon";
import { useState, useEffect, useCallback, useRef } from "react";
import { SolPriceDisplay } from "./SolPriceDisplay";
import { EthPriceDisplay } from "./EthPriceDisplay";
import { BnbPriceDisplay } from "./BnbPriceDisplay";
import { useChain } from "@/contexts/ChainContext";
import { ChainSwitcher } from "@/components/launchpad/ChainSwitcher";
import { usePanelNav } from "@/hooks/usePanelNav";
import { HeaderWalletBalance } from "./HeaderWalletBalance";
import { useAuth } from "@/hooks/useAuth";
import saturnLogo from "@/assets/moondexo-logo.png";
import { BRAND } from "@/config/branding";
import { useTokenSearch } from "@/hooks/useTokenSearch";
import { GlobalSearchDropdown } from "@/components/search/GlobalSearchDropdown";

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
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const { data: searchResults = [], isLoading: searchLoading } = useTokenSearch(debouncedQuery);

  useEffect(() => {
    if (isOnTrade) {
      setSearch(searchParams.get("q") || "");
    } else {
      setSearch("");
    }
  }, [location.pathname]);

  // Debounce search query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(search.trim());
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Show dropdown when we have a query
  useEffect(() => {
    setShowDropdown(debouncedQuery.length >= 2);
  }, [debouncedQuery]);

  // Close dropdown on route change
  useEffect(() => {
    setShowDropdown(false);
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
    if (e.key === "Enter" && search.trim()) {
      // If on trade page, just filter locally; otherwise navigate
      if (!isOnTrade) {
        navigate(`/trade?q=${encodeURIComponent(search.trim())}`);
        setMobileSearchOpen(false);
      }
      setShowDropdown(false);
    }
    if (e.key === "Escape") {
      setShowDropdown(false);
      setMobileSearchOpen(false);
    }
  }, [search, isOnTrade, navigate]);

  const closeDropdown = useCallback(() => setShowDropdown(false), []);

  const { goToPanel } = usePanelNav();

  return (
    <>
      <header
        className="sticky top-0 z-30 flex items-center gap-3 md:gap-4 lg:gap-5 px-3 md:px-5 lg:px-6"
        style={{
          height: "56px",
          background: "hsl(0 0% 0% / 0.55)",
          backdropFilter: "blur(20px) saturate(1.4)",
          WebkitBackdropFilter: "blur(20px) saturate(1.4)",
          borderBottom: "1px solid hsl(84 81% 44% / 0.12)",
        }}
      >
        <div className="flex items-center gap-3 md:gap-4 lg:gap-5 w-full max-w-[1800px] mx-auto">
          {/* ── Left: Hamburger (mobile) + Chain + Search ── */}
          <div className="flex items-center gap-2.5 md:gap-3 min-w-0">
            {/* Mobile hamburger */}
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-card/40"
              onClick={onMobileMenuOpen}
            >
              <Menu className="h-4 w-4" />
            </button>

            {/* Chain switcher — glass pill style */}
            <div className="hidden sm:block flex-shrink-0">
              <ChainSwitcher />
            </div>

            {/* Desktop search with dropdown */}
            <div className="hidden md:block relative w-56 lg:w-72 xl:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search token..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onFocus={() => { if (debouncedQuery.length >= 2) setShowDropdown(true); }}
                className="w-full h-9 pl-9 pr-3 text-xs rounded-lg outline-none
                           text-foreground placeholder-muted-foreground/50
                           font-mono tracking-wide
                           transition-all duration-300
                           border border-border/30 bg-card/20 backdrop-blur-sm
                           focus:border-primary/40 focus:ring-1 focus:ring-primary/20
                           focus:bg-card/40 focus:shadow-[0_0_12px_hsl(84_81%_44%/0.08)]"
              />
              {showDropdown && (
                <GlobalSearchDropdown
                  results={searchResults}
                  isLoading={searchLoading}
                  query={debouncedQuery}
                  onClose={closeDropdown}
                />
              )}
            </div>

            {/* Mobile search icon */}
            <button
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-muted-foreground hover:text-foreground transition-all duration-200 hover:bg-card/40"
              onClick={() => setMobileSearchOpen(true)}
            >
              <Search className="h-4 w-4" />
            </button>
          </div>

          {/* ── Center: SOL Price (desktop only) ── */}
          <div className="hidden md:flex flex-1 items-center justify-center">
            {chain === 'bnb' ? <BnbPriceDisplay /> : chain === 'base' ? <EthPriceDisplay /> : <SolPriceDisplay />}
          </div>

          {/* ── Right: X link, Wallet, Panel, Create ── */}
          <div className="flex items-center gap-2 md:gap-3 ml-auto">
            {/* SOL price — mobile only, compact */}
            <div className="md:hidden">
              {chain === 'bnb' ? <BnbPriceDisplay /> : chain === 'base' ? <EthPriceDisplay /> : <SolPriceDisplay />}
            </div>

            <Link
              to="/rewards"
              className="hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-lg transition-all duration-200
                         text-muted-foreground/70 hover:text-primary
                         hover:bg-primary/5 hover:scale-[1.03]
                         border border-transparent hover:border-primary/20"
              title="Social Rewards"
            >
              <Gift className="h-3.5 w-3.5" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Rewards</span>
            </Link>
            <a
              href="https://x.com/saturntrade"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg transition-all duration-200
                         text-muted-foreground/70 hover:text-foreground
                         hover:bg-card/40 hover:scale-[1.03]"
            >
              <XIcon className="h-3.5 w-3.5" />
            </a>
            <a
              href="https://t.me/moondexo_terminal"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg transition-all duration-200
                         text-muted-foreground/70 hover:text-foreground
                         hover:bg-card/40 hover:scale-[1.03]"
              title="Telegram"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            </a>

            {isAuthenticated ? (
              <HeaderWalletBalance />
            ) : (
              <button
                onClick={goToPanel}
                className="hidden sm:flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-bold
                           transition-all duration-200
                           border border-primary/30 text-primary
                           bg-primary/5 backdrop-blur-sm
                           hover:bg-primary/10 hover:border-primary/50 hover:scale-[1.03]
                           hover:shadow-[0_0_16px_hsl(84_81%_44%/0.12)]
                           cursor-pointer flex-shrink-0"
              >
                <img src={saturnLogo} alt="" className="h-4 w-4 rounded-sm" />
                Panel
              </button>
            )}

            <Link
              to="/launchpad"
              className="flex items-center gap-1.5 h-9 px-3.5 sm:px-4 rounded-lg text-xs font-bold
                         btn-gradient-green flex-shrink-0
                         hover:shadow-[0_0_24px_hsl(72_100%_50%/0.3)]"
            >
              <Plus className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Create</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Mobile full-screen search overlay ── */}
      {mobileSearchOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col md:hidden"
          style={{
            background: "hsl(0 0% 0% / 0.85)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
          }}
        >
          <div className="flex items-center gap-3 px-4 py-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none text-muted-foreground/60" />
              <input
                type="text"
                placeholder="Search token..."
                value={search}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                autoFocus
                className="w-full h-12 pl-10 pr-4 text-sm rounded-xl outline-none
                           text-foreground placeholder-muted-foreground/50
                           font-mono tracking-wide
                           border border-border/30 bg-card/30
                           focus:border-primary/40 focus:ring-1 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => { setMobileSearchOpen(false); setShowDropdown(false); }}
              className="flex items-center justify-center h-12 w-12 rounded-xl text-muted-foreground hover:text-foreground transition-colors bg-card/20"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {/* Mobile search results */}
          {debouncedQuery.length >= 2 && (
            <div className="flex-1 overflow-y-auto px-2">
              <GlobalSearchDropdown
                results={searchResults}
                isLoading={searchLoading}
                query={debouncedQuery}
                onClose={() => setMobileSearchOpen(false)}
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
