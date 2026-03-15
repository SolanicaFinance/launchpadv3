import { useState } from "react";
import { useCodexTokenEvents } from "@/hooks/useCodexTokenEvents";
import { useAllTokenTrades } from "@/hooks/useAllTokenTrades";
import { useTokenHolders } from "@/hooks/useTokenHolders";
import { CodexTokenTrades } from "./CodexTokenTrades";
import { HoldersTable } from "./HoldersTable";

interface Props {
  tokenAddress: string;
  holderCount?: number;
  userWallet?: string;
  userWallets?: string[];
  currentPriceUsd?: number;
  isBsc?: boolean;
}

type TabKey = "all_trades" | "your_trades" | "holders";

export function TokenDataTabs({ tokenAddress, holderCount = 0, userWallet, userWallets, currentPriceUsd = 0, isBsc = false }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("all_trades");
  const { data, isLoading } = useCodexTokenEvents(tokenAddress);
  const isHoldersTab = activeTab === "holders";
  const { data: allTradesData, isLoading: allTradesLoading } = useAllTokenTrades(tokenAddress, isHoldersTab);
  const { data: holdersData, isLoading: holdersLoading } = useTokenHolders(tokenAddress, !isBsc);

  const liveHolderCount = holdersData?.count ?? holderCount;

  const allUserAddresses = new Set<string>();
  if (userWallet) allUserAddresses.add(userWallet.toLowerCase());
  if (userWallets) userWallets.forEach(w => allUserAddresses.add(w.toLowerCase()));

  const userTrades = allUserAddresses.size > 0
    ? (data?.events || []).filter(e => allUserAddresses.has(e.maker.toLowerCase()))
    : [];

  const tabs: { key: TabKey; label: string; count?: number }[] = [
    { key: "all_trades", label: "ALL TRADES", count: data?.events?.length },
    { key: "your_trades", label: "YOUR TRADES", count: userTrades.length },
    { key: "holders", label: "HOLDERS", count: liveHolderCount },
  ];

  return (
    <div className="rounded-xl overflow-hidden min-w-0 border border-white/[0.06]" style={{ backgroundColor: 'hsl(225 15% 7%)' }}>
      {/* Tab bar — cleaner, more visible */}
      <div className="flex items-center gap-0 border-b border-white/[0.05] px-2 overflow-x-auto scrollbar-none w-full min-w-0">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 sm:px-5 py-3.5 text-[11px] sm:text-[12px] font-mono font-bold uppercase tracking-wider transition-colors relative whitespace-nowrap shrink-0 ${
              activeTab === tab.key
                ? "text-foreground/90"
                : "text-muted-foreground/35 hover:text-muted-foreground/55"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1.5 text-[10px] text-muted-foreground/30">({tab.count})</span>
            )}
            {activeTab === tab.key && (
              <span className="absolute bottom-0 left-4 right-4 h-[2px] rounded-full bg-primary/80" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "all_trades" && (
          <CodexTokenTrades events={data?.events || []} isLoading={isLoading} holders={holdersData?.holders || []} currentPriceUsd={currentPriceUsd} isBsc={isBsc} />
        )}
        {activeTab === "your_trades" && (
          <CodexTokenTrades events={userTrades} isLoading={isLoading} holders={holdersData?.holders || []} currentPriceUsd={currentPriceUsd} isBsc={isBsc} />
        )}
        {activeTab === "holders" && (
          <HoldersTable
            holders={holdersData?.holders || []}
            totalCount={liveHolderCount}
            isLoading={holdersLoading || allTradesLoading}
            trades={allTradesData ?? []}
            currentPriceUsd={currentPriceUsd}
            isBsc={isBsc}
          />
        )}
      </div>
    </div>
  );
}