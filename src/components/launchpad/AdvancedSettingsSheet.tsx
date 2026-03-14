import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Settings2, CheckCircle2, XCircle, HelpCircle, Loader2, Shield } from "lucide-react";

const SLIPPAGE_PRESETS = [0.5, 1, 2, 5, 10];

interface SafetyCheck {
  label: string;
  passed: boolean | null;
  loading: boolean;
}

interface AdvancedSettingsSheetProps {
  slippage: number;
  onSlippageChange: (v: number) => void;
  instaBuy: boolean;
  onInstaBuyChange: (v: boolean) => void;
  isBuy: boolean;
  safetyChecks?: SafetyCheck[];
  onGeneratePnl?: () => void;
}

export function AdvancedSettingsSheet({
  slippage,
  onSlippageChange,
  instaBuy,
  onInstaBuyChange,
  isBuy,
  safetyChecks = [],
  onGeneratePnl,
}: AdvancedSettingsSheetProps) {
  const [customSlippage, setCustomSlippage] = useState("");
  const [showCustom, setShowCustom] = useState(false);
  const [mevProtection, setMevProtection] = useState(true);
  const [antiSandwich, setAntiSandwich] = useState(true);

  const handleCustom = (val: string) => {
    setCustomSlippage(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num > 0 && num <= 50) onSlippageChange(num);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button className="flex items-center justify-center h-7 w-7 rounded-md bg-secondary/60 border border-border/30 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95">
          <Settings2 className="h-3.5 w-3.5" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-xl border-t border-border/40 bg-background px-4 pb-6 pt-3 max-h-[70vh] overflow-y-auto">
        <SheetHeader className="pb-3">
          <SheetTitle className="text-xs font-mono font-bold tracking-wide text-center">
            Advanced Settings
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Slippage */}
          <div className="space-y-2">
            <label className="text-[10px] font-mono font-semibold text-foreground/70 uppercase tracking-wider">
              Slippage Tolerance
            </label>
            <div className="flex flex-wrap gap-1.5">
              {SLIPPAGE_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => { onSlippageChange(v); setShowCustom(false); setCustomSlippage(""); }}
                  className={`h-8 min-w-[44px] px-3 rounded-md font-mono text-xs font-bold border transition-all active:scale-95 ${
                    slippage === v && !showCustom
                      ? "border-primary/50 bg-primary/12 text-primary"
                      : "border-border/30 text-muted-foreground hover:border-border/50 bg-secondary/40"
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="relative">
              <input
                type="number"
                placeholder="Custom %"
                value={customSlippage}
                onChange={(e) => handleCustom(e.target.value)}
                className={`w-full h-9 text-xs font-mono pl-3 pr-8 rounded-lg border focus:outline-none focus:ring-1 focus:ring-primary/40 transition-all ${
                  customSlippage && !SLIPPAGE_PRESETS.includes(slippage)
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border/30 bg-secondary/40 text-foreground placeholder:text-muted-foreground/40"
                }`}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground font-mono">%</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between h-10 px-3 rounded-lg bg-secondary/40 border border-border/20">
              <div className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-mono font-semibold">Jito MEV</span>
              </div>
              <Switch checked={mevProtection} onCheckedChange={setMevProtection} className="data-[state=checked]:bg-green-500 scale-90" />
            </div>

            <div className="flex items-center justify-between h-10 px-3 rounded-lg bg-secondary/40 border border-border/20">
              <div className="flex items-center gap-2">
                <Shield className="h-3 w-3 text-primary/60" />
                <span className="text-xs font-mono font-semibold">Anti-Sandwich</span>
              </div>
              <Switch checked={antiSandwich} onCheckedChange={setAntiSandwich} className="data-[state=checked]:bg-primary scale-90" />
            </div>

            <div className="flex items-center justify-between h-10 px-3 rounded-lg bg-secondary/40 border border-border/20">
              <span className={`text-xs font-mono font-bold ${isBuy ? "text-green-400" : "text-destructive"}`}>
                {isBuy ? "INSTA BUY" : "INSTA SELL"}
              </span>
              <Switch
                checked={instaBuy}
                onCheckedChange={onInstaBuyChange}
                className={`scale-90 ${isBuy ? "data-[state=checked]:bg-green-500" : "data-[state=checked]:bg-destructive"}`}
              />
            </div>
          </div>

          {/* Safety Checks */}
          {safetyChecks.length > 0 && (
            <div className="space-y-2">
              <label className="text-[10px] font-mono font-semibold text-foreground/70 uppercase tracking-wider">
                Safety Checks
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {safetyChecks.map((check) => (
                  <div key={check.label} className="flex flex-col items-center gap-1 py-2 rounded-lg bg-secondary/40 border border-border/20">
                    {check.loading ? (
                      <Loader2 className="h-3.5 w-3.5 text-muted-foreground animate-spin" />
                    ) : check.passed === true ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    ) : check.passed === false ? (
                      <XCircle className="h-3.5 w-3.5 text-destructive" />
                    ) : (
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50" />
                    )}
                    <span className="text-[9px] font-mono text-muted-foreground text-center leading-tight px-1">
                      {check.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* PNL Card */}
          {onGeneratePnl && (
            <button
              onClick={onGeneratePnl}
              className="w-full h-10 rounded-lg font-mono text-xs font-bold text-primary bg-primary/8 border border-primary/15 hover:bg-primary/12 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              🪐 Generate PNL Card
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
