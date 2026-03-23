const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_TTL = 3 * 60 * 1000;
const cache: Record<string, { data: unknown; at: number }> = {};

type Timeframe = "5m" | "1h" | "6h" | "24h";
type Chain = "solana" | "bnb";

const GECKO_VOL_KEY: Record<Timeframe, string> = {
  "5m": "m5", "1h": "h1", "6h": "h6", "24h": "h24",
};
const GECKO_TX_KEY: Record<Timeframe, string> = {
  "5m": "m5", "1h": "h1", "6h": "h6", "24h": "h24",
};

type ProtocolRow = { name: string; vol24hUsd: number; change24h: number };
type DexStats = { volumeUsd: number; buyCount: number; sellCount: number; buyers: number; sellers: number };

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 9000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...opts, signal: controller.signal }); }
  finally { clearTimeout(id); }
}

async function fetchNativePriceUsd(chain: Chain): Promise<number> {
  try {
    const coinId = chain === "bnb" ? "binancecoin" : "solana";
    const res = await fetchWithTimeout(`https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`, {}, 7000);
    if (!res.ok) return 0;
    const json = await res.json();
    return Number(json?.[coinId]?.usd || 0);
  } catch { return 0; }
}

async function fetchDefiLlamaDexOverview(chain: Chain) {
  try {
    const llamaChain = chain === "bnb" ? "BSC" : "Solana";
    const res = await fetchWithTimeout(
      `https://api.llama.fi/overview/dexs/${llamaChain}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true`,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const total24h = Number(json?.total24h || 0);
    const prev24h = Number(json?.total48hto24h || 0);
    const change24h = prev24h > 0 ? ((total24h - prev24h) / prev24h) * 100 : 0;

    const protocols: ProtocolRow[] = (Array.isArray(json?.protocols) ? json.protocols : [])
      .map((p: any) => {
        const vol24hUsd = Number(p?.total24h || 0);
        const prevProtocol24h = Number(p?.total48hto24h || 0);
        const protocolChange24h = prevProtocol24h > 0 ? ((vol24hUsd - prevProtocol24h) / prevProtocol24h) * 100 : 0;
        return { name: String(p?.name || p?.displayName || "Unknown"), vol24hUsd, change24h: protocolChange24h };
      })
      .filter((p: ProtocolRow) => p.vol24hUsd > 0)
      .sort((a: ProtocolRow, b: ProtocolRow) => b.vol24hUsd - a.vol24hUsd);

    return { total24hUsd: total24h, change24h, protocols };
  } catch { return null; }
}

async function fetchGeckoDexPoolsStats(network: string, dexId: string, tf: Timeframe): Promise<DexStats | null> {
  try {
    const res = await fetchWithTimeout(`https://api.geckoterminal.com/api/v2/networks/${network}/dexes/${dexId}/pools?page=1`, {}, 9000);
    if (!res.ok) return null;
    const json = await res.json();
    const pools = Array.isArray(json?.data) ? json.data : [];
    const volKey = GECKO_VOL_KEY[tf];
    const txKey = GECKO_TX_KEY[tf];
    let volumeUsd = 0, buyCount = 0, sellCount = 0, buyers = 0, sellers = 0;
    for (const pool of pools) {
      const attributes = pool?.attributes || {};
      const txData = attributes?.transactions?.[txKey] || {};
      volumeUsd += Number(attributes?.volume_usd?.[volKey] || 0);
      buyCount += Number(txData?.buys || 0);
      sellCount += Number(txData?.sells || 0);
      buyers += Number(txData?.buyers || 0);
      sellers += Number(txData?.sellers || 0);
    }
    return { volumeUsd, buyCount, sellCount, buyers, sellers };
  } catch { return null; }
}

function aggregateDexStats(rows: Array<DexStats | null>): DexStats {
  return rows.reduce(
    (acc, row) => ({
      volumeUsd: acc.volumeUsd + Number(row?.volumeUsd || 0),
      buyCount: acc.buyCount + Number(row?.buyCount || 0),
      sellCount: acc.sellCount + Number(row?.sellCount || 0),
      buyers: acc.buyers + Number(row?.buyers || 0),
      sellers: acc.sellers + Number(row?.sellers || 0),
    }),
    { volumeUsd: 0, buyCount: 0, sellCount: 0, buyers: 0, sellers: 0 },
  );
}

const TF_SCALE: Record<Timeframe, number> = {
  "5m": 5 / 1440, "1h": 1 / 24, "6h": 6 / 24, "24h": 1,
};

// Chain-specific launchpad configs
interface LaunchpadConfig {
  type: string;
  network: string;
  dexIds: string[];
}

const SOLANA_LAUNCHPADS: LaunchpadConfig[] = [
  { type: "pumpfun", network: "solana", dexIds: ["pump-fun", "pumpswap"] },
  { type: "bonk", network: "solana", dexIds: ["raydium-launchlab"] },
  { type: "moonshot", network: "solana", dexIds: ["moonit"] },
];

const BNB_LAUNCHPADS: LaunchpadConfig[] = [
  { type: "pancakeswap", network: "bsc", dexIds: ["pancakeswap-v2", "pancakeswap-v3-bsc"] },
  { type: "four.meme", network: "bsc", dexIds: ["four-meme"] },
  { type: "moonit", network: "bsc", dexIds: ["moonit-bsc"] },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    let tf: Timeframe = "24h";
    let chain: Chain = "solana";
    try {
      const body = await req.json();
      if (body?.timeframe && ["5m", "1h", "6h", "24h"].includes(body.timeframe)) tf = body.timeframe as Timeframe;
      if (body?.chain === "bnb") chain = "bnb";
    } catch { /* default */ }

    const cacheKey = `${chain}-${tf}`;
    const cached = cache[cacheKey];
    if (cached && Date.now() - cached.at < CACHE_TTL) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const launchpads = chain === "bnb" ? BNB_LAUNCHPADS : SOLANA_LAUNCHPADS;

    // Fetch all launchpad stats in parallel
    const launchpadStatsPromises = launchpads.map(async (lp) => {
      const dexResults = await Promise.all(
        lp.dexIds.map((dexId) => fetchGeckoDexPoolsStats(lp.network, dexId, tf))
      );
      return { type: lp.type, stats: aggregateDexStats(dexResults) };
    });

    const [nativePrice, dexOverview, ...launchpadResults] = await Promise.all([
      fetchNativePriceUsd(chain),
      fetchDefiLlamaDexOverview(chain),
      ...launchpadStatsPromises,
    ]);

    const scale = TF_SCALE[tf];
    const scaledTotalVol = Number(dexOverview?.total24hUsd || 0) * scale;

    const topProtocols = (dexOverview?.protocols || []).slice(0, 3).map((p) => ({
      name: p.name,
      vol24hUsd: p.vol24hUsd * scale,
      change: p.change24h,
    }));

    const volChange24h = Number(dexOverview?.change24h || 0);

    const topLaunchpads = launchpadResults.map((lp) => ({
      type: lp.type,
      vol24hUsd: lp.stats.volumeUsd,
      vol24hSol: nativePrice > 0 ? lp.stats.volumeUsd / nativePrice : 0,
      change: 0,
    }));

    let buyCount = 0, sellCount = 0, totalLocalVolUsd = 0, totalBuyers = 0;
    for (const lp of launchpadResults) {
      buyCount += lp.stats.buyCount;
      sellCount += lp.stats.sellCount;
      totalLocalVolUsd += lp.stats.volumeUsd;
      totalBuyers += lp.stats.buyers;
    }
    const totalTrades = buyCount + sellCount;

    const response = {
      timeframe: tf,
      chain,
      totalVol24hUsd: scaledTotalVol,
      volChange24h,
      solPrice: nativePrice,

      totalTrades,
      tradesChange: 0,
      uniqueTraders: totalBuyers,
      tradersChange: 0,

      buyCount,
      buyVolUsd: totalLocalVolUsd * (totalTrades > 0 ? buyCount / totalTrades : 0.5),
      buyVolSol: nativePrice > 0 ? (totalLocalVolUsd * (totalTrades > 0 ? buyCount / totalTrades : 0.5)) / nativePrice : 0,
      sellCount,
      sellVolUsd: totalLocalVolUsd * (totalTrades > 0 ? sellCount / totalTrades : 0.5),
      sellVolSol: nativePrice > 0 ? (totalLocalVolUsd * (totalTrades > 0 ? sellCount / totalTrades : 0.5)) / nativePrice : 0,
      ownVolUsd: totalLocalVolUsd,

      tokensCreated: 0,
      created24h: 0,
      createdChange: 0,
      migrations: 0,
      graduated24h: 0,
      graduatedChange: 0,

      topProtocols,
      topLaunchpads,

      updatedAt: new Date().toISOString(),
    };

    cache[cacheKey] = { data: response, at: Date.now() };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
