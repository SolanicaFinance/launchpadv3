import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PulseFilterConfig, ColumnId } from "@/hooks/usePulseFilters";
import { Rocket, Flame, CheckCircle2 } from "lucide-react";

const COLUMN_META = [
  { id: "new" as ColumnId, label: "New Pairs", icon: Rocket, color: "160 84% 39%" },
  { id: "final" as ColumnId, label: "Final Stretch", icon: Flame, color: "38 92% 50%" },
  { id: "migrated" as ColumnId, label: "Migrated", icon: CheckCircle2, color: "220 90% 56%" },
];

const PROTOCOL_OPTIONS = [
  { value: "pump", label: "Pump" },
  { value: "dbc", label: "Dynamic BC" },
  { value: "Meteora AMM", label: "Meteora AMM" },
  { value: "Raydium", label: "Raydium" },
  { value: "Orca", label: "Orca" },
  { value: "Moonshot", label: "Moonshot" },
];

const FILTER_TABS = ["Protocols", "Audit", "$ Metrics", "Socials"] as const;
type FilterTab = typeof FILTER_TABS[number];

interface PulseFiltersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  filters: Record<ColumnId, PulseFilterConfig>;
  activeColumn: ColumnId;
  onColumnChange: (col: ColumnId) => void;
  onUpdate: (column: ColumnId, partial: Partial<PulseFilterConfig>) => void;
  onReset: (column: ColumnId) => void;
}

function RangeRow({ label, min, max, onMinChange, onMaxChange, placeholder }: {
  label: string; min?: number; max?: number;
  onMinChange: (v: number | undefined) => void;
  onMaxChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] font-mono text-foreground/50 w-24 shrink-0 uppercase tracking-wider">{label}</span>
      <input
        type="number"
        placeholder="Min"
        value={min ?? ""}
        onChange={e => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
        className="pulse-filter-input"
      />
      <span className="text-[9px] text-muted-foreground/30">—</span>
      <input
        type="number"
        placeholder={placeholder ?? "Max"}
        value={max ?? ""}
        onChange={e => onMaxChange(e.target.value ? Number(e.target.value) : undefined)}
        className="pulse-filter-input"
      />
    </div>
  );
}

export function PulseFiltersDialog({ open, onOpenChange, filters, activeColumn, onColumnChange, onUpdate, onReset }: PulseFiltersDialogProps) {
  const [tab, setTab] = useState<FilterTab>("Protocols");
  const f = filters[activeColumn];

  const toggleProtocol = (p: string) => {
    const current = f.protocols;
    const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
    onUpdate(activeColumn, { protocols: next });
  };

  const toggleSocial = (key: "hasTwitter" | "hasWebsite" | "hasTelegram") => {
    onUpdate(activeColumn, { [key]: !f[key] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md p-0 gap-0 border-border/50 sm:w-full max-h-[85vh] overflow-y-auto rounded-xl pulse-filters-dialog">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="text-xs font-bold uppercase tracking-wider text-foreground/70">Filters</DialogTitle>
        </DialogHeader>

        {/* Column tabs */}
        <div className="flex border-b border-border/40">
          {COLUMN_META.map(col => (
            <button
              key={col.id}
              onClick={() => onColumnChange(col.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors border-b-2 ${
                activeColumn === col.id
                  ? "border-current text-foreground"
                  : "border-transparent text-muted-foreground/40 hover:text-foreground/60"
              }`}
              style={activeColumn === col.id ? { color: `hsl(${col.color})` } : undefined}
            >
              <col.icon className="h-3 w-3" />
              {col.label}
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border/30 px-1">
          {FILTER_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[9px] font-bold uppercase tracking-widest transition-colors border-b-2 ${
                tab === t
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground/40 hover:text-foreground/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 min-h-[200px] space-y-3">
          {tab === "Protocols" && (
            <div className="grid grid-cols-3 gap-1.5">
              {PROTOCOL_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => toggleProtocol(p.value)}
                  className={`px-2.5 py-2 rounded text-[10px] font-bold border transition-all ${
                    f.protocols.includes(p.value)
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-border/40 bg-muted/20 text-muted-foreground/60 hover:border-foreground/20 hover:text-foreground/70"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {tab === "Audit" && (
            <div className="space-y-2.5">
              <RangeRow label="Holders" min={f.holdersMin} max={f.holdersMax}
                onMinChange={v => onUpdate(activeColumn, { holdersMin: v })}
                onMaxChange={v => onUpdate(activeColumn, { holdersMax: v })}
              />
              <RangeRow label="Dev Hold %" min={undefined} max={f.devHoldingMax}
                onMinChange={() => {}}
                onMaxChange={v => onUpdate(activeColumn, { devHoldingMax: v })}
                placeholder="0"
              />
              <RangeRow label="Age" min={f.ageMin} max={f.ageMax}
                onMinChange={v => onUpdate(activeColumn, { ageMin: v })}
                onMaxChange={v => onUpdate(activeColumn, { ageMax: v })}
              />
            </div>
          )}

          {tab === "$ Metrics" && (
            <div className="space-y-2.5">
              <RangeRow label="Liquidity $" min={f.liquidityMin} max={f.liquidityMax}
                onMinChange={v => onUpdate(activeColumn, { liquidityMin: v })}
                onMaxChange={v => onUpdate(activeColumn, { liquidityMax: v })}
              />
              <RangeRow label="Volume $" min={f.volumeMin} max={f.volumeMax}
                onMinChange={v => onUpdate(activeColumn, { volumeMin: v })}
                onMaxChange={v => onUpdate(activeColumn, { volumeMax: v })}
              />
              <RangeRow label="Market Cap $" min={f.mcapMin} max={f.mcapMax}
                onMinChange={v => onUpdate(activeColumn, { mcapMin: v })}
                onMaxChange={v => onUpdate(activeColumn, { mcapMax: v })}
              />
              <RangeRow label="B. Curve %" min={f.bondCurveMin} max={f.bondCurveMax}
                onMinChange={v => onUpdate(activeColumn, { bondCurveMin: v })}
                onMaxChange={v => onUpdate(activeColumn, { bondCurveMax: v })}
              />
            </div>
          )}

          {tab === "Socials" && (
            <div className="space-y-2">
              {([
                ["hasTwitter", "Has Twitter / X"] as const,
                ["hasWebsite", "Has Website"] as const,
                ["hasTelegram", "Has Telegram"] as const,
              ]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleSocial(key)}
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded border text-[10px] font-bold transition-all ${
                    f[key]
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border/30 bg-muted/15 text-muted-foreground/50"
                  }`}
                >
                  <span>{label}</span>
                  <div className={`w-7 h-3.5 rounded-full transition-colors ${f[key] ? "bg-accent" : "bg-muted/50"}`}>
                    <div className={`w-3 h-3 rounded-full bg-background shadow transition-transform mt-[1px] ${f[key] ? "translate-x-[15px]" : "translate-x-[1px]"}`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between p-3 border-t border-border/30">
          <button
            onClick={() => onReset(activeColumn)}
            className="text-[10px] font-bold text-muted-foreground/50 hover:text-foreground transition-colors uppercase tracking-wider"
          >
            Reset
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-5 py-1.5 rounded bg-accent text-accent-foreground text-[10px] font-black uppercase tracking-wider hover:bg-accent/90 transition-colors"
          >
            Apply
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
