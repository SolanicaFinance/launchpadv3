import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Wand2, Copy, Check, Loader2, RotateCcw } from "lucide-react";

export default function XPostRestylerPage() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRestyle = async () => {
    if (!input.trim()) {
      toast.error("Paste some text first");
      return;
    }

    setLoading(true);
    setOutput("");

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/x-post-restyle`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ text: input }),
        }
      );

      const data = await res.json();

      if (data.error) {
        toast.error(data.error);
      } else {
        setOutput(data.restyled);
      }
    } catch (err) {
      toast.error("Failed to restyle post");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!output) return;
    await navigator.clipboard.writeText(output);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const charCount = output.length;
  const isOverLimit = charCount > 280;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-5 w-5 text-primary" />
            X Post Restyler
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Paste your raw text below — Saturn's voice AI will restyle it to match
            the brand tone. Every output follows the same consistent style guide.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Raw Text
            </label>
            <Textarea
              placeholder="Paste your draft X post here..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={5}
              className="resize-none bg-secondary/30 border-border focus:border-primary"
            />
          </div>

          {/* Action */}
          <div className="flex gap-2">
            <Button
              onClick={handleRestyle}
              disabled={loading || !input.trim()}
              className="gap-2"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Wand2 className="h-4 w-4" />
              )}
              {loading ? "Restyling..." : "Restyle Post"}
            </Button>
            {output && (
              <Button
                variant="outline"
                onClick={handleRestyle}
                disabled={loading}
                className="gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Regenerate
              </Button>
            )}
          </div>

          {/* Output */}
          {output && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">
                  Restyled Output
                </label>
                <span
                  className={`text-xs font-mono ${
                    isOverLimit
                      ? "text-destructive"
                      : "text-muted-foreground"
                  }`}
                >
                  {charCount}/280
                </span>
              </div>
              <div className="relative group">
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {output}
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleCopy}
                  className="absolute top-2 right-2 gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              {isOverLimit && (
                <p className="text-xs text-destructive">
                  ⚠ Over 280 characters — consider trimming or splitting into a thread.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
