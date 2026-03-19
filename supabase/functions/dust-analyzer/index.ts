import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const HELIUS_API_KEY = Deno.env.get("HELIUS_API_KEY");
    const body = await req.json();
    const { address, limit = 100 } = body;

    // Step 1: Get recent signatures
    const sigsRes = await fetch(
      `https://api.helius.xyz/v0/addresses/${address}/transactions?api-key=${HELIUS_API_KEY}&limit=${Math.min(limit, 100)}`
    );
    const txs = await sigsRes.json();

    if (!Array.isArray(txs) || txs.length === 0) {
      return new Response(JSON.stringify({ error: "No transactions found", txs: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Analyze patterns
    const analysis = {
      totalFetched: txs.length,
      transactions: txs.slice(0, 20).map((tx: any) => ({
        signature: tx.signature,
        type: tx.type,
        timestamp: tx.timestamp,
        fee: tx.fee,
        feePayer: tx.feePayer,
        source: tx.source,
        description: tx.description,
        // Native transfers
        nativeTransfers: tx.nativeTransfers?.map((nt: any) => ({
          from: nt.fromUserAccount,
          to: nt.toUserAccount,
          amount_sol: nt.amount / 1e9,
        })),
        // Token transfers
        tokenTransfers: tx.tokenTransfers?.map((tt: any) => ({
          from: tt.fromUserAccount,
          to: tt.toUserAccount,
          mint: tt.mint,
          amount: tt.tokenAmount,
          tokenStandard: tt.tokenStandard,
        })),
        // Account data
        accountData: tx.accountData?.slice(0, 5).map((a: any) => ({
          account: a.account,
          nativeChange: a.nativeBalanceChange / 1e9,
        })),
        // Instructions count
        instructionCount: tx.instructions?.length || 0,
        innerInstructionCount: tx.innerInstructions?.length || 0,
      })),
      // Timing analysis
      timingAnalysis: (() => {
        const timestamps = txs.map((t: any) => t.timestamp).filter(Boolean).sort((a: number, b: number) => a - b);
        const gaps: number[] = [];
        for (let i = 1; i < timestamps.length; i++) {
          gaps.push(timestamps[i] - timestamps[i - 1]);
        }
        const avgGap = gaps.length ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;
        const minGap = gaps.length ? Math.min(...gaps) : 0;
        const maxGap = gaps.length ? Math.max(...gaps) : 0;
        
        // Count unique recipients
        const recipients = new Set<string>();
        txs.forEach((tx: any) => {
          tx.nativeTransfers?.forEach((nt: any) => {
            if (nt.toUserAccount !== address) recipients.add(nt.toUserAccount);
          });
          tx.tokenTransfers?.forEach((tt: any) => {
            if (tt.toUserAccount !== address) recipients.add(tt.toUserAccount);
          });
        });

        // Count transfers per TX
        const transfersPerTx = txs.map((tx: any) => 
          (tx.nativeTransfers?.length || 0) + (tx.tokenTransfers?.length || 0)
        );
        const avgTransfers = transfersPerTx.length 
          ? transfersPerTx.reduce((a: number, b: number) => a + b, 0) / transfersPerTx.length 
          : 0;

        return {
          avgGapSeconds: avgGap,
          minGapSeconds: minGap,
          maxGapSeconds: maxGap,
          estimatedTxPerHour: avgGap > 0 ? Math.round(3600 / avgGap) : 0,
          estimatedTxPerDay: avgGap > 0 ? Math.round(86400 / avgGap) : 0,
          uniqueRecipientsInSample: recipients.size,
          avgTransfersPerTx: avgTransfers,
          maxTransfersPerTx: Math.max(...transfersPerTx),
          feeRange: {
            min: Math.min(...txs.map((t: any) => t.fee || 0)),
            max: Math.max(...txs.map((t: any) => t.fee || 0)),
            avg: txs.reduce((a: number, t: any) => a + (t.fee || 0), 0) / txs.length,
          },
          timeSpanMinutes: timestamps.length >= 2 
            ? ((timestamps[timestamps.length - 1] - timestamps[0]) / 60).toFixed(1) 
            : 0,
        };
      })(),
    };

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
