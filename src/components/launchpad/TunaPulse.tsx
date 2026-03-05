import { useState, useEffect, forwardRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatSolAmount, Token } from "@/hooks/useLaunchpad";
import { 
  Flame, 
  Rocket, 
  TrendingUp, 
  Clock, 
  Zap,
  ArrowUp,
  ArrowDown,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

type PulseFilter = 'new' | 'hot' | 'graduating' | 'volume';

export const ClawPulse = forwardRef<HTMLDivElement, Record<string, never>>(function ClawPulse(_props, ref) {
  const [filter, setFilter] = useState<PulseFilter>('hot');
  const queryClient = useQueryClient();

  // Calculate "hotness" score for trending algorithm
  const calculateHotScore = (token: Token) => {
    const now = Date.now();
    const createdAt = new Date(token.created_at).getTime();
    const ageHours = (now - createdAt) / (1000 * 60 * 60);
    
    // Volume score (primary factor)
    const volumeScore = Math.log10(token.volume_24h_sol + 1) * 30;
    
    // Recency bonus (newer tokens get a boost, decays over 24h)
    const recencyScore = Math.max(0, 20 - ageHours * 0.8);
    
    // Price momentum
    const priceChangeRaw = (token as any).price_change_24h || 0;
    const momentumScore = Math.min(20, Math.max(-10, priceChangeRaw * 0.5));
    
    // Holder count
    const holderScore = Math.log10(token.holder_count + 1) * 10;
    
    // Bonding progress bonus (calculate from real_sol_reserves for accuracy)
    const graduationThreshold = token.graduation_threshold_sol || 85;
    const actualProgress = token.real_sol_reserves > 0 
      ? (token.real_sol_reserves / graduationThreshold) * 100 
      : 0;
    const bondingBonus = token.status === 'bonding' ? actualProgress * 0.2 : 0;
    
    return volumeScore + recencyScore + momentumScore + holderScore + bondingBonus;
  };

  // Fetch tokens with different sorting based on filter
  // IMPORTANT: Only show tokens with real trading activity (volume > 0)
  const { data: rawTokens = [], isLoading } = useQuery({
    queryKey: ['pulse-tokens', filter],
    queryFn: async () => {
      let query = supabase
        .from('tokens')
        .select(`
          *,
          profiles:creator_id (
            display_name,
            username,
            avatar_url,
            verified_type
          )
        `)
        .eq('status', 'bonding')
        .gt('volume_24h_sol', 0); // Only show tokens with actual trading volume

      // For all filters, get enough tokens to sort client-side
      query = query.order('created_at', { ascending: false }).limit(50);

      const { data, error } = await query;
      if (error) throw error;
      return data as Token[];
    },
    refetchInterval: 10000,
  });

  // Sort tokens based on filter
  const tokens = useMemo(() => {
    let result = [...rawTokens];
    
    switch (filter) {
      case 'new':
        result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'hot':
        result.sort((a, b) => calculateHotScore(b) - calculateHotScore(a));
        break;
      case 'graduating':
        result = result
          .filter(t => {
            const threshold = t.graduation_threshold_sol || 85;
            const progress = t.real_sol_reserves > 0 ? (t.real_sol_reserves / threshold) * 100 : 0;
            return progress >= 50;
          })
          .sort((a, b) => {
            const thresholdA = a.graduation_threshold_sol || 85;
            const thresholdB = b.graduation_threshold_sol || 85;
            const progressA = a.real_sol_reserves > 0 ? (a.real_sol_reserves / thresholdA) * 100 : 0;
            const progressB = b.real_sol_reserves > 0 ? (b.real_sol_reserves / thresholdB) * 100 : 0;
            return progressB - progressA;
          });
        break;
      case 'volume':
        result.sort((a, b) => b.volume_24h_sol - a.volume_24h_sol);
        break;
    }
    
    return result.slice(0, 20);
  }, [rawTokens, filter]);

  // Subscribe to realtime token updates
  useEffect(() => {
    const channel = supabase
      .channel('claw-pulse-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tokens' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['pulse-tokens'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getFilterIcon = (f: PulseFilter) => {
    switch (f) {
      case 'new': return <Sparkles className="h-3.5 w-3.5" />;
      case 'hot': return <Flame className="h-3.5 w-3.5" />;
      case 'graduating': return <Rocket className="h-3.5 w-3.5" />;
      case 'volume': return <TrendingUp className="h-3.5 w-3.5" />;
    }
  };

  const getTimeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    return `${Math.floor(seconds / 86400)}d`;
  };

  return (
    <Card ref={ref} className="overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/10 to-transparent">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-primary/20 rounded-lg">
            <Zap className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Claw Pulse</h2>
            <p className="text-xs text-muted-foreground">Real-time token discovery</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="p-3 border-b border-border bg-secondary/30">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as PulseFilter)}>
          <TabsList className="w-full grid grid-cols-4 h-auto">
            <TabsTrigger value="new" className="gap-1.5 text-xs py-2">
              {getFilterIcon('new')}
              New
            </TabsTrigger>
            <TabsTrigger value="hot" className="gap-1.5 text-xs py-2">
              {getFilterIcon('hot')}
              Hot
            </TabsTrigger>
            <TabsTrigger value="graduating" className="gap-1.5 text-xs py-2">
              {getFilterIcon('graduating')}
              Graduating
            </TabsTrigger>
            <TabsTrigger value="volume" className="gap-1.5 text-xs py-2">
              {getFilterIcon('volume')}
              Volume
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Token List */}
      <div className="divide-y divide-border">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="p-3 animate-pulse">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-secondary rounded-lg" />
                <div className="flex-1 space-y-2">
                  <div className="w-24 h-4 bg-secondary rounded" />
                  <div className="w-16 h-3 bg-secondary rounded" />
                </div>
              </div>
            </div>
          ))
        ) : tokens.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <p>No tokens found</p>
          </div>
        ) : (
          tokens.map((token, index) => (
            <Link
              key={token.id}
              to={`/trade/${token.mint_address}`}
              className="flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors"
            >
              {/* Rank */}
              <span className="w-5 text-sm font-medium text-muted-foreground">
                {index + 1}
              </span>

              {/* Token Image */}
              <Avatar className="h-10 w-10 rounded-lg">
                <AvatarImage src={token.image_url || undefined} />
                <AvatarFallback className="rounded-lg text-xs font-bold bg-primary/10 text-primary">
                  {token.ticker.slice(0, 2)}
                </AvatarFallback>
              </Avatar>

              {/* Token Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{token.name}</span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    ${token.ticker}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {getTimeAgo(token.created_at)}
                  </span>
                  {filter === 'graduating' && (
                    <span className="text-primary font-medium">
                      {(() => {
                        const threshold = token.graduation_threshold_sol || 85;
                        const progress = token.real_sol_reserves > 0 ? (token.real_sol_reserves / threshold) * 100 : 0;
                        return `${progress.toFixed(0)}% bonded`;
                      })()}
                    </span>
                  )}
                </div>
              </div>

              {/* Stats */}
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <span className="font-semibold text-sm">
                    {formatSolAmount(token.price_sol || 0)}
                  </span>
                  <span className="text-xs text-muted-foreground">SOL</span>
                </div>
              <div className={cn(
                  "flex items-center gap-0.5 text-xs justify-end",
                  ((token as any).price_change_24h || 0) >= 0 ? "text-green-500" : "text-red-500"
                )}>
                  {((token as any).price_change_24h || 0) >= 0 ? (
                    <ArrowUp className="h-3 w-3" />
                  ) : (
                    <ArrowDown className="h-3 w-3" />
                  )}
                  {Math.abs((token as any).price_change_24h || 0).toFixed(1)}%
                </div>
              </div>
            </Link>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        <Link to="/launchpad">
          <Button variant="ghost" className="w-full text-sm">
            View All Tokens
          </Button>
        </Link>
      </div>
    </Card>
  );
});

ClawPulse.displayName = "ClawPulse";