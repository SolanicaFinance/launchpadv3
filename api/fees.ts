import type { VercelRequest, VercelResponse } from '@vercel/node';
import { PublicKey } from '@solana/web3.js';
import { CpAmm, deriveTokenVaultAddress } from '@meteora-ag/cp-amm-sdk';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { PLATFORM_FEE_WALLET } from '../../lib/config.js';
import { getSupabaseClient } from '../../lib/supabase.js';
import { getConnection, getTreasuryKeypair } from '../../lib/solana.js';
import { claimPartnerFees, getClaimableFees } from '../../lib/meteora.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    res.setHeader(key, value);
  });

  if (req.method === 'OPTIONS') {
    return res.status(200).json({});
  }

  // Route based on path
  const path = req.url?.split('?')[0] || '';

  if (path.includes('/api/fees/claim-damm-fees')) {
    return handleClaimDammFees(req, res);
  } else if (path.includes('/api/fees/claim-from-pool')) {
    return handleClaimFromPool(req, res);
  } else if (path.includes('/api/fees/claim')) {
    return handleClaim(req, res);
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}

/**
 * Legacy fee claim endpoint - redirects to pool-based claiming
 * POST /api/fees/claim
 */
async function handleClaim(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenId, walletAddress, profileId } = req.body;
    console.log('[fees/claim] Request:', { tokenId, walletAddress, profileId });

    if (!tokenId || !walletAddress) {
      return res.status(400).json({
        error: 'Missing required fields: tokenId, walletAddress',
      });
    }

    const supabase = getSupabaseClient();

    // Find fee earner record
    let earner = null;

    const { data: earnerByWallet } = await supabase
      .from('fee_earners')
      .select('*')
      .eq('token_id', tokenId)
      .eq('wallet_address', walletAddress)
      .single();

    if (earnerByWallet) {
      earner = earnerByWallet;
    } else if (profileId) {
      const { data: earnerByProfile } = await supabase
        .from('fee_earners')
        .select('*')
        .eq('token_id', tokenId)
        .eq('profile_id', profileId)
        .single();

      if (earnerByProfile) {
        earner = earnerByProfile;
      }
    }

    if (!earner) {
      return res.status(404).json({ error: 'You are not a fee earner for this token' });
    }

    // Check if this is a creator trying to claim
    if (earner.earner_type === 'creator') {
      return res.status(400).json({
        error: 'Creator fees are no longer distributed. All trading fees go to platform treasury.',
        info: 'The 2% trading fee is collected by the treasury wallet for platform operations.',
        treasuryWallet: PLATFORM_FEE_WALLET,
      });
    }

    // Check if this is the system/treasury
    if (earner.earner_type === 'system') {
      const { data: token } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single();

      if (!token) {
        return res.status(404).json({ error: 'Token not found' });
      }

      // Redirect to appropriate claim endpoint
      if (token.status === 'graduated' && token.migration_status === 'damm_v2_active') {
        return res.status(400).json({
          error: 'Use the DAMM V2 claim endpoint for graduated tokens',
          redirect: '/api/fees/claim-damm-fees',
          poolAddress: token.damm_pool_address || token.dbc_pool_address,
        });
      } else {
        return res.status(400).json({
          error: 'Use the pool claim endpoint for active tokens',
          redirect: '/api/fees/claim-from-pool',
          poolAddress: token.dbc_pool_address,
        });
      }
    }

    return res.status(400).json({
      error: 'Unknown earner type',
      earnerType: earner.earner_type,
    });
  } catch (error) {
    console.error('[fees/claim] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Claim fees from Meteora DBC pools (pre-graduation)
 * GET /api/fees/claim-from-pool?poolAddress=...
 * POST /api/fees/claim-from-pool
 */
async function handleClaimFromPool(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const { poolAddress } = req.query;

      if (!poolAddress || typeof poolAddress !== 'string') {
        return res.status(400).json({ error: 'poolAddress query parameter required' });
      }

      const fees = await getClaimableFees(poolAddress);

      return res.status(200).json({
        success: true,
        poolAddress,
        claimableSol: fees.partnerQuoteFee,
        claimableTokens: fees.partnerBaseFee,
        totalTradingFee: fees.totalTradingFee,
      });
    } catch (error) {
      console.error('[fees/claim-from-pool] GET Error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { poolAddress, tokenId, isFunToken } = req.body;
    console.log('[fees/claim-from-pool] Request:', { poolAddress, tokenId, isFunToken });

    if (!poolAddress) {
      return res.status(400).json({ error: 'poolAddress is required' });
    }

    const supabase = getSupabaseClient();

    // Determine which table to query
    let token = null;
    let tokenTable = 'tokens';

    if (isFunToken) {
      tokenTable = 'fun_tokens';
      if (tokenId) {
        const { data } = await supabase
          .from('fun_tokens')
          .select('*')
          .eq('id', tokenId)
          .single();
        token = data;
      } else {
        const { data } = await supabase
          .from('fun_tokens')
          .select('*')
          .eq('dbc_pool_address', poolAddress)
          .single();
        token = data;
      }
    } else {
      if (tokenId) {
        const { data } = await supabase
          .from('tokens')
          .select('*')
          .eq('id', tokenId)
          .single();
        token = data;
      } else {
        const { data } = await supabase
          .from('tokens')
          .select('*')
          .eq('dbc_pool_address', poolAddress)
          .single();
        token = data;
      }

      if (!token) {
        tokenTable = 'fun_tokens';
        if (tokenId) {
          const { data } = await supabase
            .from('fun_tokens')
            .select('*')
            .eq('id', tokenId)
            .single();
          token = data;
        } else {
          const { data } = await supabase
            .from('fun_tokens')
            .select('*')
            .eq('dbc_pool_address', poolAddress)
            .single();
          token = data;
        }
      }
    }

    if (!token) {
      return res.status(404).json({ error: 'Token not found in tokens or fun_tokens table' });
    }

    console.log(`[fees/claim-from-pool] Found token in ${tokenTable}:`, token.name || token.ticker);

    // Check if pool is graduated
    if (tokenTable === 'tokens' && token.status === 'graduated' && token.migration_status === 'damm_v2_active') {
      return res.status(400).json({
        error: 'Pool has graduated. Use DAMM V2 claim endpoint.',
        useEndpoint: '/api/fees/claim-damm-fees',
      });
    }

    console.log('[fees/claim-from-pool] Claiming fees from pool...');
    const { signature, claimedSol } = await claimPartnerFees(poolAddress);

    console.log('[fees/claim-from-pool] Fees claimed:', { signature, claimedSol });

    // Record the claim
    if (tokenTable === 'fun_tokens') {
      await supabase.from('fun_fee_claims').insert({
        fun_token_id: token.id,
        pool_address: poolAddress,
        signature,
        claimed_sol: claimedSol,
        claimed_at: new Date().toISOString(),
      });

      await supabase
        .from('fun_tokens')
        .update({
          total_fees_earned: (token.total_fees_earned || 0) + claimedSol,
          updated_at: new Date().toISOString(),
        })
        .eq('id', token.id);
    } else {
      await supabase.from('fee_pool_claims').insert({
        token_id: token.id,
        pool_address: poolAddress,
        signature,
        claimed_sol: claimedSol,
        claimed_at: new Date().toISOString(),
        processed: true,
        processed_at: new Date().toISOString(),
      });

      const { data: systemEarner } = await supabase
        .from('fee_earners')
        .select('*')
        .eq('token_id', token.id)
        .eq('earner_type', 'system')
        .single();

      if (systemEarner) {
        await supabase
          .from('fee_earners')
          .update({
            unclaimed_sol: 0,
            last_claimed_at: new Date().toISOString(),
          })
          .eq('id', systemEarner.id);
      }
    }

    return res.status(200).json({
      success: true,
      signature,
      claimedSol,
      poolAddress,
      tokenId: token.id,
      tokenTable,
      treasuryWallet: PLATFORM_FEE_WALLET,
    });
  } catch (error) {
    console.error('[fees/claim-from-pool] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * Claim fees from DAMM V2 LP positions (post-graduation)
 * GET /api/fees/claim-damm-fees
 * POST /api/fees/claim-damm-fees
 */
async function handleClaimDammFees(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    try {
      const connection = getConnection();
      const treasury = getTreasuryKeypair();
      const cpAmm = new CpAmm(connection);

      const positions = await cpAmm.getPositionsByUser(treasury.publicKey);

      const positionData = await Promise.all(
        positions.map(async (pos) => {
          const poolState = await cpAmm.fetchPoolState(pos.positionState.pool);

          return {
            position: pos.position.toBase58(),
            positionNftAccount: pos.positionNftAccount.toBase58(),
            pool: pos.positionState.pool.toBase58(),
            liquidity: pos.positionState.unlockedLiquidity.toString(),
            tokenAMint: poolState.tokenAMint.toBase58(),
            tokenBMint: poolState.tokenBMint.toBase58(),
            feeAOwed: pos.positionState.feeAPending?.toString() || '0',
            feeBOwed: pos.positionState.feeBPending?.toString() || '0',
          };
        })
      );

      return res.status(200).json({
        success: true,
        treasuryWallet: PLATFORM_FEE_WALLET,
        positionCount: positions.length,
        positions: positionData,
      });
    } catch (error) {
      console.error('[fees/claim-damm-fees] GET Error:', error);
      return res.status(500).json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tokenId, dammPoolAddress, positionAddress } = req.body;

    console.log('[fees/claim-damm-fees] Request:', { tokenId, dammPoolAddress, positionAddress });

    if (!tokenId && !dammPoolAddress && !positionAddress) {
      return res.status(400).json({
        error: 'Either tokenId, dammPoolAddress, or positionAddress is required',
      });
    }

    const supabase = getSupabaseClient();
    const connection = getConnection();
    const treasury = getTreasuryKeypair();
    const cpAmm = new CpAmm(connection);

    // Get token if provided
    let token = null;
    if (tokenId) {
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('id', tokenId)
        .single();
      token = data;
    } else if (dammPoolAddress) {
      const { data } = await supabase
        .from('tokens')
        .select('*')
        .eq('damm_pool_address', dammPoolAddress)
        .single();
      token = data;
    }

    if (token) {
      if (token.status !== 'graduated' || token.migration_status !== 'damm_v2_active') {
        return res.status(400).json({
          error: 'Token has not graduated to DAMM V2 yet',
          currentStatus: token.status,
          migrationStatus: token.migration_status,
        });
      }
    }

    console.log('[fees/claim-damm-fees] Fetching treasury positions...');
    const positions = await cpAmm.getPositionsByUser(treasury.publicKey);

    if (positions.length === 0) {
      return res.status(400).json({
        error: 'No LP positions found for treasury wallet',
        treasuryWallet: PLATFORM_FEE_WALLET,
      });
    }

    // Find the correct position
    let targetPosition = null;
    const poolAddress = token?.damm_pool_address || token?.dbc_pool_address || dammPoolAddress;

    if (positionAddress) {
      targetPosition = positions.find((p) => p.position.toBase58() === positionAddress);
    } else if (poolAddress) {
      targetPosition = positions.find((p) => p.positionState.pool.toBase58() === poolAddress);
    }

    if (!targetPosition) {
      return res.status(404).json({
        error: 'Position not found',
        searchedPool: poolAddress,
        searchedPosition: positionAddress,
        availablePositions: positions.map((p) => ({
          position: p.position.toBase58(),
          pool: p.positionState.pool.toBase58(),
        })),
      });
    }

    // Get pool state and derive vault addresses
    const poolPubkey = targetPosition.positionState.pool;
    const poolState = await cpAmm.fetchPoolState(poolPubkey);

    const tokenAVault = deriveTokenVaultAddress(poolState.tokenAMint, poolPubkey);
    const tokenBVault = deriveTokenVaultAddress(poolState.tokenBMint, poolPubkey);

    console.log('[fees/claim-damm-fees] Building claim transaction...');

    const claimTx = await cpAmm.claimPositionFee({
      owner: treasury.publicKey,
      position: targetPosition.position,
      pool: poolPubkey,
      positionNftAccount: targetPosition.positionNftAccount,
      tokenAMint: poolState.tokenAMint,
      tokenBMint: poolState.tokenBMint,
      tokenAVault,
      tokenBVault,
      tokenAProgram: TOKEN_PROGRAM_ID,
      tokenBProgram: TOKEN_PROGRAM_ID,
      receiver: treasury.publicKey,
    });

    // Set recent blockhash + fee payer, then sign
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    claimTx.feePayer = treasury.publicKey;
    claimTx.recentBlockhash = blockhash;
    claimTx.sign(treasury);

    // Send transaction
    const signature = await connection.sendRawTransaction(claimTx.serialize());

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    console.log('[fees/claim-damm-fees] Fees claimed:', signature);

    // Record the claim in database
    if (token) {
      await supabase.from('fee_pool_claims').insert({
        token_id: token.id,
        pool_address: poolAddress,
        signature,
        claimed_at: new Date().toISOString(),
        processed: true,
        processed_at: new Date().toISOString(),
      });

      const { data: systemEarner } = await supabase
        .from('fee_earners')
        .select('*')
        .eq('token_id', token.id)
        .eq('earner_type', 'system')
        .single();

      if (systemEarner) {
        await supabase
          .from('fee_earners')
          .update({
            unclaimed_sol: 0,
            last_claimed_at: new Date().toISOString(),
          })
          .eq('id', systemEarner.id);
      }
    }

    return res.status(200).json({
      success: true,
      signature,
      poolAddress: poolPubkey.toBase58(),
      positionAddress: targetPosition.position.toBase58(),
      tokenId: token?.id,
      treasuryWallet: PLATFORM_FEE_WALLET,
    });
  } catch (error) {
    console.error('[fees/claim-damm-fees] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
