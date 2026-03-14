import type { VercelRequest, VercelResponse } from '@vercel/node';
import { generateVanityAddresses, getVanityStats } from '../../lib/vanityGenerator.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-vanity-secret',
};

function applyCors(res: VercelResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

// Default suffix to generate
const DEFAULT_SUFFIX = 'STRN'; // Case-sensitive matching, uppercase only

// Maximum duration per invocation (55s to leave buffer for Vercel 60s limit)
const MAX_DURATION_MS = 55000;

// Batch size for generation (higher = more CPU intensive but faster)
const BATCH_SIZE = 2000;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Simple auth check - require a secret header to prevent abuse
  const authHeader = req.headers['x-vanity-secret'];
  const expectedSecret = '123456';
  
  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    if (req.method === 'GET') {
      // GET request returns current stats
      const suffix = (req.query.suffix as string) || DEFAULT_SUFFIX;
      const stats = await getVanityStats(suffix);
      
      return res.status(200).json({
        success: true,
        suffix,
        stats,
      });
    }

    if (req.method === 'POST') {
      // POST request triggers generation
      const { suffix = DEFAULT_SUFFIX, duration = MAX_DURATION_MS, batchSize = BATCH_SIZE } = req.body || {};
      
      console.log(`[vanity/generate] Starting generation for suffix "${suffix}"`);
      console.log(`[vanity/generate] Duration: ${duration}ms, Batch size: ${batchSize}`);
      
      // Get stats before
      const statsBefore = await getVanityStats(suffix);
      console.log(`[vanity/generate] Stats before: ${statsBefore.available} available, ${statsBefore.total} total`);
      
      // Run generation
      const result = await generateVanityAddresses(
        suffix,
        Math.min(duration, MAX_DURATION_MS),
        batchSize
      );
      
      // Get stats after
      const statsAfter = await getVanityStats(suffix);
      
      console.log(`[vanity/generate] Complete! Found ${result.found} addresses in ${result.duration}ms`);
      console.log(`[vanity/generate] Stats after: ${statsAfter.available} available, ${statsAfter.total} total`);
      
      return res.status(200).json({
        success: true,
        suffix,
        result: {
          found: result.found,
          attempts: result.attempts,
          duration: result.duration,
          rate: Math.round(result.attempts / (result.duration / 1000)),
          addresses: result.addresses,
        },
        stats: {
          before: statsBefore,
          after: statsAfter,
          newAddresses: statsAfter.total - statsBefore.total,
        },
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('[vanity/generate] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
