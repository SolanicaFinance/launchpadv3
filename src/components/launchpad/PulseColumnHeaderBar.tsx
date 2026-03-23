import { memo, useState, useCallback, useEffect } from "react";
import { Zap, Menu, SlidersHorizontal } from "lucide-react";
import type { SupportedChain } from "@/contexts/ChainContext";

interface PulseColumnHeaderBarProps {
  label: string;
  color: string;
  icon: React.ElementType;
  columnId: string;
  quickBuyAmount: number;
  onQuickBuyChange: (amount: number) => void;
  onOpenFilters?: () => void;
  hasActiveFilters?: boolean;
  chain?: SupportedChain;
}

const WALLET_PRESETS = ["P1", "P2", "P3"] as const;
const PRESET_DEFAULTS_SOL: Record<string, number> = { P1: 0.5, P2: 1.0, P3: 2.0 };
const PRESET_DEFAULTS_BNB: Record<string, number> = { P1: 0.01, P2: 0.05, P3: 0.1 };

function getPresetStorageKey(columnId: string, preset: string, chain?: SupportedChain) {
  return `pulse-qb-${columnId}-${preset}${chain === "bnb" ? "-bnb" : ""}`;
}

function getActivePresetKey(columnId: string, chain?: SupportedChain) {
  return `pulse-active-preset-${columnId}${chain === "bnb" ? "-bnb" : ""}`;
}

function getPresetAmount(columnId: string, preset: string, chain?: SupportedChain): number {
  try {
    const v = localStorage.getItem(getPresetStorageKey(columnId, preset, chain));
    if (v) {
      const n = parseFloat(v);
      if (n > 0 && isFinite(n)) return n;
    }
  } catch {}
  const defaults = chain === "bnb" ? PRESET_DEFAULTS_BNB : PRESET_DEFAULTS_SOL;
  return defaults[preset] ?? defaults.P1;
}

function savePresetAmount(columnId: string, preset: string, amount: number, chain?: SupportedChain) {
  try { localStorage.setItem(getPresetStorageKey(columnId, preset, chain), String(amount)); } catch {}
}

function getActivePreset(columnId: string, chain?: SupportedChain): string {
  try { return localStorage.getItem(getActivePresetKey(columnId, chain)) || "P1"; } catch { return "P1"; }
}

function saveActivePreset(columnId: string, preset: string, chain?: SupportedChain) {
  try { localStorage.setItem(getActivePresetKey(columnId, chain), preset); } catch {}
}

export const PulseColumnHeaderBar = memo(function PulseColumnHeaderBar({
  label, color, icon: Icon, columnId, quickBuyAmount, onQuickBuyChange, onOpenFilters, hasActiveFilters, chain,
}: PulseColumnHeaderBarProps) {
  const [activePreset, setActivePreset] = useState(() => getActivePreset(columnId, chain));
  const [editingQb, setEditingQb] = useState(false);
  const [qbInput, setQbInput] = useState(String(quickBuyAmount));

  useEffect(() => {
    const preset = getActivePreset(columnId, chain);
    const stored = getPresetAmount(columnId, preset, chain);
    setActivePreset(preset);
    setQbInput(String(stored));
    if (stored !== quickBuyAmount) {
      onQuickBuyChange(stored);
    }
  }, [chain, columnId]);

  useEffect(() => {
    if (!editingQb) setQbInput(String(quickBuyAmount));
  }, [quickBuyAmount, editingQb]);

  const handlePresetSwitch = useCallback((preset: string) => {
    savePresetAmount(columnId, activePreset, quickBuyAmount, chain);
    const newAmount = getPresetAmount(columnId, preset, chain);
    setActivePreset(preset);
    saveActivePreset(columnId, preset, chain);
    setQbInput(String(newAmount));
    onQuickBuyChange(newAmount);
  }, [columnId, activePreset, quickBuyAmount, onQuickBuyChange, chain]);

  const handleQbSave = useCallback(() => {
    setEditingQb(false);
    const num = parseFloat(qbInput);
    if (num > 0 && isFinite(num)) {
      onQuickBuyChange(num);
      savePresetAmount(columnId, activePreset, num, chain);
    } else {
      setQbInput(String(quickBuyAmount));
    }
  }, [columnId, qbInput, quickBuyAmount, onQuickBuyChange, activePreset, chain]);

  return (
    <div className="pulse-axiom-header" style={{ "--col-accent": color } as React.CSSProperties}>
      {/* Quick Buy Amount */}
      <button
        className="pulse-axiom-qb"
        onClick={() => setEditingQb(!editingQb)}
      >
        <Zap className="h-3 w-3 text-warning" />
        {editingQb ? (
          <input
            autoFocus
            type="text"
            inputMode="decimal"
            value={qbInput}
            onChange={e => {
              if (e.target.value === "" || /^\d*\.?\d*$/.test(e.target.value)) {
                setQbInput(e.target.value);
              }
            }}
            onBlur={handleQbSave}
            onKeyDown={e => e.key === "Enter" && handleQbSave()}
            className="w-10 bg-transparent text-[11px] font-mono font-bold text-foreground outline-none"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-[11px] font-mono font-bold text-foreground">{quickBuyAmount}</span>
        )}
      </button>

      {/* Menu */}
      <button className="pulse-axiom-icon-btn">
        <Menu className="h-3 w-3" />
      </button>

      {/* Wallet Presets */}
      <div className="pulse-axiom-presets">
        {WALLET_PRESETS.map(p => (
          <button
            key={p}
            onClick={() => handlePresetSwitch(p)}
            className={`pulse-axiom-preset ${activePreset === p ? "active" : ""}`}
            style={activePreset === p ? { borderColor: `hsl(${color})`, color: `hsl(${color})` } : undefined}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Column Label */}
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <Icon className="h-3 w-3 flex-shrink-0" style={{ color: `hsl(${color})` }} />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground/80 truncate">{label}</span>
      </div>

      {/* Filter Button */}
      <button
        onClick={onOpenFilters}
        className={`pulse-axiom-icon-btn ${hasActiveFilters ? "pulse-axiom-filter-active" : ""}`}
      >
        <SlidersHorizontal className="h-3 w-3" />
      </button>

      {/* Accent line */}
      <div className="pulse-col-accent-line" style={{ background: `linear-gradient(90deg, hsl(${color} / 0.6), transparent)` }} />
    </div>
  );
});
