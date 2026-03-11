import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Bot, Sparkles, Loader2, Rocket, Wand2 } from "lucide-react";
import { useSaturnAdminLaunch } from "@/hooks/useSaturnAdminLaunch";
import { useSaturnIdeaGenerate } from "@/hooks/useSaturnIdeaGenerate";
import { toast } from "@/hooks/use-toast";

type LaunchMode = "ai-generate" | "ai-trading" | "custom";

export function SaturnAdminLaunchPanel() {
  const [mode, setMode] = useState<LaunchMode>("ai-generate");
  const [customName, setCustomName] = useState("");
  const [customTicker, setCustomTicker] = useState("");
  const [customDescription, setCustomDescription] = useState("");
  const [customImageUrl, setCustomImageUrl] = useState("");
  const [strategy, setStrategy] = useState("balanced");

  const { launch, isLaunching } = useSaturnAdminLaunch();
  const { generate, isGenerating, idea, reset } = useSaturnIdeaGenerate();

  const handleAIGenerate = async () => {
    try {
      const generated = await generate();
      toast({ title: "🪐 Concept Generated!", description: `${generated.name} ($${generated.ticker})` });
    } catch {
      toast({ title: "Generation failed", variant: "destructive" });
    }
  };

  const handleLaunch = async () => {
    let params: any;

    if (mode === "ai-generate" && idea) {
      params = { name: idea.name, ticker: idea.ticker, description: idea.description, avatarUrl: idea.imageUrl, strategy };
    } else if (mode === "custom") {
      if (!customName || !customTicker) {
        toast({ title: "Name and ticker required", variant: "destructive" });
        return;
      }
      params = { name: customName, ticker: customTicker, description: customDescription, avatarUrl: customImageUrl, strategy };
    } else if (mode === "ai-trading") {
      // Will call claw-trading-generate first then launch
      try {
        const genResponse = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claw-trading-generate`,
          {
            method: "POST",
            headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({ strategy }),
          }
        );
        const genData = await genResponse.json();
        if (!genData.success) throw new Error(genData.error);
        params = { name: genData.name, ticker: genData.ticker, description: genData.description, avatarUrl: genData.avatarUrl, strategy };
      } catch (e) {
        toast({ title: "AI generation failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
        return;
      }
    }

    if (!params) return;

    try {
      const result = await launch(params);
      toast({ title: "🪐 Agent Launched!", description: `${result.tradingAgent.name} ($${result.tradingAgent.ticker}) - Bidding open for 6 hours!` });
      reset();
      setCustomName("");
      setCustomTicker("");
      setCustomDescription("");
      setCustomImageUrl("");
    } catch (e) {
      toast({ title: "Launch failed", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
    }
  };

  const modes = [
    { id: "ai-generate" as const, label: "🪐 AI Idea", icon: Sparkles },
    { id: "ai-trading" as const, label: "🤖 AI Agent", icon: Bot },
    { id: "custom" as const, label: "✏️ Custom", icon: Wand2 },
  ];

  return (
    <Card className="border-2" style={{ borderColor: "hsl(var(--saturn-primary) / 0.5)", background: "hsl(var(--saturn-surface))" }}>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Rocket className="h-5 w-5" style={{ color: "hsl(var(--saturn-primary))" }} />
          <h3 className="font-black text-sm uppercase tracking-wider" style={{ color: "hsl(var(--saturn-text))" }}>
            🪐 Admin Launch Panel
          </h3>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          {modes.map((m) => {
            const Icon = m.icon;
            return (
              <button
                key={m.id}
                onClick={() => { setMode(m.id); reset(); }}
                className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all`}
                style={{
                  background: mode === m.id ? "hsl(var(--saturn-primary) / 0.15)" : "hsl(var(--saturn-bg))",
                  color: mode === m.id ? "hsl(var(--saturn-primary))" : "hsl(var(--saturn-muted))",
                  border: `1px solid ${mode === m.id ? "hsl(var(--saturn-primary))" : "hsl(var(--saturn-border))"}`,
                }}
              >
                <Icon className="h-3 w-3 inline mr-1" />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Strategy selector */}
        <div className="mb-4">
          <label className="text-xs font-medium mb-1 block" style={{ color: "hsl(var(--saturn-muted))" }}>Strategy</label>
          <div className="flex gap-2">
            {["conservative", "balanced", "aggressive"].map((s) => (
              <button
                key={s}
                onClick={() => setStrategy(s)}
                className="flex-1 py-1.5 px-2 rounded text-xs font-medium capitalize transition-all"
                style={{
                  background: strategy === s ? "hsl(var(--saturn-primary) / 0.15)" : "transparent",
                  color: strategy === s ? "hsl(var(--saturn-primary))" : "hsl(var(--saturn-muted))",
                  border: `1px solid ${strategy === s ? "hsl(var(--saturn-primary) / 0.3)" : "hsl(var(--saturn-border))"}`,
                }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* AI Generate mode */}
        {mode === "ai-generate" && (
          <div className="space-y-3">
            <button
              onClick={handleAIGenerate}
              disabled={isGenerating}
              className="w-full py-2.5 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: "linear-gradient(135deg, hsl(var(--saturn-primary)), hsl(var(--saturn-accent)))", color: "hsl(var(--saturn-bg))" }}
            >
              {isGenerating ? <><Loader2 className="h-4 w-4 inline mr-2 animate-spin" />Generating...</> : <><Sparkles className="h-4 w-4 inline mr-2" />Generate Agent Idea 🪐</>}
            </button>

            {idea && (
              <div className="p-3 rounded-lg space-y-2" style={{ background: "hsl(var(--saturn-bg))", border: "1px solid hsl(var(--saturn-primary) / 0.3)" }}>
                <div className="flex items-center gap-3">
                  {idea.imageUrl && <img src={idea.imageUrl} alt={idea.name} className="w-12 h-12 rounded-lg" />}
                  <div>
                    <div className="font-bold text-sm" style={{ color: "hsl(var(--saturn-text))" }}>{idea.name}</div>
                    <div className="text-xs" style={{ color: "hsl(var(--saturn-primary))" }}>${idea.ticker}</div>
                  </div>
                </div>
                <p className="text-xs" style={{ color: "hsl(var(--saturn-muted))" }}>{idea.description}</p>
              </div>
            )}
          </div>
        )}

        {/* Custom mode */}
        {mode === "custom" && (
          <div className="space-y-3">
            <Input placeholder="Token name" value={customName} onChange={(e) => setCustomName(e.target.value)} className="h-8 text-sm" style={{ background: "hsl(var(--saturn-bg))", borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-text))" }} />
            <Input placeholder="Ticker (e.g. CLAW)" value={customTicker} onChange={(e) => setCustomTicker(e.target.value.toUpperCase())} className="h-8 text-sm" style={{ background: "hsl(var(--saturn-bg))", borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-text))" }} />
            <Textarea placeholder="Description" value={customDescription} onChange={(e) => setCustomDescription(e.target.value)} className="text-sm min-h-[60px]" style={{ background: "hsl(var(--saturn-bg))", borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-text))" }} />
            <Input placeholder="Image URL (optional)" value={customImageUrl} onChange={(e) => setCustomImageUrl(e.target.value)} className="h-8 text-sm" style={{ background: "hsl(var(--saturn-bg))", borderColor: "hsl(var(--saturn-border))", color: "hsl(var(--saturn-text))" }} />
          </div>
        )}

        {/* AI Trading mode */}
        {mode === "ai-trading" && (
          <div className="p-3 rounded-lg text-center" style={{ background: "hsl(var(--saturn-bg))", border: "1px solid hsl(var(--saturn-border))" }}>
            <Bot className="h-8 w-8 mx-auto mb-2" style={{ color: "hsl(var(--saturn-primary))" }} />
            <p className="text-xs" style={{ color: "hsl(var(--saturn-muted))" }}>
              AI will generate a complete trading agent identity with name, ticker, personality, and avatar. 🪐
            </p>
          </div>
        )}

        {/* Launch button */}
        <button
          onClick={handleLaunch}
          disabled={isLaunching || (mode === "ai-generate" && !idea) || (mode === "custom" && (!customName || !customTicker))}
          className="w-full mt-4 py-2.5 rounded-lg text-sm font-black uppercase tracking-wider transition-all disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, hsl(var(--saturn-primary)), hsl(var(--saturn-accent)))", color: "hsl(var(--saturn-bg))" }}
        >
          {isLaunching ? <><Loader2 className="h-4 w-4 inline mr-2 animate-spin" />Launching...</> : <><Rocket className="h-4 w-4 inline mr-2" />Launch Agent 🪐</>}
        </button>

        <p className="text-[10px] text-center mt-2" style={{ color: "hsl(var(--saturn-muted))" }}>
          6-hour bidding window starts immediately after launch
        </p>
      </CardContent>
    </Card>
  );
}
