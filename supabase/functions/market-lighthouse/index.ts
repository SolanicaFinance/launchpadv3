import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedData: any = null;
let cachedAt = 0;
const CACHE_TTL = 3 * 60 * 1000; // 3 minutes

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

// DeFi Llama: Solana DEX volumes (free, no key needed)
async function fetchDefiLlamaDexVolumes() {
  try {
    const res = await fetchWithTimeout("https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true");
    if (!res.ok) return null;
    const data = await res.json();
    
    // data.totalDataChart not needed, we want protocol breakdown
    const total24h = data.total24h || 0;
    const total48hto24h = data.total48hto24h || 0;
    const change24h = total48hto24h > 0 ? ((total24h - total48hto24h) / total48hto24h) * 100 : 0;
    
    // Per-protocol volumes
    const protocols: Array<{ name: string; vol24h: number; change: number }> = [];
    if (data.protocols && Array.isArray(data.protocols)) {
      for (const p of data.protocols) {
        if (p.total24h && p.total24h > 0) {
          const pChange = p.total48hto24h > 0
            ? ((p.total24h - p.total48hto24h) / p.total48hto24h) * 100
            : 0;
          protocols.push({
            name: p.name || p.displayName || "Unknown",
            vol24h: p.total24h,
            change: pChange,
          });
        }
      }
    }
    // Sort by volume descending
    protocols.sort((a, b) => b.vol24h - a.vol24h);
    
    return { total24h, change24h, protocols: protocols.slice(0, 6) };
  } catch (_) {
    return null;
  }
}

// DeFi Llama: Solana chain overview for TVL/general stats
async function fetchDefiLlamaChainStats() {
  try {
    const res = await fetchWithTimeout("https://api.llama.fi/v2/historicalChainTvl/Solana");
    if (!res.ok) return null;
    const data = await res.json();
    // Get latest TVL
    if (Array.isArray(data) && data.length > 0) {
      const latest = data[data.length - 1];
      const prev = data.length > 1 ? data[data.length - 2] : latest;
      return {
        tvl: latest.tvl || 0,
        tvlChange: prev.tvl > 0 ? ((latest.tvl - prev.tvl) / prev.tvl) * 100 : 0,
      };
    }
    return null;
  } catch (_) {
    return null;
  }
}

// Our own DB stats: token creation count, graduated (migrations), trade stats
async function fetchOwnDbStats() {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Total tokens created (all time)
    const { count: totalTokens } = await supabase
      .from("fun_tokens")
      .select("*", { count: "exact", head: true });

    // Tokens created in last 24h
    const now = new Date();
    const h24ago = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const h48ago = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

    const { count: created24h } = await supabase
      .from("fun_tokens")
      .select("*", { count: "exact", head: true })
      .gte("created_at", h24ago);

    const { count: created48hTo24h } = await supabase
      .from("fun_tokens")
      .select("*", { count: "exact", head: true })
      .gte("created_at", h48ago)
      .lt("created_at", h24ago);

    // Graduated tokens (migrations)
    const { count: totalGraduated } = await supabase
      .from("fun_tokens")
      .select("*", { count: "exact", head: true })
      .eq("status", "graduated");

    const { count: graduated24h } = await supabase
      .from("fun_tokens")
      .select("*", { count: "exact", head: true })
      .eq("status", "graduated")
      .gte("created_at", h24ago);

    const { count: graduated48hTo24h } = await supabase
      .from("fun_tokens")
      .select("*", { count: "exact", head: true })
      .eq("status", "graduated")
      .gte("created_at", h48ago)
      .lt("created_at", h24ago);

    // Transaction stats from launchpad_transactions
    const { count: trades24h } = await supabase
      .from("launchpad_transactions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", h24ago);

    const { count: trades48hTo24h } = await supabase
      .from("launchpad_transactions")
      .select("*", { count: "exact", head: true })
      .gte("created_at", h48ago)
      .lt("created_at", h24ago);

    // Unique traders in 24h
    const { data: tradersData } = await supabase
      .from("launchpad_transactions")
      .select("user_wallet")
      .gte("created_at", h24ago);
    const uniqueTraders24h = new Set(tradersData?.map((t: any) => t.user_wallet) || []).size;

    const { data: tradersDataPrev } = await supabase
      .from("launchpad_transactions")
      .select("user_wallet")
      .gte("created_at", h48ago)
      .lt("created_at", h24ago);
    const uniqueTradersPrev = new Set(tradersDataPrev?.map((t: any) => t.user_wallet) || []).size;

    // Buy vs sell volume
    const { data: buyTrades } = await supabase
      .from("launchpad_transactions")
      .select("sol_amount")
      .eq("transaction_type", "buy")
      .gte("created_at", h24ago);
    const buyVolSol = (buyTrades || []).reduce((s: number, t: any) => s + (Number(t.sol_amount) || 0), 0);
    const buyCount = (buyTrades || []).length;

    const { data: sellTrades } = await supabase
      .from("launchpad_transactions")
      .select("sol_amount")
      .eq("transaction_type", "sell")
      .gte("created_at", h24ago);
    const sellVolSol = (sellTrades || []).reduce((s: number, t: any) => s + (Number(t.sol_amount) || 0), 0);
    const sellCount = (sellTrades || []).length;

    // Launchpad type breakdown for volumes
    const { data: lpVolumes } = await supabase
      .from("fun_tokens")
      .select("launchpad_type, volume_24h_sol")
      .not("launchpad_type", "is", null);
    
    const lpVolumeMap: Record<string, number> = {};
    for (const t of (lpVolumes || [])) {
      const lp = t.launchpad_type || "unknown";
      lpVolumeMap[lp] = (lpVolumeMap[lp] || 0) + (Number(t.volume_24h_sol) || 0);
    }

    const createdChange = (created48hTo24h || 0) > 0
      ? (((created24h || 0) - (created48hTo24h || 0)) / (created48hTo24h || 1)) * 100
      : 0;
    const graduatedChange = (graduated48hTo24h || 0) > 0
      ? (((graduated24h || 0) - (graduated48hTo24h || 0)) / (graduated48hTo24h || 1)) * 100
      : 0;
    const tradesChange = (trades48hTo24h || 0) > 0
      ? (((trades24h || 0) - (trades48hTo24h || 0)) / (trades48hTo24h || 1)) * 100
      : 0;
    const tradersChange = uniqueTradersPrev > 0
      ? ((uniqueTraders24h - uniqueTradersPrev) / uniqueTradersPrev) * 100
      : 0;

    return {
      totalTokens: totalTokens || 0,
      created24h: created24h || 0,
      createdChange,
      totalGraduated: totalGraduated || 0,
      graduated24h: graduated24h || 0,
      graduatedChange,
      trades24h: trades24h || 0,
      tradesChange,
      uniqueTraders24h,
      tradersChange,
      buyVolSol,
      buyCount,
      sellVolSol,
      sellCount,
      totalVolSol: buyVolSol + sellVolSol,
      lpVolumeMap,
    };
  } catch (e) {
    console.error("DB stats error:", e);
    return null;
  }
}

// SOL price from CoinGecko (free)
async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetchWithTimeout("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    if (res.ok) {
      const data = await res.json();
      return data?.solana?.usd || 0;
    }
  } catch (_) {}
  return 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (cachedData && Date.now() - cachedAt < CACHE_TTL) {
      return new Response(JSON.stringify(cachedData), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [dexVolumes, dbStats, solPrice] = await Promise.all([
      fetchDefiLlamaDexVolumes(),
      fetchOwnDbStats(),
      fetchSolPrice(),
    ]);

    const totalVolUsd = dexVolumes?.total24h || 0;
    const volChange = dexVolumes?.change24h || 0;

    // Our own volume in USD
    const ownVolUsd = (dbStats?.totalVolSol || 0) * solPrice;
    const buyVolUsd = (dbStats?.buyVolSol || 0) * solPrice;
    const sellVolUsd = (dbStats?.sellVolSol || 0) * solPrice;

    // Top protocols from DeFi Llama
    const topProtocols = (dexVolumes?.protocols || []).slice(0, 3).map((p: any) => ({
      name: p.name,
      vol24hUsd: p.vol24h,
      change: p.change,
    }));

    // Launchpad volumes from our DB
    const lpVolumes = Object.entries(dbStats?.lpVolumeMap || {})
      .map(([type, volSol]) => ({
        type,
        vol24hUsd: (volSol as number) * solPrice,
        vol24hSol: volSol as number,
      }))
      .sort((a, b) => b.vol24hUsd - a.vol24hUsd)
      .slice(0, 3);

    const result = {
      // Market overview
      totalVol24hUsd: totalVolUsd,
      volChange24h: volChange,
      solPrice,

      // Trade stats (from our platform)
      totalTrades: dbStats?.trades24h || 0,
      tradesChange: dbStats?.tradesChange || 0,
      uniqueTraders: dbStats?.uniqueTraders24h || 0,
      tradersChange: dbStats?.tradersChange || 0,

      // Buy/sell breakdown (our platform)
      buyCount: dbStats?.buyCount || 0,
      buyVolUsd,
      buyVolSol: dbStats?.buyVolSol || 0,
      sellCount: dbStats?.sellCount || 0,
      sellVolUsd,
      sellVolSol: dbStats?.sellVolSol || 0,
      ownVolUsd,

      // Token stats
      tokensCreated: dbStats?.totalTokens || 0,
      created24h: dbStats?.created24h || 0,
      createdChange: dbStats?.createdChange || 0,
      migrations: dbStats?.totalGraduated || 0,
      graduated24h: dbStats?.graduated24h || 0,
      graduatedChange: dbStats?.graduatedChange || 0,

      // Top protocols (Solana-wide from DeFi Llama)
      topProtocols,

      // Top launchpads (our platform data)
      topLaunchpads: lpVolumes,

      // Timestamp
      updatedAt: new Date().toISOString(),
    };

    cachedData = result;
    cachedAt = Date.now();

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
