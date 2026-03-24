const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cached: { data: Record<string, { price: number; change24h: number }>; timestamp: number } | null = null;
const CACHE_TTL = 60000;
const STALE_TTL = 600000; // serve stale data up to 10 min
const FETCH_TIMEOUT = 8000;

async function fetchWithTimeout(url: string, opts: RequestInit = {}): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(t); }
}

async function fromBinance() {
  const r = await fetchWithTimeout(
    "https://api.binance.com/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22BNBUSDT%22%5D"
  );
  if (!r.ok) return null;
  const arr = await r.json();
  if (!Array.isArray(arr) || arr.length < 3) return null;
  const map: Record<string, string> = { BTCUSDT: "btc", ETHUSDT: "eth", BNBUSDT: "bnb" };
  const results: Record<string, { price: number; change24h: number }> = {};
  for (const item of arr) {
    const key = map[item.symbol];
    if (key) results[key] = { price: parseFloat(item.lastPrice) || 0, change24h: parseFloat(item.priceChangePercent) || 0 };
  }
  return Object.keys(results).length === 3 ? results : null;
}

async function fromCoinGecko() {
  const r = await fetchWithTimeout(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,binancecoin&vs_currencies=usd&include_24hr_change=true",
    { headers: { Accept: "application/json" } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  return {
    btc: { price: d.bitcoin?.usd ?? 0, change24h: d.bitcoin?.usd_24h_change ?? 0 },
    eth: { price: d.ethereum?.usd ?? 0, change24h: d.ethereum?.usd_24h_change ?? 0 },
    bnb: { price: d.binancecoin?.usd ?? 0, change24h: d.binancecoin?.usd_24h_change ?? 0 },
  };
}

async function fromCryptoCompare() {
  const r = await fetchWithTimeout("https://min-api.cryptocompare.com/data/pricemultifull?fsyms=BTC,ETH,BNB&tsyms=USD");
  if (!r.ok) return null;
  const d = await r.json();
  const raw = d.RAW;
  return {
    btc: { price: raw?.BTC?.USD?.PRICE ?? 0, change24h: raw?.BTC?.USD?.CHANGEPCT24HOUR ?? 0 },
    eth: { price: raw?.ETH?.USD?.PRICE ?? 0, change24h: raw?.ETH?.USD?.CHANGEPCT24HOUR ?? 0 },
    bnb: { price: raw?.BNB?.USD?.PRICE ?? 0, change24h: raw?.BNB?.USD?.CHANGEPCT24HOUR ?? 0 },
  };
}

// Lightweight fallback: Coinbase spot prices (no rate limit issues)
async function fromCoinbase() {
  const pairs = [
    { id: "btc", pair: "BTC-USD" },
    { id: "eth", pair: "ETH-USD" },
    { id: "bnb", pair: "BNB-USD" },
  ];
  const results: Record<string, { price: number; change24h: number }> = {};
  const fetches = pairs.map(async ({ id, pair }) => {
    try {
      const r = await fetchWithTimeout(`https://api.coinbase.com/v2/prices/${pair}/spot`);
      if (r.ok) {
        const d = await r.json();
        results[id] = { price: parseFloat(d.data?.amount) || 0, change24h: 0 };
      }
    } catch {}
  });
  await Promise.all(fetches);
  return results.btc?.price > 0 ? results : null;
}

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  try {
    // Serve fresh cache
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return respond(cached.data);
    }

    // Try all sources — run Binance first (single request, most reliable), then fallbacks
    const sources = [fromBinance, fromCoinGecko, fromCryptoCompare, fromCoinbase];
    for (const source of sources) {
      try {
        const result = await source();
        if (result && result.btc?.price > 0) {
          cached = { data: result, timestamp: Date.now() };
          return respond(result);
        }
      } catch (e) {
        console.log("[crypto-prices]", source.name, "failed:", e);
      }
    }

    // Serve stale cache if within 10 min
    if (cached && Date.now() - cached.timestamp < STALE_TTL) {
      return respond(cached.data);
    }

    return respond({ error: "All sources failed" }, 503);
  } catch {
    if (cached) return respond(cached.data);
    return respond({ error: "Server error" }, 500);
  }
});