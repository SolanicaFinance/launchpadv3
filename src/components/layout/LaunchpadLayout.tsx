import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { DelegationPrompt } from "@/components/DelegationPrompt";

import { useAnnouncements } from "@/hooks/useAnnouncements";
import { useLiveTradeToasts } from "@/hooks/useLiveTradeToasts";

interface LaunchpadLayoutProps {
  children: ReactNode;
  showKingOfTheHill?: boolean;
  hideFooter?: boolean;
  noPadding?: boolean;
}

export function LaunchpadLayout({ children, hideFooter, noPadding }: LaunchpadLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  useAnnouncements();
  useLiveTradeToasts();

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen relative z-10">
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
        <main
          className={
            noPadding
              ? "flex-1 overflow-x-hidden relative z-10 pt-[calc(56px+env(safe-area-inset-top,0px))] md:pt-0"
              : "flex-1 overflow-x-hidden relative z-10 px-4 pb-16 pt-[calc(56px+env(safe-area-inset-top,0px)+1rem)] md:p-4"
          }
        >
          {children}
        </main>
        {!hideFooter && <Footer />}
      </div>
      <DelegationPrompt />
      <LeverageTradingPopup />
    </div>
  );
}
