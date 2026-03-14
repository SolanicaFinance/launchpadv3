import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getVanityStats } from '../../lib/vanityGenerator.js';

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-vanity-secret',
};

function applyCors(res: VercelResponse) {
  for (const [key, value] of Object.entries(corsHeaders)) {
    res.setHeader(key, value);
  }
}

/**
 * Progress endpoint for real-time polling during vanity generation
 * Returns the current count of available addresses
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  applyCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Auth check
  const authHeader = req.headers['x-vanity-secret'];
  const expectedSecret = '123456';
  
  if (!authHeader || authHeader !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const suffix = (req.query.suffix as string) || 'STRN';
    const stats = await getVanityStats(suffix);
    
    return res.status(200).json({
      success: true,
      suffix,
      available: stats.available,
      total: stats.total,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[vanity/progress] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
