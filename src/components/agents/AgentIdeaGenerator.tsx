import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Sparkles, Download, RefreshCw, Copy, Check, Twitter, Lightbulb, Image } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import clawLogo from "@/assets/claw-logo.png";
import { BRAND } from "@/config/branding";

interface GeneratedMeme {
  imageUrl: string;
  name: string;
  ticker: string;
  description: string;
  tweetText: string;
}

export function AgentIdeaGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMeme, setGeneratedMeme] = useState<GeneratedMeme | null>(null);
  const [customPrompt, setCustomPrompt] = useState("");
  const [copied, setCopied] = useState(false);
  const bannerRef = useRef<HTMLDivElement>(null);

  const downloadBanner = useCallback(async () => {
    if (!bannerRef.current || !generatedMeme) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1500;
      canvas.height = 500;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Draw dark background matching the card
      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, 1500, 500);

      // Draw token name and ticker on the left
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 64px system-ui, sans-serif";
      ctx.fillText(generatedMeme.name, 80, 200);
      ctx.font = "bold 48px monospace";
      ctx.fillStyle = "#4ade80";
      ctx.fillText(`$${generatedMeme.ticker}`, 80, 270);
      ctx.font = "24px system-ui, sans-serif";
      ctx.fillStyle = "#a1a1aa";
      const descLines = generatedMeme.description.match(/.{1,50}/g) || [];
      descLines.slice(0, 3).forEach((line, i) => {
        ctx.fillText(line, 80, 320 + i * 32);
      });

      // Draw image on the right
      const img = new window.Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const size = 400;
        const x = 1500 - size - 60;
        const y = 50;
        // Rounded clip
        ctx.beginPath();
        ctx.roundRect(x, y, size, size, 24);
        ctx.clip();
        ctx.drawImage(img, x, y, size, size);
        
        // Download
        const link = document.createElement("a");
        link.download = `${generatedMeme.ticker}-x-banner.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast.success("X header banner downloaded!");
      };
      img.onerror = () => toast.error("Failed to load image for banner");
      img.src = generatedMeme.imageUrl;
    } catch {
      toast.error("Failed to generate banner");
    }
  }, [generatedMeme]);

  const generateMeme = async () => {
    setIsGenerating(true);
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
        tweetText: data.meme.tweetText,
      });

      toast.success("Meme generated successfully!");
    } catch (error: any) {
      console.error("Generation error:", error);
      toast.error(error.message || "Failed to generate meme");
    } finally {
      setIsGenerating(false);
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
      a.download = `${generatedMeme.ticker || "claw-meme"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success("Image downloaded!");
    } catch (error) {
      toast.error("Failed to download image");
    }
  };

  const copyTweetText = () => {
    if (!generatedMeme?.tweetText) return;
    navigator.clipboard.writeText(generatedMeme.tweetText);
    setCopied(true);
    toast.success("Tweet copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const openTwitter = () => {
    if (!generatedMeme?.tweetText) return;
    const tweetUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(generatedMeme.tweetText)}`;
    window.open(tweetUrl, "_blank");
  };

  return (
    <div className="py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-4">
            <img src={clawLogo} alt="MoonDexo" className="w-12 h-12 rounded-full" />
            <h2 className="text-2xl md:text-3xl font-bold text-foreground">
              Agent Idea Generator
            </h2>
          </div>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Generate viral Claw-themed meme concepts for your AI agent. 
            Each meme features our iconic lobster mascot with unique variations!
          </p>
        </div>

        {/* Input Section */}
        <Card className="p-6 mb-6 bg-card border-border">
          <div className="space-y-4">
            <div>
              <Label htmlFor="prompt" className="text-foreground mb-2 flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-primary" />
                Describe your meme idea (optional)
              </Label>
              <Textarea
                id="prompt"
                placeholder="e.g., 'Claw astronaut on the moon', 'Claw lobster at a pool party', 'cyberpunk Claw hacker'..."
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
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Generating Claw Meme...
                </>
              ) : (
                <>
                  <Sparkles className="h-5 w-5" />
                  Generate Meme Concept
                </>
              )}
            </Button>
          </div>
        </Card>

        {/* Generated Result */}
        {generatedMeme && (
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
                  {/* MoonDexo watermark */}
                  <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                    <img src={clawLogo} alt="" className="w-4 h-4 rounded-full" />
                    <span className="text-xs font-medium text-foreground">CLAW</span>
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

              {/* Token Details & Tweet */}
              <div className="space-y-4">
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Token Name</Label>
                  <Input
                    value={generatedMeme.name}
                    readOnly
                    className="mt-1 bg-muted border-border font-semibold text-lg"
                  />
                </div>
                
                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Ticker</Label>
                  <Input
                    value={`$${generatedMeme.ticker}`}
                    readOnly
                    className="mt-1 bg-muted border-border font-mono font-bold text-primary"
                  />
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide">Description</Label>
                  <Textarea
                    value={generatedMeme.description}
                    readOnly
                    className="mt-1 bg-muted border-border min-h-[60px]"
                  />
                </div>

                <div>
                  <Label className="text-muted-foreground text-xs uppercase tracking-wide flex items-center gap-2">
                    <Twitter className="h-3 w-3" />
                    Ready-to-Post Tweet
                  </Label>
                  <Textarea
                    value={generatedMeme.tweetText}
                    readOnly
                    className="mt-1 bg-muted border-border min-h-[100px] text-sm"
                  />
                </div>

                <div className="flex gap-2">
                  <Button
                    onClick={copyTweetText}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4 text-green-500" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        Copy Tweet
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={openTwitter}
                    className="flex-1 gap-2 bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
                  >
                    <Twitter className="h-4 w-4" />
                    Post to X
                  </Button>
                </div>
              </div>
            </div>

            {/* X Header Banner Preview */}
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Image className="h-4 w-4 text-primary" />
                X Header Banner Preview
              </h4>
              <div
                ref={bannerRef}
                className="relative w-full rounded-xl overflow-hidden border border-border"
                style={{ aspectRatio: "3/1", background: "#1a1a2e" }}
              >
                {/* Left side - text content */}
                <div className="absolute inset-0 flex items-center p-6 md:p-10">
                  <div className="flex-1 z-10">
                    <h3 className="text-xl md:text-3xl font-bold text-white mb-1">
                      {generatedMeme.name}
                    </h3>
                    <p className="text-lg md:text-2xl font-mono font-bold text-primary mb-2">
                      ${generatedMeme.ticker}
                    </p>
                    <p className="text-xs md:text-sm text-zinc-400 max-w-[50%] line-clamp-2">
                      {generatedMeme.description}
                    </p>
                  </div>
                </div>
                {/* Right side - image */}
                <div className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 w-[30%] max-w-[200px] aspect-square">
                  <img
                    src={generatedMeme.imageUrl}
                    alt={generatedMeme.name}
                    className="w-full h-full object-cover rounded-2xl shadow-2xl"
                  />
                </div>
              </div>
              <Button
                onClick={downloadBanner}
                variant="outline"
                className="mt-3 gap-2 w-full"
              >
                <Download className="h-4 w-4" />
                Download X Header Banner (1500×500)
              </Button>
            </div>

            {/* Launch Instructions */}
            <div className="mt-6 pt-6 border-t border-border">
              <h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Ready to Launch?
              </h4>
              <div className="bg-muted/50 rounded-lg p-4 text-sm">
                <p className="text-muted-foreground mb-2">
                  Post this on X with the command to launch:
                </p>
                <code className="block bg-background p-3 rounded text-xs font-mono text-foreground">
                  <span className="text-[#1DA1F2]">{BRAND.twitterHandle}</span> <span className="text-primary">!clawmode</span> {generatedMeme.name}<br/>
                  <span className="text-muted-foreground">+ optionally attach the downloaded image</span>
                </code>
              </div>
            </div>
          </Card>
        )}

        {/* Examples Grid */}
        {!generatedMeme && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
              Example Meme Concepts
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { prompt: "Claw astronaut", bg: "from-blue-500/20 to-purple-500/20" },
                { prompt: "Cyber Claw", bg: "from-pink-500/20 to-cyan-500/20" },
                { prompt: "King Claw", bg: "from-yellow-500/20 to-orange-500/20" },
                { prompt: "Ninja Claw", bg: "from-gray-500/20 to-red-500/20" },
              ].map((example) => (
                <button
                  key={example.prompt}
                  onClick={() => {
                    setCustomPrompt(example.prompt);
                    toast.info(`Prompt set: "${example.prompt}"`);
                  }}
                  className={`aspect-square rounded-xl bg-gradient-to-br ${example.bg} border border-border hover:border-primary/50 transition-all flex flex-col items-center justify-center gap-2 p-4`}
                >
                  <img src={clawLogo} alt="" className="w-12 h-12 rounded-full" />
                  <span className="text-sm font-medium text-foreground">{example.prompt}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
