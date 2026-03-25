import { useState } from "react";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { PerpMarketsGrid } from "@/components/perps/PerpMarketsGrid";
import { PerpCreateMarket } from "@/components/perps/PerpCreateMarket";
import { cn } from "@/lib/utils";
import { TrendingUp, Plus } from "lucide-react";

type Tab = "markets" | "create";

export default function PerpsPage() {
  const [tab, setTab] = useState<Tab>("markets");

  return (
    <LaunchpadLayout hideFooter>
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black font-mono uppercase tracking-wider text-foreground flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-primary" />
              Perpetual Trading
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Trade long or short with leverage on any listed BNB token
            </p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-0.5 bg-secondary rounded-lg border border-border/50">
            <button
              onClick={() => setTab("markets")}
              className={cn(
                "px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                tab === "markets"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-3.5 w-3.5" />
              Markets
            </button>
            <button
              onClick={() => setTab("create")}
              className={cn(
                "px-4 py-2 rounded-md text-xs font-bold transition-all flex items-center gap-1.5",
                tab === "create"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
              Create Market
            </button>
          </div>
        </div>

        {/* Content */}
        {tab === "markets" && <PerpMarketsGrid />}
        {tab === "create" && <PerpCreateMarket />}
      </div>
    </LaunchpadLayout>
  );
}
