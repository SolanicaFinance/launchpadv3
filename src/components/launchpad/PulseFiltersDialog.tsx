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
      <span className="text-[10px] font-mono text-foreground/60 w-20 shrink-0">{label}</span>
      <input
        type="number"
        placeholder="Min"
        value={min ?? ""}
        onChange={e => onMinChange(e.target.value ? Number(e.target.value) : undefined)}
        className="pulse-filter-input"
      />
      <span className="text-[9px] text-muted-foreground">—</span>
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
      <DialogContent className="max-w-md sm:max-w-lg p-0 gap-0 bg-background border-border">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-sm font-bold">Filters</DialogTitle>
        </DialogHeader>

        {/* Column tabs */}
        <div className="flex border-b border-border">
          {COLUMN_META.map(col => (
            <button
              key={col.id}
              onClick={() => onColumnChange(col.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[11px] font-semibold transition-colors border-b-2 ${
                activeColumn === col.id
                  ? "border-current text-foreground"
                  : "border-transparent text-muted-foreground/50 hover:text-foreground/70"
              }`}
              style={activeColumn === col.id ? { color: `hsl(${col.color})` } : undefined}
            >
              <col.icon className="h-3 w-3" />
              {col.label}
            </button>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex border-b border-border/50 px-2">
          {FILTER_TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider transition-colors border-b-2 ${
                tab === t
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground/50 hover:text-foreground/60"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="p-4 min-h-[240px] space-y-3">
          {tab === "Protocols" && (
            <div className="grid grid-cols-3 gap-2">
              {PROTOCOL_OPTIONS.map(p => (
                <button
                  key={p.value}
                  onClick={() => toggleProtocol(p.value)}
                  className={`px-3 py-2 rounded text-[10px] font-semibold border transition-all ${
                    f.protocols.includes(p.value)
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-foreground/30"
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
            <div className="space-y-3">
              {([
                ["hasTwitter", "Has Twitter / X"] as const,
                ["hasWebsite", "Has Website"] as const,
                ["hasTelegram", "Has Telegram"] as const,
              ]).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => toggleSocial(key)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 rounded border text-[11px] font-semibold transition-all ${
                    f[key]
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-muted/20 text-muted-foreground"
                  }`}
                >
                  <span>{label}</span>
                  <div className={`w-8 h-4 rounded-full transition-colors ${f[key] ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-3.5 h-3.5 rounded-full bg-background shadow transition-transform mt-[1px] ${f[key] ? "translate-x-[17px]" : "translate-x-[1px]"}`} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Bottom bar */}
        <div className="flex items-center justify-between p-3 border-t border-border">
          <button
            onClick={() => onReset(activeColumn)}
            className="text-[10px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-1.5 rounded bg-primary text-primary-foreground text-[11px] font-bold hover:bg-primary/90 transition-colors"
          >
            Apply All
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
