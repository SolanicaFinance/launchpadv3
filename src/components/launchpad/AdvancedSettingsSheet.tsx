import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
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
        <button className="flex items-center justify-center h-12 w-12 rounded-2xl bg-secondary/80 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-95">
          <Settings2 className="h-5 w-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-3xl border-t border-border/40 bg-background px-5 pb-8 pt-4 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base font-mono font-bold tracking-wide text-center">
            Advanced Settings
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6">
          {/* Slippage */}
          <div className="space-y-3">
            <label className="text-sm font-mono font-semibold text-foreground/80 uppercase tracking-wider">
              Slippage Tolerance
            </label>
            <div className="flex flex-wrap gap-2">
              {SLIPPAGE_PRESETS.map((v) => (
                <button
                  key={v}
                  onClick={() => { onSlippageChange(v); setShowCustom(false); setCustomSlippage(""); }}
                  className={`h-12 min-w-[56px] px-4 rounded-2xl font-mono text-sm font-bold border transition-all active:scale-95 ${
                    slippage === v && !showCustom
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border/40 text-muted-foreground hover:border-border/60 bg-secondary/50"
                  }`}
                >
                  {v}%
                </button>
              ))}
            </div>
            <div className="relative">
              <Input
                type="number"
                placeholder="Custom %"
                value={customSlippage}
                onChange={(e) => handleCustom(e.target.value)}
                className={`h-12 text-base font-mono pr-10 rounded-2xl ${
                  customSlippage && !SLIPPAGE_PRESETS.includes(slippage)
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/40 bg-secondary/50"
                }`}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-mono">%</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between h-14 px-4 rounded-2xl bg-secondary/50 border border-border/30">
              <div className="flex items-center gap-3">
                <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-sm font-mono font-semibold">Jito MEV Protection</span>
              </div>
              <Switch checked={mevProtection} onCheckedChange={setMevProtection} className="data-[state=checked]:bg-green-500" />
            </div>

            <div className="flex items-center justify-between h-14 px-4 rounded-2xl bg-secondary/50 border border-border/30">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-primary/60" />
                <span className="text-sm font-mono font-semibold">Anti-Sandwich</span>
              </div>
              <Switch checked={antiSandwich} onCheckedChange={setAntiSandwich} className="data-[state=checked]:bg-primary" />
            </div>

            <div className="flex items-center justify-between h-14 px-4 rounded-2xl bg-secondary/50 border border-border/30">
              <span className={`text-sm font-mono font-bold ${isBuy ? "text-green-400" : "text-destructive"}`}>
                {isBuy ? "INSTA BUY" : "INSTA SELL"}
              </span>
              <Switch
                checked={instaBuy}
                onCheckedChange={onInstaBuyChange}
                className={isBuy ? "data-[state=checked]:bg-green-500" : "data-[state=checked]:bg-destructive"}
              />
            </div>
          </div>

          {/* Safety Checks */}
          {safetyChecks.length > 0 && (
            <div className="space-y-3">
              <label className="text-sm font-mono font-semibold text-foreground/80 uppercase tracking-wider">
                Safety Checks
              </label>
              <div className="grid grid-cols-3 gap-2">
                {safetyChecks.map((check) => (
                  <div key={check.label} className="flex flex-col items-center gap-2 py-3 rounded-2xl bg-secondary/50 border border-border/30">
                    {check.loading ? (
                      <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                    ) : check.passed === true ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : check.passed === false ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : (
                      <HelpCircle className="h-5 w-5 text-muted-foreground/50" />
                    )}
                    <span className="text-[11px] font-mono text-muted-foreground text-center leading-tight px-1">
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
              className="w-full h-14 rounded-2xl font-mono text-sm font-bold text-primary bg-primary/10 border border-primary/20 hover:bg-primary/15 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              🪐 Generate PNL Card
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
