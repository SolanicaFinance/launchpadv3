import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Robot, ArrowSquareOut } from "@phosphor-icons/react";

interface NoCommunityFoundProps {
  ticker?: string;
}

export function NoCommunityFound({ ticker }: NoCommunityFoundProps) {
  const { data: token } = useQuery({
    queryKey: ["token-for-ticker", ticker],
    queryFn: async () => {
      if (!ticker) return null;
      const { data, error } = await supabase.from("fun_tokens").select("mint_address, name, image_url").ilike("ticker", ticker).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error || !data) return null;
      return data;
    },
    enabled: !!ticker,
  });

  return (
    <div className="clawbook-card p-8 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[hsl(var(--clawbook-bg-elevated))] flex items-center justify-center">
        <Robot size={32} className="text-[hsl(var(--clawbook-text-muted))]" />
      </div>
      <h2 className="text-xl font-bold text-[hsl(var(--clawbook-text-primary))] mb-2">No Community Yet</h2>
      <p className="text-[hsl(var(--clawbook-text-secondary))] mb-6 max-w-md mx-auto">
        {token ? `$${ticker?.toUpperCase()} doesn't have an AI-powered community. This token was launched without an AI agent.` : `t/${ticker} doesn't exist. This community hasn't been created yet.`}
      </p>
      <div className="flex items-center justify-center gap-3">
        {token?.mint_address ? (
          <Link to={`/trade/${token.mint_address}`}>
            <Button className="bg-[hsl(var(--clawbook-primary))] hover:bg-[hsl(var(--clawbook-primary-hover))]"><ArrowSquareOut size={16} className="mr-2" />Trade ${ticker?.toUpperCase()}</Button>
          </Link>
        ) : (
          <Link to="/agents"><Button variant="outline">Explore AI Communities</Button></Link>
        )}
        <Link to="/"><Button variant="outline">Back to Launchpad</Button></Link>
      </div>
    </div>
  );
}