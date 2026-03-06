/**
 * Pre-cached Blockhash Service
 * 
 * Polls for fresh blockhashes in the background with adaptive intervals.
 * Backs off on 429 rate limit errors to avoid burning through RPC quota.
 */

import { Connection } from '@solana/web3.js';
import { getRpcUrl } from '@/hooks/useSolanaWallet';

interface CachedBlockhash {
  blockhash: string;
  lastValidBlockHeight: number;
  fetchedAt: number;
}

let cache: CachedBlockhash | null = null;
let pollTimeout: ReturnType<typeof setTimeout> | null = null;
let connection: Connection | null = null;
let running = false;

const BASE_POLL_MS = 4000;       // Normal poll: every 4 seconds
const MAX_BACKOFF_MS = 60_000;   // Max backoff: 60 seconds
const STALE_MS = 15_000;         // Consider stale after 15 seconds

let currentInterval = BASE_POLL_MS;
let consecutiveErrors = 0;

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
    // Reset backoff on success
    consecutiveErrors = 0;
    currentInterval = BASE_POLL_MS;
  } catch (err: any) {
    consecutiveErrors++;
    const is429 = err?.message?.includes('429') || err?.message?.includes('max usage reached');
    if (is429) {
      // Exponential backoff: 8s, 16s, 32s, 60s max
      currentInterval = Math.min(MAX_BACKOFF_MS, BASE_POLL_MS * Math.pow(2, consecutiveErrors));
      console.warn(`[BlockhashCache] Rate limited (429). Backing off to ${(currentInterval / 1000).toFixed(0)}s`);
    } else {
      console.warn('[BlockhashCache] Refresh failed:', err);
    }
    // Keep stale cache rather than null
  }
}

function scheduleNext(): void {
  if (!running) return;
  pollTimeout = setTimeout(async () => {
    await refreshBlockhash();
    scheduleNext();
  }, currentInterval);
}

/**
 * Start background polling. Safe to call multiple times (idempotent).
 */
export function startBlockhashPoller(): void {
  if (running) return;
  running = true;
  refreshBlockhash().then(() => scheduleNext());
}

/**
 * Stop background polling.
 */
export function stopBlockhashPoller(): void {
  running = false;
  if (pollTimeout) {
    clearTimeout(pollTimeout);
    pollTimeout = null;
  }
}

/**
 * Get cached blockhash instantly (0ms).
 * Falls back to a live fetch if cache is empty or stale.
 */
export async function getCachedBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  if (cache && (Date.now() - cache.fetchedAt) < STALE_MS) {
    return { blockhash: cache.blockhash, lastValidBlockHeight: cache.lastValidBlockHeight };
  }

  await refreshBlockhash();
  if (cache) {
    return { blockhash: cache.blockhash, lastValidBlockHeight: cache.lastValidBlockHeight };
  }

  const conn = getConnection();
  return conn.getLatestBlockhash('confirmed');
}

/**
 * Get cached blockhash synchronously. Returns null if no cache available.
 */
export function getCachedBlockhashSync(): { blockhash: string; lastValidBlockHeight: number } | null {
  if (cache && (Date.now() - cache.fetchedAt) < STALE_MS) {
    return { blockhash: cache.blockhash, lastValidBlockHeight: cache.lastValidBlockHeight };
  }
  return null;
}
