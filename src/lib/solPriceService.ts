import { supabase } from '@/integrations/supabase/client';

const CACHE_KEY = 'sol_price_cache_v2';
const POLL_INTERVAL = 60_000; // 60 seconds (matches server cache TTL)
const STALE_THRESHOLD = 120_000; // 2 minutes

interface PriceData {
  price: number;
  change24h: number;
  timestamp: number;
}

type Listener = (data: PriceData) => void;

let current: PriceData | null = null;
let inflight: Promise<PriceData | null> | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<Listener>();

function loadCache(): PriceData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PriceData;
    if (Date.now() - parsed.timestamp < STALE_THRESHOLD && parsed.price > 0) {
      return parsed;
    }
  } catch {}
  return null;
}

function saveCache(data: PriceData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {}
}

async function doFetch(): Promise<PriceData | null> {
  try {
    const { data, error } = await supabase.functions.invoke('sol-price');
    if (error) throw error;
    if (data?.price && typeof data.price === 'number' && data.price > 0) {
      return { price: data.price, change24h: data.change24h || 0, timestamp: Date.now() };
    }
  } catch {
    // silent
  }
  return null;
}

async function fetchPrice() {
  // Deduplicate concurrent calls
  if (inflight) return inflight;

  inflight = doFetch();
  const result = await inflight;
  inflight = null;

  if (result) {
    current = result;
    saveCache(result);
    listeners.forEach(fn => fn(result));
  }
  return result;
}

function ensurePolling() {
  if (intervalId) return;
  fetchPrice();
  intervalId = setInterval(fetchPrice, POLL_INTERVAL);
}

function stopPollingIfEmpty() {
  if (listeners.size === 0 && intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function subscribeSolPrice(listener: Listener): () => void {
  listeners.add(listener);
  // Send current value immediately
  if (current) listener(current);
  ensurePolling();
  return () => {
    listeners.delete(listener);
    stopPollingIfEmpty();
  };
}

export function getCachedSolPrice(): PriceData | null {
  if (current) return current;
  const cached = loadCache();
  if (cached) current = cached;
  return current;
}
