import { ReactNode, useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { AppHeader } from "@/components/layout/AppHeader";
import { Footer } from "@/components/layout/Footer";
import { DelegationPrompt } from "@/components/DelegationPrompt";

interface LaunchpadLayoutProps {
  children: ReactNode;
  showKingOfTheHill?: boolean;
  hideFooter?: boolean;
  noPadding?: boolean;
}

export function LaunchpadLayout({ children, hideFooter, noPadding }: LaunchpadLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">
      <Sidebar mobileOpen={mobileMenuOpen} onMobileClose={() => setMobileMenuOpen(false)} />
      <div className="md:ml-[48px] flex flex-col min-h-screen relative z-10">
        <AppHeader onMobileMenuOpen={() => setMobileMenuOpen(true)} />
        <main className={`flex-1 overflow-x-hidden relative z-10 ${noPadding ? '' : 'p-4 pb-16'}`}>
          {children}
        </main>
        {!hideFooter && <Footer />}
      </div>
      <DelegationPrompt />
    </div>
  );
}
