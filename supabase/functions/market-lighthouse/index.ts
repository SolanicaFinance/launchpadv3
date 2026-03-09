const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedData: any = null;
let cachedAt = 0;
const CACHE_TTL = 3 * 60 * 1000;

type ProtocolRow = {
  name: string;
  vol24h: number;
  change: number;
};

async function fetchWithTimeout(url: string, opts: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...opts, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

async function fetchDefiLlamaDexVolumes() {
  try {
    const res = await fetchWithTimeout(
      "https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true",
    );
    if (!res.ok) return null;

    const data = await res.json();
    const total24h = Number(data.total24h || 0);
    const total48hto24h = Number(data.total48hto24h || 0);
    const change24h = total48hto24h > 0 ? ((total24h - total48hto24h) / total48hto24h) * 100 : 0;

    const protocols: ProtocolRow[] = [];
    if (Array.isArray(data.protocols)) {
      for (const p of data.protocols) {
        const vol24h = Number(p?.total24h || 0);
        if (vol24h <= 0) continue;

        const prev24h = Number(p?.total48hto24h || 0);
        const pChange = prev24h > 0 ? ((vol24h - prev24h) / prev24h) * 100 : 0;

        protocols.push({
          name: p?.name || p?.displayName || "Unknown",
          vol24h,
          change: pChange,
        });
      }
    }

    protocols.sort((a, b) => b.vol24h - a.vol24h);

    return { total24h, change24h, protocols };
  } catch {
    return null;
  }
}

async function fetchGeckoTerminalTrades() {
  try {
    const res = await fetchWithTimeout("https://api.geckoterminal.com/api/v2/networks/solana/trending_pools?page=1", {}, 9000);
    if (!res.ok) return null;

    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];

    let buys = 0;
    let sells = 0;

    for (const row of rows) {
      const h24 = row?.attributes?.transactions?.h24 || {};
      buys += Number(h24?.buys || 0);
      sells += Number(h24?.sells || 0);
    }

    return {
      buyCount: buys,
      sellCount: sells,
      totalTrades: buys + sells,
    };
  } catch {
    return null;
  }
}

async function fetchSolPrice(): Promise<number> {
  try {
    const res = await fetchWithTimeout("https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd");
    if (!res.ok) return 0;
    const data = await res.json();
    return Number(data?.solana?.usd || 0);
  } catch {
    return 0;
  }
}

function protocolVolumeByName(protocols: ProtocolRow[], matcher: RegExp): number {
  return protocols
    .filter((p) => matcher.test(p.name.toLowerCase()))
    .reduce((sum, p) => sum + p.vol24h, 0);
}

function protocolChangeByName(protocols: ProtocolRow[], matcher: RegExp): number {
  const matched = protocols.filter((p) => matcher.test(p.name.toLowerCase()));
  if (!matched.length) return 0;
  const totalVol = matched.reduce((sum, p) => sum + p.vol24h, 0);
  if (totalVol <= 0) return matched[0].change;
  return matched.reduce((sum, p) => sum + p.change * (p.vol24h / totalVol), 0);
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

    const [dexVolumes, geckoTrades, solPrice] = await Promise.all([
      fetchDefiLlamaDexVolumes(),
      fetchGeckoTerminalTrades(),
      fetchSolPrice(),
    ]);

    const totalVolUsd = Number(dexVolumes?.total24h || 0);
    const volChange = Number(dexVolumes?.change24h || 0);

    const buyCount = Number(geckoTrades?.buyCount || 0);
    const sellCount = Number(geckoTrades?.sellCount || 0);
    const totalTrades = Number(geckoTrades?.totalTrades || 0);

    const tradeRatioDenom = buyCount + sellCount;
    const buyRatio = tradeRatioDenom > 0 ? buyCount / tradeRatioDenom : 0.5;
    const sellRatio = 1 - buyRatio;

    const buyVolUsd = totalVolUsd * buyRatio;
    const sellVolUsd = totalVolUsd * sellRatio;
    const buyVolSol = solPrice > 0 ? buyVolUsd / solPrice : 0;
    const sellVolSol = solPrice > 0 ? sellVolUsd / solPrice : 0;

    const protocols = dexVolumes?.protocols || [];

    const topProtocols = protocols.slice(0, 3).map((p) => ({
      name: p.name,
      vol24hUsd: p.vol24h,
      change: p.change,
    }));

    // Fixed launchpad set (as requested), all values from external protocol feed (no DB)
    const launchpadRows = [
      {
        type: "pumpfun",
        matcher: /pump/,
      },
      {
        type: "bonk",
        matcher: /bonk/,
      },
      {
        type: "moonshot",
        matcher: /moonshot/,
      },
    ];

    const topLaunchpads = launchpadRows.map((lp) => {
      const vol24hUsd = protocolVolumeByName(protocols, lp.matcher);
      const change = protocolChangeByName(protocols, lp.matcher);
      const vol24hSol = solPrice > 0 ? vol24hUsd / solPrice : 0;
      return {
        type: lp.type,
        vol24hUsd,
        vol24hSol,
        change,
      };
    });

    const result = {
      totalVol24hUsd: totalVolUsd,
      volChange24h: volChange,
      solPrice,

      totalTrades,
      tradesChange: 0,
      uniqueTraders: 0,
      tradersChange: 0,

      buyCount,
      buyVolUsd,
      buyVolSol,
      sellCount,
      sellVolUsd,
      sellVolSol,
      ownVolUsd: totalVolUsd,

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
