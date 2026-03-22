import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEMPOOL_API = 'https://mempool.space/api';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    if (action === 'fees') {
      // Get current fee estimates
      const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
      if (!res.ok) throw new Error(`mempool fees API returned ${res.status}`);
      const fees = await res.json();
      
      return new Response(JSON.stringify({
        fastestFee: fees.fastestFee,
        halfHourFee: fees.halfHourFee,
        hourFee: fees.hourFee,
        economyFee: fees.economyFee,
        minimumFee: fees.minimumFee,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'tx-status') {
      const txid = url.searchParams.get('txid');
      if (!txid) {
        return new Response(JSON.stringify({ error: 'txid required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`${MEMPOOL_API}/tx/${txid}`);
      if (!res.ok) throw new Error(`mempool tx API returned ${res.status}`);
      const tx = await res.json();

      return new Response(JSON.stringify({
        txid: tx.txid,
        confirmed: tx.status?.confirmed || false,
        blockHeight: tx.status?.block_height || null,
        blockTime: tx.status?.block_time || null,
        fee: tx.fee,
        size: tx.size,
        weight: tx.weight,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'address-utxos') {
      const address = url.searchParams.get('address');
      if (!address) {
        return new Response(JSON.stringify({ error: 'address required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
      if (!res.ok) throw new Error(`mempool utxo API returned ${res.status}`);
      const utxos = await res.json();

      return new Response(JSON.stringify({ utxos }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'block-tip') {
      const res = await fetch(`${MEMPOOL_API}/blocks/tip/height`);
      if (!res.ok) throw new Error(`mempool block tip API returned ${res.status}`);
      const height = await res.text();

      return new Response(JSON.stringify({ blockHeight: parseInt(height) }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown action. Use: fees, tx-status, address-utxos, block-tip' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('btc-market-data error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
