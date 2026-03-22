import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MEMPOOL_API = 'https://mempool.space/api';

interface RiskAnalysis {
  address: string;
  walletAge: string | null;
  totalTxCount: number;
  totalReceived: number;
  totalSent: number;
  fundedTxCount: number;
  spentTxCount: number;
  firstSeenBlock: number | null;
  riskScore: number; // 0-100, lower is safer
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  warnings: string[];
  positives: string[];
}

function calculateRiskScore(
  txCount: number,
  walletAgeDays: number | null,
  totalReceived: number,
  totalSent: number,
): { score: number; level: 'low' | 'medium' | 'high' | 'critical'; warnings: string[]; positives: string[] } {
  let score = 50; // Start neutral
  const warnings: string[] = [];
  const positives: string[] = [];

  // Wallet age analysis
  if (walletAgeDays === null || walletAgeDays < 1) {
    score += 30;
    warnings.push('Brand new wallet — no on-chain history');
  } else if (walletAgeDays < 7) {
    score += 20;
    warnings.push(`Wallet is only ${walletAgeDays} day(s) old`);
  } else if (walletAgeDays < 30) {
    score += 10;
    warnings.push('Wallet is less than 30 days old');
  } else if (walletAgeDays >= 180) {
    score -= 15;
    positives.push(`Wallet is ${walletAgeDays}+ days old — established`);
  } else if (walletAgeDays >= 30) {
    score -= 5;
    positives.push(`Wallet is ${walletAgeDays} days old`);
  }

  // Transaction count
  if (txCount === 0) {
    score += 20;
    warnings.push('Zero transaction history');
  } else if (txCount < 5) {
    score += 10;
    warnings.push('Very low transaction count');
  } else if (txCount >= 50) {
    score -= 15;
    positives.push(`${txCount} transactions — active wallet`);
  } else if (txCount >= 10) {
    score -= 5;
    positives.push(`${txCount} transactions`);
  }

  // Volume analysis (in sats)
  const totalVolumeBtc = (totalReceived + totalSent) / 1e8;
  if (totalVolumeBtc > 10) {
    score -= 10;
    positives.push(`${totalVolumeBtc.toFixed(2)} BTC total volume — whale wallet`);
  } else if (totalVolumeBtc > 1) {
    score -= 5;
    positives.push(`${totalVolumeBtc.toFixed(4)} BTC total volume`);
  } else if (totalVolumeBtc < 0.001 && txCount > 0) {
    score += 5;
    warnings.push('Very low volume relative to activity');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  let level: 'low' | 'medium' | 'high' | 'critical';
  if (score <= 25) level = 'low';
  else if (score <= 50) level = 'medium';
  else if (score <= 75) level = 'high';
  else level = 'critical';

  return { score, level, warnings, positives };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { address } = await req.json();
    if (!address || typeof address !== 'string') {
      return new Response(JSON.stringify({ error: 'address is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch address stats from mempool.space
    const [statsRes, txsRes] = await Promise.all([
      fetch(`${MEMPOOL_API}/address/${address}`),
      fetch(`${MEMPOOL_API}/address/${address}/txs`),
    ]);

    if (!statsRes.ok) {
      // If 404, it's a valid address with no history
      if (statsRes.status === 404) {
        const analysis: RiskAnalysis = {
          address,
          walletAge: null,
          totalTxCount: 0,
          totalReceived: 0,
          totalSent: 0,
          fundedTxCount: 0,
          spentTxCount: 0,
          firstSeenBlock: null,
          riskScore: 95,
          riskLevel: 'critical',
          warnings: ['Address has never appeared on-chain'],
          positives: [],
        };
        return new Response(JSON.stringify(analysis), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      throw new Error(`mempool.space returned ${statsRes.status}`);
    }

    const stats = await statsRes.json();
    const txs = txsRes.ok ? await txsRes.json() : [];

    const chainStats = stats.chain_stats || {};
    const mempoolStats = stats.mempool_stats || {};
    
    const totalTxCount = (chainStats.tx_count || 0) + (mempoolStats.tx_count || 0);
    const totalReceived = (chainStats.funded_txo_sum || 0) + (mempoolStats.funded_txo_sum || 0);
    const totalSent = (chainStats.spent_txo_sum || 0) + (mempoolStats.spent_txo_sum || 0);
    const fundedTxCount = chainStats.funded_txo_count || 0;
    const spentTxCount = chainStats.spent_txo_count || 0;

    // Find earliest tx for wallet age
    let firstSeenBlock: number | null = null;
    let walletAgeDays: number | null = null;
    let walletAge: string | null = null;

    if (txs.length > 0) {
      const confirmedTxs = txs.filter((tx: any) => tx.status?.confirmed && tx.status?.block_time);
      if (confirmedTxs.length > 0) {
        const earliest = confirmedTxs.reduce((min: any, tx: any) => 
          tx.status.block_time < min.status.block_time ? tx : min
        );
        firstSeenBlock = earliest.status.block_height;
        const firstSeenTime = earliest.status.block_time * 1000;
        walletAgeDays = Math.floor((Date.now() - firstSeenTime) / (1000 * 60 * 60 * 24));
        
        if (walletAgeDays >= 365) {
          walletAge = `${Math.floor(walletAgeDays / 365)}y ${walletAgeDays % 365}d`;
        } else {
          walletAge = `${walletAgeDays}d`;
        }
      }
    }

    const { score, level, warnings, positives } = calculateRiskScore(
      totalTxCount,
      walletAgeDays,
      totalReceived,
      totalSent,
    );

    const analysis: RiskAnalysis = {
      address,
      walletAge,
      totalTxCount,
      totalReceived,
      totalSent,
      fundedTxCount,
      spentTxCount,
      firstSeenBlock,
      riskScore: score,
      riskLevel: level,
      warnings,
      positives,
    };

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('RugShield error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
