import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Config
const SNIPER_BUY_SOL = 0.5;
const PRIORITY_FEE_LAMPORTS = 5_000_000; // 0.005 SOL total priority fee budget
const COMPUTE_UNITS = 400_000;
const RETRY_DELAY_MS = 500;
const MAX_REBROADCAST_ATTEMPTS = 10;

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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { poolAddress, mintAddress, tokenId, funTokenId } = await req.json();

    console.log('[fun-sniper-buy] Starting sniper buy:', { poolAddress, mintAddress });

    if (!poolAddress || !mintAddress) {
      throw new Error('Missing required fields: poolAddress, mintAddress');
    }

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

    // Parse sniper keypair
    const sniperSecretKey = await parsePrivateKey(sniperPrivateKey);

    // Import Solana web3
    const {
      Connection,
      Keypair,
      Transaction,
      ComputeBudgetProgram,
    } = await import('https://esm.sh/@solana/web3.js@1.98.0');

    let sniperKeypair: InstanceType<typeof Keypair>;
    if (sniperSecretKey.length === 64) {
      sniperKeypair = Keypair.fromSecretKey(sniperSecretKey);
    } else if (sniperSecretKey.length === 32) {
      sniperKeypair = Keypair.fromSeed(sniperSecretKey);
    } else {
      throw new Error(`Invalid secret key length: ${sniperSecretKey.length}`);
    }

    const sniperWallet = sniperKeypair.publicKey.toBase58();
    console.log('[fun-sniper-buy] Sniper wallet:', sniperWallet);

    // Create sniper trade record FIRST (so we always have forensic data)
    const { data: tradeData, error: tradeError } = await supabase.rpc('backend_create_sniper_trade', {
      p_token_id: tokenId || null,
      p_fun_token_id: funTokenId || null,
      p_mint_address: mintAddress,
      p_pool_address: poolAddress,
      p_buy_amount_sol: SNIPER_BUY_SOL,
    });

    if (tradeError) {
      console.error('[fun-sniper-buy] Failed to create trade record:', tradeError);
      throw new Error(`Failed to create trade record: ${tradeError.message}`);
    }

    const tradeId = tradeData;
    console.log('[fun-sniper-buy] Created trade record:', tradeId);

    const connection = new Connection(heliusRpcUrl, 'confirmed');

    // Get sniper balance
    const balance = await connection.getBalance(sniperKeypair.publicKey);
    const balanceSol = balance / 1_000_000_000;
    console.log('[fun-sniper-buy] Sniper balance:', balanceSol, 'SOL');

    // Leave headroom for fees
    if (balanceSol < SNIPER_BUY_SOL + 0.02) {
      const msg = `Insufficient sniper balance: ${balanceSol} SOL (need ${SNIPER_BUY_SOL + 0.02})`;
      await supabase.rpc('backend_fail_sniper_trade', { p_id: tradeId, p_error_message: msg });
      throw new Error(msg);
    }

    // Build swap transaction using Meteora API
    let meteoraApiUrl = Deno.env.get('METEORA_API_URL') || 'https://saturntrade.vercel.app';
    if (!meteoraApiUrl.startsWith('http')) {
      meteoraApiUrl = `https://${meteoraApiUrl}`;
    }

    const swapPayload = {
      mintAddress,
      userWallet: sniperWallet,
      amount: SNIPER_BUY_SOL,
      isBuy: true,
      slippageBps: 5000,
    };
    console.log('[fun-sniper-buy] Building swap transaction via Meteora API:', swapPayload);
    
    const swapResponse = await fetch(`${meteoraApiUrl}/api/swap/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(swapPayload),
    });

    const swapResult = await swapResponse.json();

    if (!swapResult.success && !swapResult.serializedTransaction && !swapResult.transaction) {
      console.error('[fun-sniper-buy] Swap build failed:', swapResult);
      const msg = swapResult.error || 'Failed to build swap transaction';
      await supabase.rpc('backend_fail_sniper_trade', { p_id: tradeId, p_error_message: msg });
      throw new Error(msg);
    }

    // Deserialize swap tx instructions
    const tx = new Transaction();

    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }));
    tx.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: Math.floor((PRIORITY_FEE_LAMPORTS * 1_000_000) / COMPUTE_UNITS),
      }),
    );

    // Support both fields (serializedTransaction preferred)
    const encodedTx = swapResult.serializedTransaction || swapResult.transaction;

    if (encodedTx) {
      const bs58 = await import('npm:bs58@6.0.0');
      const txBuffer = bs58.default.decode(encodedTx);
      const decodedTx = Transaction.from(txBuffer);
      for (const ix of decodedTx.instructions) {
        tx.add(ix);
      }
    }

    // Fresh blockhash
    const latest = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = latest.blockhash;
    tx.feePayer = sniperKeypair.publicKey;

    // Sign
    tx.sign(sniperKeypair);

    const rawTransaction = tx.serialize();

    // Retry loop with rebroadcasting (best practice for sniping)
    console.log('[fun-sniper-buy] Sending transaction with retry loop...');
    let signature: string | null = null;
    let landed = false;
    let attempts = 0;
    let lastError = '';

    let blockHeight = await connection.getBlockHeight();
    const lastValidBlockHeight = latest.lastValidBlockHeight - 10; // Buffer

    while (blockHeight < lastValidBlockHeight && !landed && attempts < MAX_REBROADCAST_ATTEMPTS) {
      attempts++;
      console.log(`[fun-sniper-buy] Attempt #${attempts}, block: ${blockHeight}, cutoff: ${lastValidBlockHeight}`);

      try {
        signature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: true,
          maxRetries: 0,
        });
        console.log(`[fun-sniper-buy] Sent tx, signature: ${signature}`);

        // Check status
        const status = await connection.getSignatureStatus(signature, {
          searchTransactionHistory: false,
        });

        if (
          status.value?.confirmationStatus === 'confirmed' ||
          status.value?.confirmationStatus === 'finalized'
        ) {
          console.log(`[fun-sniper-buy] ✅ Confirmed after ${attempts} attempt(s)!`);
          landed = true;
          break;
        }

        if (status.value?.err) {
          lastError = JSON.stringify(status.value.err);
          console.log(`[fun-sniper-buy] Transaction error: ${lastError}`);
          break;
        }
      } catch (sendErr) {
        lastError = sendErr instanceof Error ? sendErr.message : 'sendRawTransaction failed';
        console.error(`[fun-sniper-buy] Send error: ${lastError}`);
      }

      // Wait before next attempt
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
      blockHeight = await connection.getBlockHeight();
    }

    if (!landed || !signature) {
      const msg = lastError || 'Transaction not confirmed before blockhash expired';
      await supabase.rpc('backend_fail_sniper_trade', { p_id: tradeId, p_error_message: msg });
      throw new Error(msg);
    }

    console.log('[fun-sniper-buy] ✅ Sniper buy confirmed!');

    await supabase.rpc('backend_update_sniper_buy', {
      p_id: tradeId,
      p_buy_signature: signature,
      p_tokens_received: swapResult.estimatedOutput || 0,
    });

    return new Response(
      JSON.stringify({
        success: true,
        tradeId,
        signature,
        tokensReceived: swapResult.estimatedOutput,
        sniperWallet,
        attempts,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('[fun-sniper-buy] Error:', error);
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
