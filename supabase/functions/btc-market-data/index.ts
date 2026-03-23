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
      const res = await fetch(`${MEMPOOL_API}/v1/fees/recommended`);
      if (!res.ok) throw new Error(`mempool fees API returned ${res.status}`);
      const fees = await res.json();
      return new Response(JSON.stringify({
        fastestFee: fees.fastestFee,
        halfHourFee: fees.halfHourFee,
        hourFee: fees.hourFee,
        economyFee: fees.economyFee,
        minimumFee: fees.minimumFee,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'tx-status') {
      const txid = url.searchParams.get('txid');
      if (!txid) return new Response(JSON.stringify({ error: 'txid required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${MEMPOOL_API}/tx/${txid}`);
      if (!res.ok) throw new Error(`mempool tx API returned ${res.status}`);
      const tx = await res.json();
      return new Response(JSON.stringify({
        txid: tx.txid, confirmed: tx.status?.confirmed || false,
        blockHeight: tx.status?.block_height || null, blockTime: tx.status?.block_time || null,
        fee: tx.fee, size: tx.size, weight: tx.weight,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'address-utxos') {
      const address = url.searchParams.get('address');
      if (!address) return new Response(JSON.stringify({ error: 'address required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      const res = await fetch(`${MEMPOOL_API}/address/${address}/utxo`);
      if (!res.ok) throw new Error(`mempool utxo API returned ${res.status}`);
      const utxos = await res.json();
      return new Response(JSON.stringify({ utxos }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'block-tip') {
      const res = await fetch(`${MEMPOOL_API}/blocks/tip/height`);
      if (!res.ok) throw new Error(`mempool block tip API returned ${res.status}`);
      const height = await res.text();
      return new Response(JSON.stringify({ blockHeight: parseInt(height) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === NEW: Mempool stats ===
    if (action === 'mempool-stats') {
      const res = await fetch(`${MEMPOOL_API}/mempool`);
      if (!res.ok) throw new Error(`mempool stats API returned ${res.status}`);
      const data = await res.json();
      return new Response(JSON.stringify({
        count: data.count,
        vsize: data.vsize,
        total_fee: data.total_fee,
        fee_histogram: data.fee_histogram?.slice(0, 8),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === NEW: Hashrate & difficulty ===
    if (action === 'hashrate') {
      const [diffRes, adjRes] = await Promise.all([
        fetch(`${MEMPOOL_API}/v1/mining/hashrate/3m`),
        fetch(`${MEMPOOL_API}/v1/difficulty-adjustment`),
      ]);
      const hashData = diffRes.ok ? await diffRes.json() : null;
      const adjData = adjRes.ok ? await adjRes.json() : null;

      // Get current hashrate from the latest entry
      const currentHashrate = hashData?.currentHashrate || hashData?.hashrates?.[0]?.avgHashrate || null;
      const currentDifficulty = hashData?.currentDifficulty || null;

      return new Response(JSON.stringify({
        hashrate: currentHashrate,
        difficulty: currentDifficulty,
        difficultyChange: adjData?.difficultyChange || null,
        estimatedRetargetDate: adjData?.estimatedRetargetDate || null,
        remainingBlocks: adjData?.remainingBlocks || null,
        remainingTime: adjData?.remainingTime || null,
        progressPercent: adjData?.progressPercent || null,
        previousRetarget: adjData?.previousRetarget || null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === NEW: Recent blocks ===
    if (action === 'recent-blocks') {
      const res = await fetch(`${MEMPOOL_API}/v1/blocks`);
      if (!res.ok) throw new Error(`mempool blocks API returned ${res.status}`);
      const blocks = await res.json();
      // Return first 6 blocks
      const trimmed = blocks.slice(0, 6).map((b: any) => ({
        height: b.height,
        hash: b.id,
        timestamp: b.timestamp,
        tx_count: b.tx_count,
        size: b.size,
        weight: b.weight,
        pool: b.extras?.pool?.name || 'Unknown',
        reward: b.extras?.reward || null,
        totalFees: b.extras?.totalFees || null,
      }));
      return new Response(JSON.stringify({ blocks: trimmed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === NEW: Supply metrics ===
    if (action === 'supply') {
      // Bitcoin supply constants
      const TOTAL_SUPPLY = 21_000_000;
      const HALVING_INTERVAL = 210_000;
      
      // Get current block height
      const tipRes = await fetch(`${MEMPOOL_API}/blocks/tip/height`);
      if (!tipRes.ok) throw new Error(`block tip failed`);
      const currentHeight = parseInt(await tipRes.text());
      
      // Calculate current epoch & subsidy
      const epoch = Math.floor(currentHeight / HALVING_INTERVAL);
      const subsidySats = Math.floor(50 * 1e8 / Math.pow(2, epoch));
      const subsidyBtc = subsidySats / 1e8;
      
      // Calculate circulating supply
      let circulating = 0;
      for (let e = 0; e <= epoch; e++) {
        const blocksInEpoch = e < epoch ? HALVING_INTERVAL : (currentHeight - e * HALVING_INTERVAL);
        circulating += blocksInEpoch * (50 / Math.pow(2, e));
      }
      
      // Next halving
      const nextHalvingBlock = (epoch + 1) * HALVING_INTERVAL;
      const blocksUntilHalving = nextHalvingBlock - currentHeight;
      const minutesUntilHalving = blocksUntilHalving * 10;
      const halvingEstimateMs = Date.now() + minutesUntilHalving * 60_000;
      
      return new Response(JSON.stringify({
        totalSupply: TOTAL_SUPPLY,
        circulatingSupply: Math.min(circulating, TOTAL_SUPPLY),
        percentMined: ((circulating / TOTAL_SUPPLY) * 100).toFixed(4),
        currentSubsidy: subsidyBtc,
        currentEpoch: epoch,
        currentHeight,
        nextHalvingBlock,
        blocksUntilHalving,
        halvingEstimateDate: new Date(halvingEstimateMs).toISOString(),
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ 
      error: 'Unknown action. Use: fees, tx-status, address-utxos, block-tip, mempool-stats, hashrate, recent-blocks, supply' 
    }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('btc-market-data error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
