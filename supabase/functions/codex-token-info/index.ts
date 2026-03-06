import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SOLANA_NETWORK_ID = 1399811149;

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

    const { address, networkId = SOLANA_NETWORK_ID } = await req.json().catch(() => ({}));
    
    // Validate address: Solana base58 or EVM hex
    const isSolanaAddr = /^[A-HJ-NP-Za-km-z1-9]{32,44}$/.test(address || '');
    const isEvmAddr = /^0x[a-fA-F0-9]{40}$/.test(address || '');
    
    if (!address || typeof address !== "string" || (!isSolanaAddr && !isEvmAddr)) {
      return new Response(
        JSON.stringify({ error: "Invalid address" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const safeNetworkId = Number(networkId) || SOLANA_NETWORK_ID;

    // Query both token metadata and market data
    const query = `{
  tokens(ids: [{ address: "${address}", networkId: ${safeNetworkId} }]) {
    address
    decimals
    name
    symbol
    info {
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
      completed
      migrated
    }
  }
  filterTokens(
    filters: { network: [${safeNetworkId}] }
    rankings: { attribute: marketCap, direction: DESC }
    tokens: ["${address}"]
    limit: 1
  ) {
    results {
      holders
      marketCap
      volume24
      liquidity
      change24
      priceUSD
    }
  }
}`;

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
        JSON.stringify({ error: "Codex API error" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();

    if (data.errors) {
      console.error("Codex GraphQL errors:", JSON.stringify(data.errors));
    }

    const tokenMeta = data?.data?.tokens?.[0];
    const marketResult = data?.data?.filterTokens?.results?.[0];

    if (!tokenMeta) {
      return new Response(
        JSON.stringify({ token: null }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = {
      address: tokenMeta.address,
      name: tokenMeta.name || "Unknown",
      symbol: tokenMeta.symbol || "???",
      decimals: tokenMeta.decimals ?? (safeNetworkId === SOLANA_NETWORK_ID ? 9 : 18),
      imageUrl: tokenMeta.info?.imageLargeUrl || tokenMeta.info?.imageSmallUrl || null,
      twitterUrl: tokenMeta.socialLinks?.twitter || null,
      websiteUrl: tokenMeta.socialLinks?.website || null,
      telegramUrl: tokenMeta.socialLinks?.telegram || null,
      discordUrl: tokenMeta.socialLinks?.discord || null,
      graduationPercent: tokenMeta.launchpad?.graduationPercent ?? null,
      completed: tokenMeta.launchpad?.completed ?? false,
      migrated: tokenMeta.launchpad?.migrated ?? false,
      holders: marketResult?.holders ?? 0,
      marketCapUsd: marketResult?.marketCap ? parseFloat(marketResult.marketCap) : 0,
      volume24hUsd: marketResult?.volume24 ? parseFloat(marketResult.volume24) : 0,
      liquidity: marketResult?.liquidity ? parseFloat(marketResult.liquidity) : 0,
      change24h: marketResult?.change24 ? parseFloat(marketResult.change24) : 0,
      priceUsd: marketResult?.priceUSD ? parseFloat(marketResult.priceUSD) : 0,
    };

    return new Response(JSON.stringify({ token }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("codex-token-info error:", err);
    return new Response(
      JSON.stringify({ error: "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
