import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink } from "lucide-react";
import { BRAND } from "@/config/branding";

const CLAW_TOKEN = {
  name: "$CLAW",
  description: "The Saturn platform token. Earn fees from all agent-launched tokens.",
  mintAddress: "GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
  dexScreenerUrl: "https://dexscreener.com/solana/GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
  solscanUrl: "https://solscan.io/token/GfLD9EQn7A1UjopYVJ8aUUjHQhX14dwFf8oBWKW8pump",
};

export function AgentPlatformToken() {
  return (
    <Card className="gate-card bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
      <div className="gate-card-body">
        <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
          {/* Token Info */}
          <div className="flex items-center gap-4">
            <img
              src="/claw-logo.png"
              alt="CLAW"
              className="w-16 h-16 rounded-xl object-cover"
            />
          <div>
              <h3 className="text-xl font-bold text-foreground">{CLAW_TOKEN.name}</h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {CLAW_TOKEN.description}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 md:ml-auto">
            <a
              href={CLAW_TOKEN.dexScreenerUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                DexScreener
              </Button>
            </a>
            <a
              href={CLAW_TOKEN.solscanUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <ExternalLink className="h-4 w-4" />
                Solscan
              </Button>
            </a>
          </div>
        </div>
      </div>
    </Card>
  );
}
