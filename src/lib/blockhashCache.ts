/**
 * Pre-cached Blockhash Service
 * 
 * Polls for fresh blockhashes every 2 seconds in the background.
 * Trade clicks read the cached value instantly (0ms) instead of RPC (200-500ms).
 */

import { Connection } from '@solana/web3.js';
import { getRpcUrl } from '@/hooks/useSolanaWallet';

interface CachedBlockhash {
  blockhash: string;
  lastValidBlockHeight: number;
  fetchedAt: number;
}

let cache: CachedBlockhash | null = null;
let pollInterval: ReturnType<typeof setInterval> | null = null;
let connection: Connection | null = null;

const POLL_MS = 2000; // Refresh every 2 seconds
const STALE_MS = 10_000; // Consider stale after 10 seconds

function getConnection(): Connection {
  if (!connection) {
    const { url } = getRpcUrl();
    connection = new Connection(url, 'confirmed');
  }
  return connection;
}

async function refreshBlockhash(): Promise<void> {
  try {
    const conn = getConnection();
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');
    cache = { blockhash, lastValidBlockHeight, fetchedAt: Date.now() };
  } catch (err) {
    console.warn('[BlockhashCache] Refresh failed:', err);
    // Keep stale cache rather than null
  }
}

/**
 * Start background polling. Safe to call multiple times (idempotent).
 */
export function startBlockhashPoller(): void {
  if (pollInterval) return;
  // Immediately fetch one
  refreshBlockhash();
  pollInterval = setInterval(refreshBlockhash, POLL_MS);
}

/**
 * Stop background polling.
 */
export function stopBlockhashPoller(): void {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

/**
 * Get cached blockhash instantly (0ms).
 * Falls back to a live fetch if cache is empty or stale.
 */
export async function getCachedBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  // If cache is fresh, return instantly
  if (cache && (Date.now() - cache.fetchedAt) < STALE_MS) {
    return { blockhash: cache.blockhash, lastValidBlockHeight: cache.lastValidBlockHeight };
  }

  // Cache miss or stale — do a live fetch (first-time only, should be rare)
  await refreshBlockhash();
  if (cache) {
    return { blockhash: cache.blockhash, lastValidBlockHeight: cache.lastValidBlockHeight };
  }

  // Absolute fallback
  const conn = getConnection();
  return conn.getLatestBlockhash('confirmed');
}

/**
 * Get cached blockhash synchronously. Returns null if no cache available.
 * Use this for maximum speed — no async overhead.
 */
export function getCachedBlockhashSync(): { blockhash: string; lastValidBlockHeight: number } | null {
  if (cache && (Date.now() - cache.fetchedAt) < STALE_MS) {
    return { blockhash: cache.blockhash, lastValidBlockHeight: cache.lastValidBlockHeight };
  }
  return null;
}
