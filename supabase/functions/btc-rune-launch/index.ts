import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HIRO_API = 'https://api.hiro.so';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const HIRO_API_KEY = Deno.env.get('HIRO_API_KEY');
    if (!HIRO_API_KEY) {
      throw new Error('HIRO_API_KEY is not configured');
    }

    const body = await req.json();
    const { action } = body;

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Prepare a Rune etch ──
    if (action === 'prepare-etch') {
      const {
        runeName,
        runeSymbol,
        supply,
        divisibility,
        preminePercent,
        description,
        lockDays,
        creatorWallet,
        rugshieldScore,
      } = body;

      if (!runeName || !runeSymbol || !supply || !creatorWallet) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Fetch current Runes info from Hiro to validate name availability
      const runesRes = await fetch(`${HIRO_API}/runes/v1/etchings?name=${encodeURIComponent(runeName)}`, {
        headers: { 'x-hiro-api-key': HIRO_API_KEY },
      });

      if (runesRes.ok) {
        const runesData = await runesRes.json();
        if (runesData.results && runesData.results.length > 0) {
          return new Response(JSON.stringify({ error: 'Rune name already taken' }), {
            status: 409,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // Fetch UTXOs for the creator wallet to build the PSBT
      const utxoRes = await fetch(`https://mempool.space/api/address/${creatorWallet}/utxo`);
      if (!utxoRes.ok) {
        throw new Error('Failed to fetch UTXOs from mempool.space');
      }
      const utxos = await utxoRes.json();

      if (!utxos || utxos.length === 0) {
        return new Response(JSON.stringify({ error: 'No UTXOs found — wallet needs BTC for fees' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get fee estimate
      const feeRes = await fetch('https://mempool.space/api/v1/fees/recommended');
      const fees = feeRes.ok ? await feeRes.json() : { halfHourFee: 10 };

      // Calculate premine amount
      const totalSupply = BigInt(supply);
      const premineAmount = totalSupply * BigInt(Math.round(preminePercent || 0)) / 100n;

      // Build etch parameters
      // Note: Actual PSBT construction for Rune etching requires specialized Bitcoin
      // script building. For now we prepare the parameters and save to DB.
      // Full PSBT construction would use ord/runestone encoding.
      const etchParams = {
        rune: runeName.replace(/•/g, ''),
        spacers: calculateSpacers(runeName),
        symbol: runeSymbol,
        supply: supply.toString(),
        divisibility: parseInt(divisibility) || 0,
        premine: premineAmount.toString(),
        feeRate: fees.halfHourFee,
        utxoCount: utxos.length,
        totalUtxoValue: utxos.reduce((sum: number, u: any) => sum + u.value, 0),
      };

      // Save token to DB as pending
      const { data: token, error: dbError } = await supabase
        .from('btc_tokens')
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
          status: 'pending',
        })
        .select()
        .single();

      if (dbError) throw new Error(`DB error: ${dbError.message}`);

      return new Response(JSON.stringify({
        success: true,
        tokenId: token.id,
        etchParams,
        message: 'Rune etch prepared. PSBT construction requires ord-compatible encoding — coming in next phase.',
        estimatedFee: {
          sats: etchParams.feeRate * 250,
          btc: (etchParams.feeRate * 250) / 1e8,
          feeRate: etchParams.feeRate,
        },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get Rune info ──
    if (action === 'get-rune') {
      const { runeId } = body;
      if (!runeId) {
        return new Response(JSON.stringify({ error: 'runeId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`${HIRO_API}/runes/v1/etchings/${encodeURIComponent(runeId)}`, {
        headers: { 'x-hiro-api-key': HIRO_API_KEY },
      });

      if (!res.ok) {
        throw new Error(`Hiro API returned ${res.status}`);
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── List recent Runes from Hiro ──
    if (action === 'list-runes') {
      const { offset = 0, limit = 20 } = body;
      const res = await fetch(`${HIRO_API}/runes/v1/etchings?offset=${offset}&limit=${limit}`, {
        headers: { 'x-hiro-api-key': HIRO_API_KEY },
      });

      if (!res.ok) throw new Error(`Hiro API returned ${res.status}`);
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get Rune holders ──
    if (action === 'get-holders') {
      const { runeId, offset = 0, limit = 20 } = body;
      if (!runeId) {
        return new Response(JSON.stringify({ error: 'runeId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(
        `${HIRO_API}/runes/v1/etchings/${encodeURIComponent(runeId)}/holders?offset=${offset}&limit=${limit}`,
        { headers: { 'x-hiro-api-key': HIRO_API_KEY } }
      );

      if (!res.ok) throw new Error(`Hiro API returned ${res.status}`);
      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('btc-rune-launch error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Calculate spacer bitfield from a name like "MY•RUNE•TOKEN"
function calculateSpacers(name: string): number {
  let spacers = 0;
  let letterIndex = 0;
  for (const char of name) {
    if (char === '•') {
      if (letterIndex > 0) {
        spacers |= (1 << (letterIndex - 1));
      }
    } else {
      letterIndex++;
    }
  }
  return spacers;
}
