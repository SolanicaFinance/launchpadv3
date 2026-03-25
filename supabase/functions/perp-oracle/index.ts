import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface DexScreenerPair {
  baseToken: { address: string; name: string; symbol: string };
  quoteToken: { address: string; symbol: string };
  priceUsd: string;
  priceChange: { h24: number };
  volume: { h24: number };
  liquidity: { usd: number };
  fdv: number;
  pairAddress: string;
  chainId: string;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { action, tokenAddress, tokenAddresses } = await req.json();

    if (action === "update_all") {
      // Fetch all active market token addresses
      const { data: markets } = await supabase
        .from("perp_markets")
        .select("token_address")
        .eq("status", "active");

      if (!markets?.length) {
        return new Response(
          JSON.stringify({ success: true, updated: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const addresses = markets.map((m) => m.token_address);
      const updated = await updatePrices(supabase, addresses);

      return new Response(
        JSON.stringify({ success: true, updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "lookup") {
      // Lookup a single token for market creation eligibility
      if (!tokenAddress) {
        return new Response(
          JSON.stringify({ success: false, error: "tokenAddress required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const pair = await lookupToken(tokenAddress);
      if (!pair) {
        return new Response(
          JSON.stringify({ success: false, error: "No active trading pair found on BSC" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check eligibility
      const eligible = checkEligibility(pair);

      return new Response(
        JSON.stringify({
          success: true,
          token: {
            address: pair.baseToken.address,
            name: pair.baseToken.name,
            symbol: pair.baseToken.symbol,
            pairAddress: pair.pairAddress,
            quoteToken: pair.quoteToken.symbol,
            priceUsd: pair.priceUsd,
            priceChange24h: pair.priceChange?.h24 || 0,
            volume24h: pair.volume?.h24 || 0,
            marketCap: pair.fdv || 0,
            liquidity: pair.liquidity?.usd || 0,
          },
          eligible: eligible.pass,
          eligibilityChecks: eligible.checks,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "update_specific" && tokenAddresses?.length) {
      const updated = await updatePrices(supabase, tokenAddresses);
      return new Response(
        JSON.stringify({ success: true, updated }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Oracle error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function lookupToken(address: string): Promise<DexScreenerPair | null> {
  const res = await fetch(
    `https://api.dexscreener.com/latest/dex/tokens/${address}`
  );
  if (!res.ok) return null;

  const data = await res.json();
  if (!data.pairs?.length) return null;

  // Find BSC pair with USDT, BNB, or WBNB quote
  const bscPairs = data.pairs.filter(
    (p: DexScreenerPair) =>
      p.chainId === "bsc" &&
      ["USDT", "WBNB", "BNB", "USDC", "BUSD"].includes(p.quoteToken.symbol.toUpperCase())
  );

  if (!bscPairs.length) return null;

  // Return highest liquidity pair
  return bscPairs.sort(
    (a: DexScreenerPair, b: DexScreenerPair) =>
      (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
  )[0];
}

function checkEligibility(pair: DexScreenerPair) {
  const marketCap = pair.fdv || 0;
  const liquidity = pair.liquidity?.usd || 0;
  const volume = pair.volume?.h24 || 0;

  const checks = [
    {
      label: "Active BSC trading pair",
      pass: true,
      detail: `${pair.baseToken.symbol}/${pair.quoteToken.symbol}`,
    },
    {
      label: "Market cap ≥ $10,000",
      pass: marketCap >= 10000,
      detail: `$${marketCap.toLocaleString()}`,
    },
    {
      label: "Liquidity ≥ $2,000",
      pass: liquidity >= 2000,
      detail: `$${liquidity.toLocaleString()}`,
    },
    {
      label: "24h volume > $0",
      pass: volume > 0,
      detail: `$${volume.toLocaleString()}`,
    },
  ];

  return {
    pass: checks.every((c) => c.pass),
    checks,
  };
}

async function updatePrices(
  supabase: any,
  addresses: string[]
): Promise<number> {
  let updated = 0;

  // Batch by 30 addresses (DexScreener limit)
  for (let i = 0; i < addresses.length; i += 30) {
    const batch = addresses.slice(i, i + 30);
    const joined = batch.join(",");

    try {
      const res = await fetch(
        `https://api.dexscreener.com/latest/dex/tokens/${joined}`
      );
      if (!res.ok) continue;

      const data = await res.json();
      if (!data.pairs?.length) continue;

      // Group by base token address, pick best BSC pair
      const priceMap = new Map<string, DexScreenerPair>();
      for (const pair of data.pairs) {
        if (pair.chainId !== "bsc") continue;
        const addr = pair.baseToken.address.toLowerCase();
        const existing = priceMap.get(addr);
        if (
          !existing ||
          (pair.liquidity?.usd || 0) > (existing.liquidity?.usd || 0)
        ) {
          priceMap.set(addr, pair);
        }
      }

      for (const [addr, pair] of priceMap) {
        // Upsert price cache
        await supabase.from("perp_price_cache").upsert(
          {
            token_address: addr,
            chain: "bsc",
            price_usd: parseFloat(pair.priceUsd),
            price_change_24h: pair.priceChange?.h24 || 0,
            volume_24h: pair.volume?.h24 || 0,
            market_cap: pair.fdv || 0,
            liquidity: pair.liquidity?.usd || 0,
            source: "dexscreener",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token_address,chain" }
        );

        // Update market's last price
        await supabase
          .from("perp_markets")
          .update({
            last_price_usd: parseFloat(pair.priceUsd),
            last_price_updated_at: new Date().toISOString(),
            market_cap_usd: pair.fdv || 0,
            liquidity_usd: pair.liquidity?.usd || 0,
          })
          .eq("token_address", addr);

        updated++;
      }
    } catch (e) {
      console.error(`Batch update error:`, e);
    }
  }

  return updated;
}
