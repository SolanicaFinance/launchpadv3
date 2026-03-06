import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type Column = "new" | "completing" | "completed";

const SOLANA_NETWORK_ID = 1399811149;
const BSC_NETWORK_ID = 56;

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
        // "Migrated" on BSC = established tokens with high liquidity
        filters = `{ network: [${networkId}], liquidity: { gte: 50000 } }`;
        rankings = `{ attribute: marketCap, direction: DESC }`;
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

    const tokens = results.map((r: any) => ({
      address: r.token?.info?.address ?? null,
      name: r.token?.info?.name ?? "Unknown",
      symbol: r.token?.info?.symbol ?? "???",
      imageUrl: r.token?.info?.imageSmallUrl || r.token?.info?.imageLargeUrl || null,
      marketCap: r.marketCap ? parseFloat(r.marketCap) : 0,
      volume24h: r.volume24 ? parseFloat(r.volume24) : 0,
      change24h: r.change24 ? parseFloat(r.change24) : 0,
      holders: r.holders ?? 0,
      liquidity: r.liquidity ? parseFloat(r.liquidity) : 0,
      graduationPercent: r.token?.launchpad?.graduationPercent ?? 0,
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
    }));

    return new Response(JSON.stringify({ tokens, column: validColumn, networkId: safeNetworkId }), {
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
