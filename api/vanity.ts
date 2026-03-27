import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateVanityAddresses, getVanityStats, getAvailableVanityAddress } from '../../lib/vanityGenerator.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-vanity-secret',
};

function applyCors(res: VercelResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

const DEFAULT_SUFFIX = 'STRN';
const MAX_DURATION_MS = 55000;
const BATCH_SIZE = 3000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const path = req.url?.split('?')[0] || '';

  if (path.includes('/api/vanity/batch')) {
    return handleBatch(req, res);
  } else if (path.includes('/api/vanity/available')) {
    return handleAvailable(req, res);
  } else if (path.includes('/api/vanity/stats')) {
    return handleStats(req, res);
  }

  return res.status(404).json({ error: 'Endpoint not found' });
}

/**
 * GET /api/vanity/available
 * Get an available vanity address
 */
async function handleAvailable(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { suffix = 'claw' } = req.query;

    const vanityKeypair = await getAvailableVanityAddress(suffix as string);

    if (!vanityKeypair) {
      return res.status(404).json({
        error: 'No available vanity addresses',
        suffix,
      });
    }

    return res.status(200).json({
      success: true,
      suffix,
      id: vanityKeypair.id,
      publicKey: vanityKeypair.publicKey,
      keypair: vanityKeypair.keypair,
    });
  } catch (error) {
    console.error('[vanity/available] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/vanity/stats?suffix=STRN
 * Get vanity address statistics
 */
async function handleStats(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { suffix = DEFAULT_SUFFIX } = req.query;

    const stats = await getVanityStats(suffix as string);

    return res.status(200).json({
      success: true,
      suffix,
      stats,
    });
  } catch (error) {
    console.error('[vanity/stats] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * POST /api/vanity/batch
 * Batch generation with target tracking
 */
async function handleBatch(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers['x-vanity-secret'];
  const expectedSecret = process.env.VANITY_SECRET || '123456';

  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const {
      suffix = DEFAULT_SUFFIX,
      targetCount = 100,
      ignoreTarget = false,
    } = req.body || {};

    console.log(`[vanity/batch] Starting batch generation for suffix "${suffix}"`);
    if (!ignoreTarget) {
      console.log(`[vanity/batch] Target: ${targetCount} available addresses`);
    } else {
      console.log('[vanity/batch] ignoreTarget=true (always run one batch)');
    }

    // Check current count
    const statsBefore = await getVanityStats(suffix);

    if (!ignoreTarget && statsBefore.available >= targetCount) {
      console.log(`[vanity/batch] Already have ${statsBefore.available} available, target met!`);
      return res.status(200).json({
        success: true,
        message: 'Target already met',
        suffix,
        stats: statsBefore,
        generated: 0,
      });
    }

    if (!ignoreTarget) {
      const needed = targetCount - statsBefore.available;
      console.log(`[vanity/batch] Need ${needed} more addresses to reach target`);
    }

    // Run generation
    const result = await generateVanityAddresses(suffix, MAX_DURATION_MS, BATCH_SIZE);

    // Get updated stats
    const statsAfter = await getVanityStats(suffix);

    const response = {
      success: true,
      suffix,
      batch: {
        found: result.found,
        attempts: result.attempts,
        duration: result.duration,
        rate: Math.round(result.attempts / (result.duration / 1000)),
      },
      progress: ignoreTarget
        ? null
        : {
            before: statsBefore.available,
            after: statsAfter.available,
            target: targetCount,
            remaining: Math.max(0, targetCount - statsAfter.available),
            percentComplete: Math.min(100, Math.round((statsAfter.available / targetCount) * 100)),
          },
      stats: statsAfter,
      newAddresses: result.addresses,
    };

    if (!ignoreTarget) {
      console.log(`[vanity/batch] Complete! Progress: ${response.progress?.percentComplete}%`);
    } else {
      console.log(`[vanity/batch] Complete! Batch found: ${result.found}`);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error('[vanity/batch] Error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
