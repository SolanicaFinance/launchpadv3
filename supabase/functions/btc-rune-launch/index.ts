import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Migrated from Hiro (deprecated March 9, 2026) to Xverse API
const XVERSE_API = "https://api.xverse.app";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Prepare a Rune etch ──
    if (action === "prepare-etch") {
      const {
        runeName, runeSymbol, supply, divisibility,
        preminePercent, description, lockDays,
        creatorWallet, rugshieldScore,
      } = body;

      if (!runeName || !runeSymbol || !supply || !creatorWallet) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Validate rune name availability via Xverse
      try {
        const runeClean = runeName.replace(/•/g, "");
        const runeRes = await fetch(`${XVERSE_API}/v1/runes/${encodeURIComponent(runeClean)}`);
        if (runeRes.ok) {
          const runeData = await runeRes.json();
          if (runeData && runeData.name) {
            return new Response(JSON.stringify({ error: "Rune name already taken" }), {
              status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }
        }
        // 404 = name available, which is what we want
      } catch {
        // If check fails, proceed anyway — user will discover on broadcast
        console.warn("[btc-rune-launch] Rune name availability check failed, proceeding");
      }

      // Fetch UTXOs for the creator wallet
      const utxoRes = await fetch(`https://mempool.space/api/address/${creatorWallet}/utxo`);
      if (!utxoRes.ok) throw new Error("Failed to fetch UTXOs from mempool.space");
      const utxos = await utxoRes.json();

      if (!utxos || utxos.length === 0) {
        return new Response(JSON.stringify({ error: "No UTXOs found — wallet needs BTC for fees" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get fee estimate
      const feeRes = await fetch("https://mempool.space/api/v1/fees/recommended");
      const fees = feeRes.ok ? await feeRes.json() : { halfHourFee: 10 };

      const totalSupply = BigInt(supply);
      const premineAmount = totalSupply * BigInt(Math.round(preminePercent || 0)) / 100n;

      const etchParams = {
        rune: runeName.replace(/•/g, ""),
        spacers: calculateSpacers(runeName),
        symbol: runeSymbol,
        supply: supply.toString(),
        divisibility: parseInt(divisibility) || 0,
        premine: premineAmount.toString(),
        feeRate: fees.halfHourFee,
        utxoCount: utxos.length,
        totalUtxoValue: utxos.reduce((sum: number, u: any) => sum + u.value, 0),
      };

      const { data: token, error: dbError } = await supabase
        .from("btc_tokens")
        .insert({
          rune_name: runeName,
          rune_symbol: runeSymbol,
          supply: parseInt(supply),
          divisibility: parseInt(divisibility) || 0,
          premine_pct: preminePercent || 0,
          creator_wallet: creatorWallet,
          description: description || null,
          lock_days: parseInt(lockDays) || 0,
          rugshield_score: rugshieldScore ?? null,
          status: "pending",
        })
        .select()
        .single();

      if (dbError) throw new Error(`DB error: ${dbError.message}`);

      return new Response(JSON.stringify({
        success: true, tokenId: token.id, etchParams,
        message: "Rune etch prepared. PSBT construction requires ord-compatible encoding.",
        estimatedFee: {
          sats: etchParams.feeRate * 250,
          btc: (etchParams.feeRate * 250) / 1e8,
          feeRate: etchParams.feeRate,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Get Rune info (migrated to Xverse) ──
    if (action === "get-rune") {
      const { runeId } = body;
      if (!runeId) {
        return new Response(JSON.stringify({ error: "runeId required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${XVERSE_API}/v1/runes/${encodeURIComponent(runeId)}`);
      if (!res.ok) throw new Error(`Xverse API returned ${res.status}`);
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── List trending Runes ──
    // Xverse has no global etchings list. Use mempool.space popular runes instead.
    if (action === "list-runes") {
      const { limit = 12 } = body;

      // Use mempool.space as a fallback for popular/recent runes
      try {
        const res = await fetch("https://mempool.space/api/v1/runes");
        if (res.ok) {
          const data = await res.json();
          const results = Array.isArray(data) ? data.slice(0, limit) : (data.entries || data.results || []).slice(0, limit);
          return new Response(JSON.stringify({ results }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch {
        // mempool runes endpoint may not exist
      }

      // Fallback: return platform-launched runes from DB
      const { data: dbRunes } = await supabase
        .from("btc_tokens")
        .select("id, rune_name, rune_symbol, supply, divisibility, premine_pct, created_at, status")
        .order("created_at", { ascending: false })
        .limit(limit);

      const results = (dbRunes || []).map(r => ({
        id: r.id,
        name: r.rune_name,
        spaced_name: r.rune_name,
        symbol: r.rune_symbol,
        number: 0,
        supply: r.supply?.toString() || "0",
        premine: r.premine_pct ? (BigInt(r.supply || 0) * BigInt(r.premine_pct) / 100n).toString() : "0",
        divisibility: r.divisibility || 0,
        timestamp: new Date(r.created_at).getTime() / 1000,
        source: "platform",
      }));

      return new Response(JSON.stringify({ results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get Rune balances for address (Xverse) ──
    if (action === "get-balances") {
      const { address } = body;
      if (!address) {
        return new Response(JSON.stringify({ error: "address required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const res = await fetch(`${XVERSE_API}/v1/runes/balances/${encodeURIComponent(address)}`);
      if (!res.ok) throw new Error(`Xverse API returned ${res.status}`);
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Get Rune holders — not available in Xverse ──
    if (action === "get-holders") {
      return new Response(JSON.stringify({
        error: "Global holder lists are not available after Hiro deprecation. Use per-address balance queries instead.",
        suggestion: "Use action 'get-balances' with an address to check individual holdings.",
      }), {
        status: 501, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("btc-rune-launch error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function calculateSpacers(name: string): number {
  let spacers = 0;
  let letterIndex = 0;
  for (const char of name) {
    if (char === "•") {
      if (letterIndex > 0) spacers |= (1 << (letterIndex - 1));
    } else {
      letterIndex++;
    }
  }
  return spacers;
}
