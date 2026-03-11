import { Link, useLocation } from "react-router-dom";
import { Home, Zap, Bot, TrendingUp, Plus, FileText, Monitor, Crosshair, LayoutDashboard, ShoppingBag, CandlestickChart, Radar, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { usePanelNav } from "@/hooks/usePanelNav";
import { useMatrixMode } from "@/contexts/MatrixModeContext";
import saturnLogo from "@/assets/saturn-logo.png";

const LOGO_SRC = saturnLogo;

const NAV_LINKS = [
  { to: "/", label: "Home", icon: Home, exact: true },
  { to: "/trade", label: "Pulse", icon: Zap },
  { to: "/launchpad", label: "Launchpad", icon: Rocket },
  { to: "/discover", label: "Discover", icon: TrendingUp },
  { to: "/alpha-tracker", label: "Alpha", icon: Crosshair },
  { to: "/x-tracker", label: "X Tracker", icon: Radar },
  { to: "/agents", label: "Agents", icon: Bot },
  { to: "/leverage", label: "Leverage", icon: CandlestickChart },
  
  { to: "/whitepaper", label: "Docs", icon: FileText },
  { to: "/merch", label: "Merch", icon: ShoppingBag },
  { to: "/panel", label: "Panel", icon: LayoutDashboard },
];

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function SidebarContent({ onLinkClick }: { onLinkClick?: () => void }) {
  const location = useLocation();
  const { goToPanel } = usePanelNav();
  const isMobile = !!onLinkClick;

  const isActive = (to: string, exact?: boolean) => {
    if (exact) return location.pathname === to || location.pathname === "/launch/solana";
    return location.pathname.startsWith(to) && to !== "/";
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo */}
      <div className={cn(
        "flex items-center justify-center border-b border-border/30",
        isMobile ? "px-3 pt-5 pb-4" : "py-3"
      )}>
        <Link to="/" onClick={onLinkClick} className="group transition-all duration-300">
          <img
            src={LOGO_SRC}
            alt="Saturn Trade"
            className={cn(
              "object-contain rounded-sm flex-shrink-0 transition-all duration-300 group-hover:drop-shadow-[0_0_8px_hsl(72_100%_50%/0.5)]",
              isMobile ? "h-8 w-8" : "h-7 w-7"
            )}
          />
        </Link>
      </div>

      <nav className={cn("flex-1 flex flex-col items-center gap-0.5 py-2", isMobile && "items-stretch px-2")}>
        {NAV_LINKS.map((navItem) => {
          const { to, label, icon: Icon, exact } = navItem;
          const active = isActive(to, exact);
          
          const iconEl = Icon ? (
            <Icon className={cn("h-4 w-4 flex-shrink-0 transition-colors", active && "text-primary")} />
          ) : null;

          if (isMobile) {
            // Mobile: show labels
            const classes = cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-sm text-[13px] font-medium transition-all duration-200 w-full border-l-2",
              active
                ? "text-foreground bg-surface-hover border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/50 border-transparent"
            );

            return (
              <Link key={to} to={to} onClick={onLinkClick} className={classes}>
                {iconEl}
                <span>{label}</span>
              </Link>
            );
          }

          // Desktop: icon-only with tooltip
          const desktopClasses = cn(
            "relative flex items-center justify-center w-9 h-9 rounded-sm transition-all duration-200 group/nav",
            active
              ? "text-primary bg-primary/10"
              : "text-muted-foreground hover:text-foreground hover:bg-surface-hover/50"
          );

          const content = (
            <>
              {iconEl}
              {/* Tooltip */}
              <span className="absolute left-full ml-2 px-2 py-1 text-[11px] font-medium bg-popover text-popover-foreground border border-border rounded-sm whitespace-nowrap opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-opacity z-50">
                {label}
              </span>
              {/* Active indicator bar */}
              {active && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-[3px] w-[3px] h-4 bg-primary rounded-r-full" />
              )}
            </>
          );

          return (
            <Link key={to} to={to} className={desktopClasses}>
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Create Token CTA */}
      <div className={cn("space-y-2", isMobile ? "pb-14 px-3" : "pb-20 px-1.5 flex flex-col items-center")}>
        <Link
          to="/launchpad?create=1"
          onClick={onLinkClick}
          className={cn(
            "btn-gradient-green flex items-center justify-center rounded-sm font-bold",
            isMobile ? "gap-2 w-full py-2.5 text-[13px]" : "w-9 h-9"
          )}
          title="Create Token"
        >
          <Plus className={cn(isMobile ? "h-4 w-4" : "h-4 w-4")} />
          {isMobile && "Create Token"}
        </Link>
      </div>
    </div>
  );
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Sheet open={mobileOpen} onOpenChange={(open) => !open && onMobileClose?.()}>
        <SheetContent side="left" className="p-0 w-[200px] border-r-0 bg-sidebar" style={{ borderRight: "1px solid hsl(var(--border))" }}>
          <SidebarContent onLinkClick={onMobileClose} />
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <aside
      className="fixed top-0 left-0 h-screen z-40 flex-shrink-0 bg-sidebar/95 backdrop-blur-md border-r border-border"
      style={{ width: "48px" }}
    >
      <SidebarContent />
    </aside>
  );
}
