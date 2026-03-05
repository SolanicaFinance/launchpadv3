/**
 * Browser-side Jito Bundle Client
 * 
 * Submits signed transactions to Jito Block Engine for atomic execution.
 * All transactions in a bundle execute in the same block slot - no frontrunning possible.
 */

import { Transaction, VersionedTransaction, PublicKey, SystemProgram } from '@solana/web3.js';
import { Buffer } from 'buffer';
import bs58 from 'bs58';
import { getRpcUrl } from '@/hooks/useSolanaWallet';

// Jito Block Engine region roots (geographically distributed)
// Note: JSON-RPC paths differ per method (e.g. /bundles vs /getBundleStatuses)
const JITO_BLOCK_ENGINE_BASES = [
  'https://mainnet.block-engine.jito.wtf:443',
  'https://ny.mainnet.block-engine.jito.wtf:443',
  'https://amsterdam.mainnet.block-engine.jito.wtf:443',
  'https://frankfurt.mainnet.block-engine.jito.wtf:443',
  'https://tokyo.mainnet.block-engine.jito.wtf:443',
];

function getRandomBlockEngineBase(): string {
  const index = Math.floor(Math.random() * JITO_BLOCK_ENGINE_BASES.length);
  return JITO_BLOCK_ENGINE_BASES[index];
}

function getBundlesUrl(base: string): string {
  return `${base}/api/v1/bundles`;
}

function getBundleStatusesUrl(base: string): string {
  return `${base}/api/v1/getBundleStatuses`;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Jito tip accounts - one of these receives tips for priority
const JITO_TIP_ACCOUNTS = [
  '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
  'HFqU5x63VTqvQss8hp11i4bVmkzf6HbKBJv9fYfZxTdU',
  'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
  'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
  'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
  'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
  '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
];

// Configuration
export const JITO_CONFIG = {
  DEFAULT_TIP_LAMPORTS: 5_000_000, // 0.005 SOL default tip (increased for reliability)
  PRIORITY_TIP_LAMPORTS: 10_000_000, // 0.01 SOL priority tip
  CONFIRMATION_TIMEOUT_MS: 90_000, // 90 seconds (increased from 60)
  POLL_INTERVAL_MS: 1500, // 1.5 seconds between status checks
  MAX_RETRIES: 7, // Increased from 5 for better handling of rate limits
};

export interface JitoBundleResult {
  success: boolean;
  bundleId?: string;
  signatures?: string[];
  error?: string;
  slot?: number;
}

export interface BundleStatus {
  confirmed: boolean;
  status?: string;
  slot?: number;
  error?: string;
}

/**
 * Get a random Jito tip account
 */
export function getRandomTipAccount(): PublicKey {
  const index = Math.floor(Math.random() * JITO_TIP_ACCOUNTS.length);
  return new PublicKey(JITO_TIP_ACCOUNTS[index]);
}

/**
 * Create a tip instruction to pay Jito validators for priority inclusion
 */
export function createJitoTipInstruction(
  fromPubkey: PublicKey,
  tipLamports: number = JITO_CONFIG.DEFAULT_TIP_LAMPORTS
) {
  return SystemProgram.transfer({
    fromPubkey,
    toPubkey: getRandomTipAccount(),
    lamports: tipLamports,
  });
}

/**
 * Serialize a signed transaction for Jito bundle submission.
 * Jito recommends base64; base58 is deprecated and can cause larger payloads.
 */
function serializeTransaction(tx: Transaction | VersionedTransaction): string {
  const bytes = tx.serialize();
  return Buffer.from(bytes).toString('base64');
}

/**
 * Extract the first valid signature from a signed transaction
 */
function getTransactionSignature(tx: Transaction | VersionedTransaction): string {
  if (tx instanceof VersionedTransaction) {
    const sig = tx.signatures[0];
    // Check if signature is non-zero (signed)
    if (!sig || sig.every(b => b === 0)) {
      console.error('[JitoBundle] VersionedTransaction signature check failed:', {
        hasSig: !!sig,
        isAllZeros: sig ? sig.every(b => b === 0) : true,
        sigLength: sig?.length ?? 0,
      });
      throw new Error('VersionedTransaction not signed');
    }
    return bs58.encode(sig);
  } else {
    // For legacy Transaction, check the signature getter first (returns the first signature)
    const primarySig = tx.signature;
    if (primarySig && primarySig.length > 0) {
      console.log('[JitoBundle] Found primary signature via tx.signature getter');
      return bs58.encode(primarySig);
    }
    
    // Fallback: find first non-null signature buffer in signatures array
    for (let i = 0; i < (tx.signatures?.length ?? 0); i++) {
      const sigPair = tx.signatures[i];
      // Check both .signature (legacy) and raw buffer access
      const sigBuffer = sigPair?.signature;
      if (sigBuffer && sigBuffer.length > 0 && !sigBuffer.every((b: number) => b === 0)) {
        console.log(`[JitoBundle] Found signature at index ${i}`);
        return bs58.encode(sigBuffer);
      }
    }
    
    // Last resort: try to serialize and extract from wire format
    // When a transaction is signed, the signature is embedded in the serialized bytes
    try {
      const serialized = tx.serialize({ requireAllSignatures: false });
      // First byte(s) indicate number of signatures, followed by 64-byte signatures
      const numSigs = serialized[0];
      if (numSigs > 0) {
        const firstSig = serialized.slice(1, 65);
        if (firstSig.length === 64 && !firstSig.every(b => b === 0)) {
          console.log('[JitoBundle] Extracted signature from serialized transaction');
          return bs58.encode(firstSig);
        }
      }
    } catch (serializeErr) {
      console.warn('[JitoBundle] Could not serialize to extract signature:', serializeErr);
    }
    
    // Debug: log the transaction state (with null-safe access)
    console.error('[JitoBundle] Transaction signature state:', {
      signatureCount: tx.signatures?.length ?? 0,
      signatures: tx.signatures?.map((s, i) => ({
        index: i,
        pubkey: s?.publicKey?.toBase58?.() ?? 'undefined',
        hasSig: !!s?.signature,
        sigLen: s?.signature?.length ?? 0,
        isAllZeros: s?.signature ? Array.from(s.signature).every((b: number) => b === 0) : true,
      })) ?? []
    });
    
    throw new Error('Transaction not signed - no valid signatures found');
  }
}

/**
 * Submit signed transactions as a Jito bundle for atomic execution
 * 
 * @param signedTransactions - Array of fully signed transactions
 * @returns Bundle submission result with bundleId and signatures
 */
export async function submitJitoBundle(
  signedTransactions: (Transaction | VersionedTransaction)[]
): Promise<JitoBundleResult> {
  try {
    // Serialize all transactions to base64 (recommended by Jito)
    const serializedTxs = signedTransactions.map(serializeTransaction);
    const signatures = signedTransactions.map(getTransactionSignature);

    console.log(`[JitoBundle] Submitting bundle with ${signedTransactions.length} transactions...`);

    // Try multiple endpoints with fallback
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < JITO_CONFIG.MAX_RETRIES; attempt++) {
      const base = getRandomBlockEngineBase();
      const bundlesUrl = getBundlesUrl(base);

      try {
        console.log(`[JitoBundle] Attempt ${attempt + 1}/${JITO_CONFIG.MAX_RETRIES} to ${bundlesUrl}`);

        const response = await fetch(bundlesUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'sendBundle',
            // IMPORTANT: Jito expects [ [txs...], { encoding } ]
            params: [serializedTxs, { encoding: 'base64' }],
          }),
        });

        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          const bodyText = await response.text().catch(() => '');

          // Handle rate limiting with exponential backoff + optional Retry-After
          if (response.status === 429) {
            const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : 0;
            const backoffMs = Math.min(10_000, 1000 * 2 ** attempt) + Math.floor(Math.random() * 250);
            const waitMs = Math.max(retryAfterMs, backoffMs);

            console.warn(`[JitoBundle] Rate limited (429). Waiting ${waitMs}ms before retry...`);
            lastError = new Error(`HTTP 429: rate limited`);

            if (attempt < JITO_CONFIG.MAX_RETRIES - 1) {
              await sleep(waitMs);
              continue;
            }
          }

          console.error('[JitoBundle] Non-OK response:', {
            status: response.status,
            statusText: response.statusText,
            body: bodyText.slice(0, 800),
          });

          throw new Error(`HTTP ${response.status}: ${bodyText || response.statusText || 'Request failed'}`);
        }

        const result = await response.json();

        if (result.error) {
          console.error('[JitoBundle] Bundle submission error:', result.error);
          throw new Error(result.error.message || JSON.stringify(result.error));
        }

        const bundleId = result.result;
        console.log('[JitoBundle] Bundle submitted successfully:', bundleId);

        return {
          success: true,
          bundleId,
          signatures,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[JitoBundle] Attempt ${attempt + 1} failed:`, lastError.message);

        // Wait before retry (generic backoff for non-429)
        if (attempt < JITO_CONFIG.MAX_RETRIES - 1) {
          const backoffMs = Math.min(8000, 750 * (attempt + 1)) + Math.floor(Math.random() * 200);
          await sleep(backoffMs);
        }
      }
    }

    return {
      success: false,
      error: lastError?.message || 'Failed to submit bundle after retries',
    };
  } catch (error) {
    console.error('[JitoBundle] Bundle submission failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Wait for bundle confirmation by polling Jito's getBundleStatuses endpoint
 * 
 * @param bundleId - The bundle ID returned from submitJitoBundle
 * @param timeoutMs - Maximum time to wait for confirmation
 * @returns Bundle status with confirmation result
 */
export async function waitForBundleConfirmation(
  bundleId: string,
  timeoutMs: number = JITO_CONFIG.CONFIRMATION_TIMEOUT_MS
): Promise<BundleStatus> {
  const startTime = Date.now();
  
  console.log(`[JitoBundle] Waiting for bundle ${bundleId} confirmation...`);
  
  while (Date.now() - startTime < timeoutMs) {
    try {
      // Use a random endpoint for load balancing
      const base = getRandomBlockEngineBase();
      const statusesUrl = getBundleStatusesUrl(base);
      
      const response = await fetch(statusesUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBundleStatuses',
          params: [[bundleId]],
        }),
      });
      
      if (!response.ok) {
        console.warn('[JitoBundle] Status check HTTP error:', response.status);
        await new Promise(resolve => setTimeout(resolve, JITO_CONFIG.POLL_INTERVAL_MS));
        continue;
      }
      
      const result = await response.json();
      
      if (result.result?.value?.[0]) {
        const status = result.result.value[0];
        console.log('[JitoBundle] Bundle status:', status);
        
        // Check for successful confirmation
        if (status.confirmation_status === 'confirmed' || status.confirmation_status === 'finalized') {
          return { 
            confirmed: true, 
            status: status.confirmation_status,
            slot: status.slot,
          };
        }
        
        // Check for failure
        if (status.err) {
          return { 
            confirmed: false, 
            status: 'failed',
            error: typeof status.err === 'object' ? JSON.stringify(status.err) : String(status.err),
          };
        }
        
        // Bundle is landed (processed but may not be confirmed yet)
        if (status.confirmation_status === 'processed') {
          console.log('[JitoBundle] Bundle processed, waiting for confirmation...');
        }
      }
    } catch (error) {
      console.warn('[JitoBundle] Status check error:', error);
    }
    
    await new Promise(resolve => setTimeout(resolve, JITO_CONFIG.POLL_INTERVAL_MS));
  }
  
  return { 
    confirmed: false, 
    status: 'timeout',
    error: `Bundle not confirmed within ${timeoutMs / 1000}s`,
  };
}

/**
 * Submit bundle and wait for confirmation in one call
 */
export async function submitAndConfirmJitoBundle(
  signedTransactions: (Transaction | VersionedTransaction)[],
  timeoutMs: number = JITO_CONFIG.CONFIRMATION_TIMEOUT_MS
): Promise<JitoBundleResult> {
  // Submit the bundle
  const submitResult = await submitJitoBundle(signedTransactions);
  
  if (!submitResult.success || !submitResult.bundleId) {
    return submitResult;
  }
  
  // Wait for confirmation
  const confirmResult = await waitForBundleConfirmation(submitResult.bundleId, timeoutMs);
  
  if (!confirmResult.confirmed) {
    return {
      success: false,
      bundleId: submitResult.bundleId,
      signatures: submitResult.signatures,
      error: confirmResult.error || 'Bundle not confirmed',
    };
  }
  
  return {
    success: true,
    bundleId: submitResult.bundleId,
    signatures: submitResult.signatures,
    slot: confirmResult.slot,
  };
}

/**
 * Lightweight Jito sendTransaction endpoint for single transactions.
 * This is NOT bundle submission — it uses Jito's sendTransaction proxy
 * which routes directly to Jito validators for faster block inclusion.
 * 
 * This is what Axiom and other fast trading bots use for sub-1-block execution.
 * Fire-and-forget: we don't wait for response since the standard RPC path
 * handles confirmation. This is purely for faster landing.
 */
const JITO_SEND_TX_ENDPOINTS = [
  'https://mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://ny.mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://amsterdam.mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://frankfurt.mainnet.block-engine.jito.wtf/api/v1/transactions',
  'https://tokyo.mainnet.block-engine.jito.wtf/api/v1/transactions',
];

/**
 * Submit a single signed+serialized transaction to Jito's sendTransaction endpoint.
 * Sends to multiple Jito regions in parallel for maximum speed.
 * Fire-and-forget — does not throw on failure.
 * 
 * @param serializedTx - The fully signed transaction as Uint8Array (from tx.serialize())
 */
export async function sendTransactionViaJito(serializedTx: Uint8Array): Promise<void> {
  const base64Tx = Buffer.from(serializedTx).toString('base64');

  // Fan out to all Jito regions simultaneously for fastest inclusion
  const promises = JITO_SEND_TX_ENDPOINTS.map(async (endpoint) => {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendTransaction',
          params: [base64Tx, { encoding: 'base64' }],
        }),
      });
      if (res.ok) {
        console.log(`[Jito] Tx submitted to ${endpoint.split('//')[1]?.split('/')[0]}`);
      }
    } catch {
      // Fire-and-forget: silently ignore errors
    }
  });

  // Don't await all — just let them fly
  Promise.allSettled(promises);
}

/**
 * Send raw transaction bytes to ALL Jito endpoints + Helius RPC in parallel.
 * This is the primary submission path for maximum speed.
 * Returns immediately after dispatching — does not wait for responses.
 * 
 * @param serializedTx - Fully signed transaction as Uint8Array
 */
export function sendRawToAllEndpoints(serializedTx: Uint8Array): void {
  const base64Tx = Buffer.from(serializedTx).toString('base64');

  // Jito endpoints (all regions)
  for (const endpoint of JITO_SEND_TX_ENDPOINTS) {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: [base64Tx, { encoding: 'base64' }],
      }),
    }).catch(() => {});
  }

  // Helius RPC (secondary path, skipPreflight for speed)
  try {
    const { url: heliusUrl } = getRpcUrl();
    fetch(heliusUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: [base64Tx, {
          encoding: 'base64',
          skipPreflight: true,
          preflightCommitment: 'processed',
          maxRetries: 0,
        }],
      }),
    }).catch(() => {});
  } catch {
    // If Helius import fails, Jito is still flying
  }
}
