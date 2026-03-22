import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ME_API = 'https://api-mainnet.magiceden.dev/v2';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // Magic Eden Ordinals API is free (30 QPM without key, higher with key)
    const MAGIC_EDEN_API_KEY = Deno.env.get('MAGIC_EDEN_API_KEY');
    const meHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (MAGIC_EDEN_API_KEY) {
      meHeaders['Authorization'] = `Bearer ${MAGIC_EDEN_API_KEY}`;
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // ── Get Rune orderbook (listings) ──
    if (action === 'get-listings') {
      const { runeId, offset = 0, limit = 20 } = body;
      if (!runeId) {
        return new Response(JSON.stringify({ error: 'runeId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(
        `${ME_API}/ord/btc/runes/orders/${encodeURIComponent(runeId)}?offset=${offset}&limit=${limit}&side=sell&sortBy=unitPriceAsc&status=active`,
        { headers: meHeaders }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Magic Eden API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get Rune market info ──
    if (action === 'get-rune-info') {
      const { runeId } = body;
      if (!runeId) {
        return new Response(JSON.stringify({ error: 'runeId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(
        `${ME_API}/ord/btc/runes/market/${encodeURIComponent(runeId)}/info`,
        { headers: meHeaders }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Magic Eden API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Get best offer for a Rune ──
    if (action === 'get-best-offer') {
      const { runeId } = body;
      if (!runeId) {
        return new Response(JSON.stringify({ error: 'runeId required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(
        `${ME_API}/ord/btc/runes/orders/${encodeURIComponent(runeId)}?side=buy&sortBy=unitPriceDesc&status=active&limit=1`,
        { headers: meHeaders }
      );

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Magic Eden API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Prepare buy PSBT ──
    if (action === 'prepare-buy') {
      const { orderId, buyerAddress, buyerPublicKey } = body;
      if (!orderId || !buyerAddress || !buyerPublicKey) {
        return new Response(JSON.stringify({ error: 'orderId, buyerAddress, buyerPublicKey required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get fee estimate for PSBT
      const feeRes = await fetch('https://mempool.space/api/v1/fees/recommended');
      const fees = feeRes.ok ? await feeRes.json() : { halfHourFee: 10 };

      const res = await fetch(`${ME_API}/ord/btc/runes/psbt/order/fulfill`, {
        method: 'POST',
        headers: meHeaders,
        body: JSON.stringify({
          orderId,
          buyerAddress,
          buyerPublicKey,
          feeRate: fees.halfHourFee,
          // 1% platform fee (100 bps)
          makerFeeBp: 0,
          takerFeeBp: 100,
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Magic Eden fulfill API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return new Response(JSON.stringify({
        ...data,
        feeRate: fees.halfHourFee,
        platformFeeBps: 100,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Submit signed PSBT ──
    if (action === 'submit-tx') {
      const { signedPsbt, btcTokenId, traderWallet, side, amount, btcAmount } = body;
      if (!signedPsbt) {
        return new Response(JSON.stringify({ error: 'signedPsbt required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Broadcast via mempool.space
      const broadcastRes = await fetch('https://mempool.space/api/tx', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: signedPsbt,
      });

      if (!broadcastRes.ok) {
        const errText = await broadcastRes.text();
        throw new Error(`Broadcast failed: ${errText}`);
      }

      const txHash = await broadcastRes.text();

      // Record trade in DB
      if (btcTokenId && traderWallet) {
        await supabase.from('btc_trades').insert({
          btc_token_id: btcTokenId,
          trader_wallet: traderWallet,
          side: side || 'buy',
          amount: amount || 0,
          btc_amount: btcAmount || 0,
          tx_hash: txHash,
          status: 'pending',
        });
      }

      return new Response(JSON.stringify({ txHash, status: 'broadcast' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Create sell listing ──
    if (action === 'create-listing') {
      const { runeId, sellerAddress, sellerPublicKey, amount, unitPrice } = body;
      if (!runeId || !sellerAddress || !amount || !unitPrice) {
        return new Response(JSON.stringify({ error: 'runeId, sellerAddress, amount, unitPrice required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const feeRes = await fetch('https://mempool.space/api/v1/fees/recommended');
      const fees = feeRes.ok ? await feeRes.json() : { halfHourFee: 10 };

      const res = await fetch(`${ME_API}/ord/btc/runes/psbt/order/create`, {
        method: 'POST',
        headers: meHeaders,
        body: JSON.stringify({
          side: 'sell',
          runeId,
          sellerAddress,
          sellerPublicKey,
          amount: amount.toString(),
          unitPrice: unitPrice.toString(),
          feeRate: fees.halfHourFee,
          makerFeeBp: 100, // 1% platform fee
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Magic Eden create order API returned ${res.status}: ${errText}`);
      }

      const data = await res.json();
      return new Response(JSON.stringify({
        ...data,
        feeRate: fees.halfHourFee,
        platformFeeBps: 100,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Unknown action. Use: get-listings, get-rune-info, get-best-offer, prepare-buy, submit-tx, create-listing' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('btc-trade error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
