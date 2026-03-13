import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Download, RefreshCw, Copy, Check, ExternalLink, Lightbulb, Briefcase } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import saturnLogo from "@/assets/saturn-logo.png";
import { LaunchpadLayout } from "@/components/layout/LaunchpadLayout";
import { BRAND } from "@/config/branding";

interface GeneratedMeme {
  imageUrl: string;
  name: string;
  ticker: string;
  description: string;
  twitter: string;
  website: string;
}

interface LaunchResult {
  mintAddress: string;
  signature: string;
  bagsUrl: string;
}

export default function BagsAgentsPage() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [generatedMeme, setGeneratedMeme] = useState<GeneratedMeme | null>(null);
  const [launchResult, setLaunchResult] = useState<LaunchResult | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const generateMeme = async () => {
    setIsGenerating(true);
    setLaunchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("agent-idea-generate", {
        body: { 
          prompt: customPrompt || undefined,
          includeClawLogo: true 
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to generate");

      setGeneratedMeme({
        imageUrl: data.meme.imageUrl,
        name: data.meme.name,
        ticker: data.meme.ticker,
        description: data.meme.description,
        twitter: "https://x.com/saturntrade",
        website: "",
      });

      toast.success("Meme generated successfully!");
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate meme");
    } finally {
      setIsGenerating(false);
    }
  };

  const launchOnBags = async () => {
    if (!generatedMeme) return;
    
    setIsLaunching(true);
    try {
      const { data, error } = await supabase.functions.invoke("bags-agent-launch", {
        body: {
          name: generatedMeme.name,
          ticker: generatedMeme.ticker,
          description: generatedMeme.description,
          imageUrl: generatedMeme.imageUrl,
          twitter: generatedMeme.twitter,
          website: generatedMeme.website,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Failed to launch on bags.fm");

      setLaunchResult({
        mintAddress: data.mintAddress,
        signature: data.signature,
        bagsUrl: `https://bags.fm/coin/${data.mintAddress}`,
      });

      toast.success("Token launched on bags.fm!");
    } catch (error: any) {
      console.error("Launch error:", error);
      toast.error(error.message || "Failed to launch on bags.fm");
    } finally {
      setIsLaunching(false);
    }
  };

  const downloadImage = async () => {
    if (!generatedMeme?.imageUrl) return;
    
    try {
      const response = await fetch(generatedMeme.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${generatedMeme.ticker || "bags-meme"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded!");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  const copyCA = () => {
    if (!launchResult?.mintAddress) return;
    navigator.clipboard.writeText(launchResult.mintAddress);
    setCopied(true);
    toast.success("Contract address copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <LaunchpadLayout showKingOfTheHill={false}>
      <div className="py-8 px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="relative">
                <img src={saturnLogo} alt={BRAND.name} className="w-12 h-12 rounded-full" />
                <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-1 border border-border">
                  <Briefcase className="w-4 h-4 text-blue-400" />
                </div>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-foreground">
                BAGS Agents
              </h2>
            </div>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Generate AI memes and launch them on <span className="text-blue-400 font-semibold">bags.fm</span> with one click!
              100% of fees go to the TUNA treasury.
            </p>
            <div className="mt-2 inline-flex items-center gap-2 bg-blue-500/10 text-blue-400 px-3 py-1.5 rounded-full text-sm">
              <Briefcase className="h-4 w-4" />
              <span>Platform Fee: 100%</span>
            </div>
          </div>

          {/* Success State */}
          {launchResult && (
            <Card className="p-6 mb-6 bg-blue-500/10 border-blue-500/50 animate-in fade-in">
              <div className="text-center space-y-4">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-500/20 mb-2">
                  <Briefcase className="w-10 h-10 text-blue-400" />
                </div>
                <h3 className="text-xl font-bold text-blue-400">Launched on bags.fm! 🎉</h3>
                
                <div className="bg-background/50 rounded-lg p-4">
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide">Contract Address</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="flex-1 text-sm font-mono text-foreground break-all">
                      {launchResult.mintAddress}
                    </code>
                    <Button
                      onClick={copyCA}
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                    >
                      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => window.open(launchResult.bagsUrl, "_blank")}
                    className="bg-blue-500 hover:bg-blue-600 text-white gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Trade on bags.fm
                  </Button>
                  <Button
                    onClick={() => window.open(`/t/${generatedMeme?.ticker}`, "_blank")}
                    variant="outline"
                    className="gap-2"
                  >
                    View Community
                  </Button>
                </div>

                <Button
                  onClick={() => {
                    setLaunchResult(null);
                    setGeneratedMeme(null);
                    setCustomPrompt("");
                  }}
                  variant="ghost"
                  className="text-muted-foreground"
                >
                  Launch Another Token
                </Button>
              </div>
            </Card>
          )}

          {/* Input Section */}
          {!launchResult && (
            <Card className="p-6 mb-6 bg-card border-border">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="prompt" className="text-foreground mb-2 flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-blue-400" />
                    Describe your meme idea (optional)
                  </Label>
                  <Textarea
                    id="prompt"
                    placeholder="e.g., 'TUNA astronaut on the moon', 'TUNA wearing sunglasses at a pool party'..."
                    value={customPrompt}
                    onChange={(e) => setCustomPrompt(e.target.value)}
                    className="min-h-[80px] bg-background border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Leave empty for a random creative concept
                  </p>
                </div>

                <Button
                  onClick={generateMeme}
                  disabled={isGenerating}
                  size="lg"
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white gap-2 font-semibold"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Generating Meme...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      Generate Meme
                    </>
                  )}
                </Button>
              </div>
            </Card>
          )}

          {/* Generated Result */}
          {generatedMeme && !launchResult && (
            <Card className="p-6 bg-card border-border animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Image Preview */}
                <div className="space-y-4">
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-muted border border-border">
                    <img
                      src={generatedMeme.imageUrl}
                      alt={generatedMeme.name}
                      className="w-full h-full object-cover"
                    />
                    {/* bags.fm watermark */}
                    <div className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1.5 border border-border">
                      <Briefcase className="w-4 h-4 text-blue-400" />
                      <span className="text-xs font-bold text-foreground">bags.fm</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button
                      onClick={downloadImage}
                      variant="outline"
                      className="flex-1 gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                    <Button
                      onClick={generateMeme}
                      variant="outline"
                      disabled={isGenerating}
                      className="flex-1 gap-2"
                    >
                      <RefreshCw className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
                      Regenerate
                    </Button>
                  </div>
                </div>

                {/* Token Details & Launch */}
                <div className="space-y-4">
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Token Name</Label>
                    <Input
                      value={generatedMeme.name}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, name: e.target.value })}
                      className="mt-1 bg-background border-border font-semibold text-lg"
                      placeholder="Token name"
                    />
                  </div>
                  
                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Ticker</Label>
                    <Input
                      value={generatedMeme.ticker}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, ticker: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })}
                      className="mt-1 bg-background border-border font-mono font-bold text-blue-400"
                      placeholder="TICKER"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Description</Label>
                    <Textarea
                      value={generatedMeme.description}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, description: e.target.value })}
                      className="mt-1 bg-background border-border min-h-[80px]"
                      placeholder="Token description"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">X (Twitter)</Label>
                    <Input
                      value={generatedMeme.twitter}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, twitter: e.target.value })}
                      className="mt-1 bg-background border-border"
                      placeholder="https://x.com/saturntrade"
                    />
                  </div>

                  <div>
                    <Label className="text-muted-foreground text-xs uppercase tracking-wide">Website</Label>
                    <Input
                      value={generatedMeme.website}
                      onChange={(e) => setGeneratedMeme({ ...generatedMeme, website: e.target.value })}
                      className="mt-1 bg-background border-border"
                      placeholder="Auto-set to SubTuna page after launch"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Leave empty to use the SubTuna community page
                    </p>
                  </div>

                  {/* Launch Button */}
                  <Button
                    onClick={launchOnBags}
                    disabled={isLaunching || !generatedMeme.name || !generatedMeme.ticker}
                    size="lg"
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white gap-2 font-bold text-lg h-14"
                  >
                    {isLaunching ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Launching on bags.fm...
                      </>
                    ) : (
                      <>
                        <Briefcase className="h-5 w-5" />
                        Launch on bags.fm
                      </>
                    )}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    bags.fm uses Meteora DBC • 100% platform fee • Initial 0.01 SOL dev buy included
                  </p>
                </div>
              </div>
            </Card>
          )}

          {/* Examples Grid */}
          {!generatedMeme && !launchResult && (
            <div className="mt-8">
              <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
                Example Meme Concepts
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { prompt: "TUNA astronaut", bg: "from-blue-500/20 to-cyan-500/20" },
                  { prompt: "Cyber TUNA", bg: "from-blue-500/20 to-purple-500/20" },
                  { prompt: "King TUNA", bg: "from-blue-500/20 to-yellow-500/20" },
                  { prompt: "Ninja TUNA", bg: "from-blue-500/20 to-red-500/20" },
                ].map((example) => (
                  <button
                    key={example.prompt}
                    onClick={() => {
                      setCustomPrompt(example.prompt);
                      toast.info(`Prompt set: "${example.prompt}"`);
                    }}
                    className={`aspect-square rounded-xl bg-gradient-to-br ${example.bg} border border-border hover:border-blue-500/50 transition-all flex flex-col items-center justify-center gap-2 p-4`}
                  >
                    <img src={saturnLogo} alt="" className="w-12 h-12 rounded-full" />
                    <span className="text-sm font-medium text-foreground">{example.prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </LaunchpadLayout>
  );
}
