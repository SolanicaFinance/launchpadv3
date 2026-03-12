import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Column = "new" | "completing" | "completed";

const SOLANA_NETWORK_ID = 1399811149;
const BSC_NETWORK_ID = 56;
const MAX_REASONABLE_CHANGE_24H_DEFAULT = 10_000;
const MAX_REASONABLE_CHANGE_24H_BSC = 1_000;

function toFiniteNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

async function fetchDexScreenerChange24h(address: string, networkId: number): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`, {
      headers: { Accept: "application/json", "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const expectedChain = networkId === BSC_NETWORK_ID ? "bsc" : "solana";
    const pairs = Array.isArray(data?.pairs) ? data.pairs : [];
    const filteredPairs = pairs.filter((pair: any) => pair?.chainId === expectedChain);
    const poolCandidates = filteredPairs.length > 0 ? filteredPairs : pairs;

    if (poolCandidates.length === 0) return null;

    const bestPair = poolCandidates.sort(
      (a: any, b: any) => toFiniteNumber(b?.liquidity?.usd) - toFiniteNumber(a?.liquidity?.usd)
    )[0];

    const change = toFiniteNumber(bestPair?.priceChange?.h24);
    return Number.isFinite(change) ? change : null;
  } catch {
    return null;
  }
}

function buildQuery(column: Column, limit: number, networkId: number): string {
  let filters: string;
  let rankings: string;

  const oneDayAgo = Math.floor(Date.now() / 1000) - 86400;
  const twoDaysAgo = Math.floor(Date.now() / 1000) - 172800;

  if (networkId === BSC_NETWORK_ID) {
    // BSC: no launchpad graduation concept — use liquidity/volume filters
    switch (column) {
      case "new":
        filters = `{ network: [${networkId}], createdAt: { gte: ${oneDayAgo} }, liquidity: { gte: 1000 } }`;
        rankings = `{ attribute: createdAt, direction: DESC }`;
        break;
      case "completing":
        // "Final Stretch" on BSC = high volume new tokens
        filters = `{ network: [${networkId}], createdAt: { gte: ${twoDaysAgo} }, volume24: { gte: 5000 }, liquidity: { gte: 5000 } }`;
        rankings = `{ attribute: volume24, direction: DESC }`;
        break;
      case "completed":
        // "Migrated" on BSC = established tokens with decent liquidity and volume
        filters = `{ network: [${networkId}], liquidity: { gte: 10000 }, volume24: { gte: 1000 } }`;
        rankings = `{ attribute: volume24, direction: DESC }`;
        break;
    }
  } else {
    // Solana: original launchpad-based logic
    const allLaunchpads = `["Pump.fun", "Bonk", "Moonshot", "Believe", "boop", "Jupiter Studio"]`;

    switch (column) {
      case "new":
        filters = `{ network: [${networkId}], launchpadName: ${allLaunchpads}, launchpadCompleted: false, launchpadMigrated: false, createdAt: { gte: ${oneDayAgo} } }`;
        rankings = `{ attribute: createdAt, direction: DESC }`;
        break;
      case "completing":
        filters = `{ network: [${networkId}], launchpadName: ${allLaunchpads}, launchpadCompleted: false, launchpadMigrated: false, launchpadGraduationPercent: { gte: 50, lte: 99 }, createdAt: { gte: ${twoDaysAgo} } }`;
        rankings = `{ attribute: marketCap, direction: DESC }`;
        break;
      case "completed":
        filters = `{ network: [${networkId}], launchpadMigrated: true }`;
        rankings = `{ attribute: createdAt, direction: DESC }`;
        break;
    }
  }

  return `{
  filterTokens(
    filters: ${filters}
    rankings: ${rankings}
    limit: ${limit}
  ) {
    results {
      createdAt
      holders
      liquidity
      marketCap
      volume24
      change24
      token {
        info {
          address
          name
          symbol
          imageSmallUrl
          imageLargeUrl
          imageThumbUrl
        }
        socialLinks {
          twitter
          website
          telegram
          discord
        }
        launchpad {
          graduationPercent
          poolAddress
          launchpadName
          launchpadIconUrl
          completed
          migrated
          completedAt
          migratedAt
        }
      }
    }
  }
}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("CODEX_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "CODEX_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { column = "new", limit = 50, networkId = SOLANA_NETWORK_ID } = await req.json().catch(() => ({}));
    const validColumn = (["new", "completing", "completed"] as Column[]).includes(column) ? column : "new";
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const safeNetworkId = [SOLANA_NETWORK_ID, BSC_NETWORK_ID].includes(networkId) ? networkId : SOLANA_NETWORK_ID;

    const query = buildQuery(validColumn as Column, safeLimit, safeNetworkId);

    const res = await fetch("https://graph.codex.io/graphql", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: apiKey,
      },
      body: JSON.stringify({ query }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Codex API error:", res.status, text);
      return new Response(
        JSON.stringify({ error: "Codex API error", status: res.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    if (data.errors) {
      console.error("Codex GraphQL errors:", JSON.stringify(data.errors));
      return new Response(
        JSON.stringify({ error: "GraphQL error", details: data.errors }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = data?.data?.filterTokens?.results ?? [];

    const tokens = results.map((r: any) => {
      const address = r.token?.info?.address ?? null;
      const isBsc = safeNetworkId === BSC_NETWORK_ID;
      const dexChain = isBsc ? "bsc" : "solana";
      const dexScreenerImage = address
        ? `https://dd.dexscreener.com/ds-data/tokens/${dexChain}/${address}.png`
        : null;
      const identiconImage = address
        ? `https://api.dicebear.com/9.x/identicon/svg?seed=${encodeURIComponent(address.toLowerCase())}`
        : null;

      // BSC: avoid unreliable upstream token-media image mismatches.
      // We use deterministic per-address sources only.
      let imageUrl = isBsc
        ? (identiconImage || dexScreenerImage)
        : (r.token?.info?.imageSmallUrl || r.token?.info?.imageThumbUrl || r.token?.info?.imageLargeUrl || dexScreenerImage || identiconImage);

      return {
        address,
        name: r.token?.info?.name ?? "Unknown",
        symbol: r.token?.info?.symbol ?? "???",
        imageUrl,
        marketCap: toFiniteNumber(r.marketCap),
        volume24h: toFiniteNumber(r.volume24),
        change24h: toFiniteNumber(r.change24),
        holders: toFiniteNumber(r.holders),
        liquidity: toFiniteNumber(r.liquidity),
        graduationPercent: toFiniteNumber(r.token?.launchpad?.graduationPercent),
        poolAddress: r.token?.launchpad?.poolAddress ?? null,
        launchpadName: r.token?.launchpad?.launchpadName ?? (safeNetworkId === BSC_NETWORK_ID ? "PancakeSwap" : "Pump.fun"),
        launchpadIconUrl: r.token?.launchpad?.launchpadIconUrl ?? null,
        completed: r.token?.launchpad?.completed ?? false,
        migrated: r.token?.launchpad?.migrated ?? false,
        completedAt: r.token?.launchpad?.completedAt ?? null,
        migratedAt: r.token?.launchpad?.migratedAt ?? null,
        createdAt: r.createdAt ?? null,
        twitterUrl: r.token?.socialLinks?.twitter ?? null,
        websiteUrl: r.token?.socialLinks?.website ?? null,
        telegramUrl: r.token?.socialLinks?.telegram ?? null,
        discordUrl: r.token?.socialLinks?.discord ?? null,
      };
    });

    const maxAllowedChange = safeNetworkId === BSC_NETWORK_ID
      ? MAX_REASONABLE_CHANGE_24H_BSC
      : MAX_REASONABLE_CHANGE_24H_DEFAULT;

    const normalizedTokens = await Promise.all(tokens.map(async (token: any) => {
      // Filter out tokens with overflow/invalid market caps (2^63 sentinel values)
      if (token.marketCap > 1e15) return null;

      if (Math.abs(token.change24h) <= maxAllowedChange) {
        return token;
      }

      // BSC outliers are frequently bad upstream values; verify from DexScreener before trusting.
      if (safeNetworkId === BSC_NETWORK_ID && token.address) {
        const dsChange24h = await fetchDexScreenerChange24h(token.address, safeNetworkId);
        if (dsChange24h !== null && Math.abs(dsChange24h) <= maxAllowedChange) {
          token.change24h = dsChange24h;
          return token;
        }
      }

      token.change24h = 0;
      return token;
    }));

    const outlierCount = normalizedTokens.filter((t: any) => t && t.change24h === 0).length;
    if (outlierCount > 0) {
      console.log(`[codex-filter-tokens] Normalized ${outlierCount} outlier change24h values for network ${safeNetworkId} (threshold=${maxAllowedChange}%)`);
    }

    const finalTokens = normalizedTokens.filter((token: any) => token !== null);

    return new Response(JSON.stringify({ tokens: finalTokens, column: validColumn, networkId: safeNetworkId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("codex-filter-tokens error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
