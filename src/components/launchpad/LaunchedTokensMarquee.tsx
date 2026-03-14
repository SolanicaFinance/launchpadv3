import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

interface MarqueeToken {
  id: string;
  name: string;
  ticker: string;
  image_url: string | null;
  market_cap_sol: number | null;
  mint_address: string | null;
}

export function LaunchedTokensMarquee() {
  const [tokens, setTokens] = useState<MarqueeToken[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("fun_tokens")
        .select("id, name, ticker, image_url, market_cap_sol, mint_address")
        .neq("launchpad_type", "punch")
        .order("created_at", { ascending: false })
        .limit(50);
      if (data) setTokens(data as MarqueeToken[]);
    };
    fetch();

    // Listen for new tokens
    const channel = supabase
      .channel("marquee-tokens")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "fun_tokens" }, () => fetch())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (tokens.length === 0) return null;

  const formatMcap = (sol: number | null) => {
    if (!sol || sol <= 0) return "";
    if (sol >= 1000) return `${(sol / 1000).toFixed(1)}K`;
    return `${sol.toFixed(1)}`;
  };

  // Duplicate for infinite scroll illusion
  const doubled = [...tokens, ...tokens];

  return (
    <div className="w-full overflow-hidden border-b border-border/50 bg-background/50 backdrop-blur-sm">
      <div className="marquee-track flex items-center gap-2 py-1.5 px-2">
        {doubled.map((t, i) => (
          <Link
            key={`${t.id}-${i}`}
            to={t.mint_address ? `/token/${t.mint_address}` : "#"}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/40 hover:bg-muted/70 border border-border/30 transition-colors shrink-0 group"
          >
            {t.image_url ? (
              <img src={t.image_url} alt={t.ticker} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[8px] font-bold text-primary">
                {t.ticker?.[0] || "?"}
              </div>
            )}
            <span className="text-[10px] font-semibold text-foreground/80 group-hover:text-foreground whitespace-nowrap">
              ${t.ticker}
            </span>
            {t.market_cap_sol != null && t.market_cap_sol > 0 && (
              <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">
                {formatMcap(t.market_cap_sol)}◎
              </span>
            )}
          </Link>
        ))}
      </div>

      <style>{`
        .marquee-track {
          animation: marquee-scroll 60s linear infinite;
          width: max-content;
        }
        .marquee-track:hover {
          animation-play-state: paused;
        }
        @keyframes marquee-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
