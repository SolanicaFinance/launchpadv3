import { useState, useRef, useEffect } from "react";
import { useMultiWallet } from "@/hooks/useMultiWallet";
import { ChevronDown, Wallet } from "lucide-react";

function shortenAddr(a: string) {
  return `${a.slice(0, 4)}...${a.slice(-4)}`;
}

export default function ActiveWalletSelector() {
  const { managedWallets, activeWallet, switchWallet, walletCount } = useMultiWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (walletCount <= 1 || !activeWallet) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono transition-colors"
        style={{
          background: "rgba(249,115,22,0.06)",
          border: "1px solid rgba(249,115,22,0.15)",
          color: "hsl(var(--foreground))",
        }}
      >
        <Wallet className="h-3 w-3 text-[#F97316]" />
        <span className="font-semibold">{activeWallet.label}</span>
        <span className="text-muted-foreground">{shortenAddr(activeWallet.address)}</span>
        {activeWallet.balance !== null && (
          <span className="text-[#10B981] font-bold">{activeWallet.balance.toFixed(3)}</span>
        )}
        <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-1 w-64 rounded-xl py-1 z-50 shadow-xl"
          style={{ background: "hsl(215 25% 10%)", border: "1px solid rgba(51,65,85,0.4)" }}
        >
          {managedWallets.map((w) => (
            <button
              key={w.address}
              onClick={() => { switchWallet(w.address); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 transition-colors"
            >
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: w.address === activeWallet.address ? "#F97316" : "rgba(100,116,139,0.3)" }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold text-foreground truncate">{w.label}</div>
                <div className="text-[9px] font-mono text-muted-foreground">{shortenAddr(w.address)}</div>
              </div>
              <span className="text-[10px] font-mono text-foreground shrink-0">
                {w.balance !== null ? `${w.balance.toFixed(3)}` : "—"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
