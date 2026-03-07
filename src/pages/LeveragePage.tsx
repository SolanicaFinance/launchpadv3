import { LeverageTerminal } from "@/components/leverage/LeverageTerminal";
import { Sidebar } from "@/components/layout/Sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState } from "react";
import { Menu } from "lucide-react";

export default function LeveragePage() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex">
      <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />

      <div className={isMobile ? "flex-1" : "flex-1 ml-[48px]"}>
        {/* Mobile header */}
        {isMobile && (
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card">
            <button onClick={() => setMobileOpen(true)} className="p-1">
              <Menu className="h-5 w-5 text-foreground" />
            </button>
            <span className="text-sm font-bold text-foreground">Leverage Trading</span>
            <span className="ml-auto text-[10px] px-2 py-0.5 rounded-sm bg-primary/10 text-primary font-medium">Aster DEX</span>
          </div>
        )}

        <LeverageTerminal />
      </div>
    </div>
  );
}
