import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Parse private key (Base58 or JSON array)
async function parsePrivateKey(raw: string): Promise<Uint8Array> {
  const trimmed = raw.trim();
  console.log(`[parsePrivateKey] Raw length: ${raw.length}, trimmed length: ${trimmed.length}`);

  // Try JSON array first (if it starts with "[")
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed);
      const bytes = new Uint8Array(arr);
      console.log(`[parsePrivateKey] JSON array decoded length: ${bytes.length}`);
      if (bytes.length === 64 || bytes.length === 32) {
        return bytes;
      }
    } catch (e) {
      console.log(`[parsePrivateKey] JSON parse failed: ${e instanceof Error ? e.message : e}`);
    }
  }

  // Try Base58 using npm:bs58 (more reliable than deno.land/x/base58)
  try {
    const bs58 = await import('npm:bs58@6.0.0');
    const decoded = bs58.default.decode(trimmed);
    console.log(`[parsePrivateKey] bs58 decoded length: ${decoded.length}`);
    if (decoded.length === 64 || decoded.length === 32) {
      return decoded;
    }
    console.log(`[parsePrivateKey] bs58 decoded but wrong length: ${decoded.length}`);
  } catch (e) {
    console.log(`[parsePrivateKey] bs58 decode failed: ${e instanceof Error ? e.message : e}`);
  }

  throw new Error(`Invalid private key format. Length=${trimmed.length}`);
}

async function getWalletFromPrivateKey(privateKey: string): Promise<{ wallet: string; keypair: any }> {
  const secret = await parsePrivateKey(privateKey);
  const { Keypair } = await import('https://esm.sh/@solana/web3.js@1.98.0');

  let kp: InstanceType<typeof Keypair>;
  if (secret.length === 64) {
    kp = Keypair.fromSecretKey(secret);
  } else if (secret.length === 32) {
    kp = Keypair.fromSeed(secret);
  } else {
    throw new Error(`Invalid secret key length: ${secret.length}`);
  }

  return { wallet: kp.publicKey.toBase58(), keypair: kp };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[fun-sniper-sell] Starting auto-sell process');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sniperPrivateKey = Deno.env.get('SNIPER_PRIVATE_KEY');
    const heliusRpcUrl = Deno.env.get('HELIUS_RPC_URL');

    if (!sniperPrivateKey) {
      throw new Error('SNIPER_PRIVATE_KEY not configured');
    }

    if (!heliusRpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    const { wallet: sniperWallet } = await getWalletFromPrivateKey(sniperPrivateKey);
    console.log('[fun-sniper-sell] Sniper wallet:', sniperWallet);

    // Get trades that are ready to sell (bought and past scheduled sell time)
    const { data: tradesToSell, error: fetchError } = await supabase
      .from('sniper_trades')
      .select('*')
      .eq('status', 'bought')
      .lte('scheduled_sell_at', new Date().toISOString())
      .limit(10);

    if (fetchError) {
      throw new Error(`Failed to fetch trades: ${fetchError.message}`);
    }

    if (!tradesToSell || tradesToSell.length === 0) {
      console.log('[fun-sniper-sell] No trades ready to sell');
      return new Response(JSON.stringify({ success: true, message: 'No trades to sell', sold: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[fun-sniper-sell] Found ${tradesToSell.length} trades to sell`);

    const results: any[] = [];

    for (const trade of tradesToSell) {
      try {
        console.log(`[fun-sniper-sell] Processing trade ${trade.id} for pool ${trade.pool_address}`);

        const tokensToSell = Number(trade.tokens_received || 0);
        if (!tokensToSell || tokensToSell <= 0) {
          throw new Error('No tokens_received recorded; cannot sell');
        }

        // Call Meteora API to execute sell (server-side sign)
        let meteoraApiUrl = Deno.env.get('METEORA_API_URL') || 'https://saturntrade.vercel.app';
        if (!meteoraApiUrl.startsWith('http')) {
          meteoraApiUrl = `https://${meteoraApiUrl}`;
        }

        const sellResponse = await fetch(`${meteoraApiUrl}/api/swap/execute`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            poolAddress: trade.pool_address,
            userWallet: sniperWallet,
            amount: tokensToSell,
            isBuy: false,
            slippageBps: 5000, // 50% slippage for fast execution
            serverSideSign: true,
            sniperPrivateKey,
            priorityFee: 0.01,
          }),
        });

        const sellResult = await sellResponse.json();

        if (sellResult.success) {
          await supabase.rpc('backend_update_sniper_sell', {
            p_id: trade.id,
            p_sell_signature: sellResult.signature || 'executed',
            p_sell_slot: sellResult.slot || null,
            p_sol_received: sellResult.solReceived || 0,
          });

          results.push({ tradeId: trade.id, success: true, signature: sellResult.signature });
          console.log(`[fun-sniper-sell] Sold trade ${trade.id}, signature: ${sellResult.signature}`);
        } else {
          throw new Error(sellResult.error || 'Sell failed');
        }
      } catch (tradeError) {
        console.error(`[fun-sniper-sell] Error selling trade ${trade.id}:`, tradeError);

        await supabase.rpc('backend_fail_sniper_trade', {
          p_id: trade.id,
          p_error_message: tradeError instanceof Error ? tradeError.message : 'Unknown error',
        });

        results.push({ tradeId: trade.id, success: false, error: (tradeError as Error).message });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[fun-sniper-sell] Completed: ${successCount}/${tradesToSell.length} sells succeeded`);

    return new Response(
      JSON.stringify({
        success: true,
        sold: successCount,
        total: tradesToSell.length,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[fun-sniper-sell] Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  }
});
