const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// In-memory cache: mintAddress -> { data, timestamp }
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mintAddress } = await req.json();
    if (!mintAddress || typeof mintAddress !== 'string') {
      return new Response(JSON.stringify({ error: 'mintAddress required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check cache
    const cached = cache.get(mintAddress);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
      return new Response(JSON.stringify(cached.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch from RugCheck.xyz
    const resp = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mintAddress}/report`);
    if (!resp.ok) {
      const errText = await resp.text();
      console.error('RugCheck API error:', resp.status, errText);
      // Return a safe default instead of 502 so the UI doesn't break
      const fallback = {
        mintAuthorityRevoked: false,
        freezeAuthorityRevoked: false,
        liquidityLocked: false,
        liquidityLockedPct: 0,
        topHolderPct: 0,
        riskLevel: 'unknown',
        riskScore: 0,
        warnings: ['RugCheck data unavailable for this token'],
      };
      cache.set(mintAddress, { data: fallback, ts: Date.now() });
      return new Response(JSON.stringify(fallback), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await resp.json();

    // Extract mint authority status
    const mintAuthorityRevoked = raw.mintAuthority === null || raw.mintAuthority === '' || raw.mintAuthority === undefined;
    const freezeAuthorityRevoked = raw.freezeAuthority === null || raw.freezeAuthority === '' || raw.freezeAuthority === undefined;

    // Extract liquidity info from markets
    let liquidityLocked = false;
    let liquidityLockedPct = 0;
    if (raw.markets && Array.isArray(raw.markets)) {
      for (const market of raw.markets) {
        if (market.lp) {
          const burnPct = market.lp.lpBurnPct ?? market.lp.burnPct ?? 0;
          const lockPct = market.lp.lpLockPct ?? market.lp.lockPct ?? 0;
          const totalLockedPct = burnPct + lockPct;
          if (totalLockedPct > liquidityLockedPct) {
            liquidityLockedPct = totalLockedPct;
          }
        }
      }
      liquidityLocked = liquidityLockedPct > 50;
    }

    // Top holder concentration
    let topHolderPct = 0;
    if (raw.topHolders && Array.isArray(raw.topHolders)) {
      const top10 = raw.topHolders.slice(0, 10);
      topHolderPct = top10.reduce((sum: number, h: { pct?: number }) => sum + (h.pct ?? 0), 0);
    }

    // Risk info
    const riskLevel = raw.riskLevel ?? raw.score_label ?? 'unknown';
    const riskScore = raw.score ?? raw.riskScore ?? 0;

    // Warnings
    const warnings: string[] = [];
    if (raw.risks && Array.isArray(raw.risks)) {
      for (const risk of raw.risks) {
        if (risk.name || risk.description) {
          warnings.push(risk.name || risk.description);
        }
      }
    }

    const result = {
      mintAuthorityRevoked,
      freezeAuthorityRevoked,
      liquidityLocked,
      liquidityLockedPct: Math.round(liquidityLockedPct * 100) / 100,
      topHolderPct: Math.round(topHolderPct * 100) / 100,
      riskLevel,
      riskScore,
      warnings,
    };

    // Cache
    cache.set(mintAddress, { data: result, ts: Date.now() });

    // Evict old entries
    if (cache.size > 500) {
      const now = Date.now();
      for (const [key, val] of cache) {
        if (now - val.ts > CACHE_TTL_MS) cache.delete(key);
      }
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('rugcheck-report error:', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
