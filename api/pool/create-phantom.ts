import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js';
import { createClient } from '@supabase/supabase-js';
import bs58 from 'bs58';
import { createMeteoraPool, createMeteoraPoolWithMint } from '../../lib/meteora.js';
import { PLATFORM_FEE_WALLET } from '../../lib/config.js';
import { getAvailableVanityAddress, getSpecificVanityAddress, releaseVanityAddress } from '../../lib/vanityGenerator.js';
import { getAddressLookupTable } from '../../lib/addressLookupTable.js';


// Retry helper with exponential backoff for RPC rate limits
async function getBlockhashWithRetry(
  connection: Connection,
  maxRetries = 5,
  initialDelayMs = 1000
): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const result = await connection.getLatestBlockhash('confirmed');
      return result;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Check if it's a rate limit error
      if (errorMsg.includes('429') || errorMsg.includes('max usage reached')) {
        const delayMs = initialDelayMs * Math.pow(2, attempt);
        console.warn(`[create-phantom] Rate limited (429). Retrying in ${delayMs}ms (Attempt ${attempt + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        // Non-rate-limit error, throw immediately
        throw error;
      }
    }
  }
  throw new Error(`Failed to get recent blockhash after ${maxRetries} retries due to rate limiting.`);
}

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

// Get Supabase client
function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(url, key);
}

// Get treasury keypair (still needed for partial signing)
function getTreasuryKeypair(): Keypair {
  const raw = process.env.TREASURY_PRIVATE_KEY?.trim();
  if (!raw) {
    throw new Error('TREASURY_PRIVATE_KEY not configured');
  }

  try {
    if (raw.startsWith('[')) {
      const keyArray = JSON.parse(raw);
      const bytes = new Uint8Array(keyArray);
      if (bytes.length === 64) return Keypair.fromSecretKey(bytes);
      if (bytes.length === 32) return Keypair.fromSeed(bytes);
      throw new Error(`Invalid key length: ${bytes.length}`);
    }

    const decoded: Uint8Array = bs58.decode(raw);
    if (decoded.length === 64) return Keypair.fromSecretKey(decoded);
    if (decoded.length === 32) return Keypair.fromSeed(decoded);
    throw new Error(`Invalid key length: ${decoded.length}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    throw new Error(`Invalid TREASURY_PRIVATE_KEY format (${msg})`);
  }
}

function getVanityDecryptionKeys(): string[] {
  return Array.from(new Set([
    process.env.TREASURY_PRIVATE_KEY?.slice(0, 32),
    process.env.WALLET_ENCRYPTION_KEY?.slice(0, 32),
    process.env.API_ENCRYPTION_KEY?.slice(0, 32),
    'default-encryption-key-12345678',
  ].filter((value): value is string => Boolean(value))));
}

function xorDecryptHex(hex: string, encryptionKey: string): string {
  const keyBytes = Buffer.from(encryptionKey, 'utf8');
  const encryptedBytes = Buffer.from(hex, 'hex');
  const decrypted = Buffer.alloc(encryptedBytes.length);

  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }

  return decrypted.toString('hex');
}

function tryBuildVanityKeypair(secretKeyHex: string, expectedPublicKey: string): Keypair | null {
  try {
    const secretKeyBytes = Buffer.from(secretKeyHex, 'hex');
    if (secretKeyBytes.length !== 64) return null;
    const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyBytes));
    return keypair.publicKey.toBase58() === expectedPublicKey ? keypair : null;
  } catch {
    return null;
  }
}

function resolveVanityKeypairFromPayload(params: {
  vanityPublicKey: string;
  vanitySecretKeyHex?: string | null;
  vanityEncryptedSecretKey?: string | null;
}): { keypair: Keypair; source: string } | null {
  const { vanityPublicKey, vanitySecretKeyHex, vanityEncryptedSecretKey } = params;

  if (vanitySecretKeyHex) {
    const directKeypair = tryBuildVanityKeypair(vanitySecretKeyHex, vanityPublicKey);
    if (directKeypair) {
      return { keypair: directKeypair, source: 'edge-decrypted' };
    }
    console.warn('[create-phantom] Direct vanity payload did not validate against expected public key');
  }

  if (vanityEncryptedSecretKey) {
    for (const encryptionKey of getVanityDecryptionKeys()) {
      const decryptedHex = xorDecryptHex(vanityEncryptedSecretKey, encryptionKey);
      const decryptedKeypair = tryBuildVanityKeypair(decryptedHex, vanityPublicKey);
      if (decryptedKeypair) {
        return { keypair: decryptedKeypair, source: 'encrypted-fallback' };
      }
    }
    console.warn('[create-phantom] Encrypted vanity payload could not be decrypted with available keys');
  }

  return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).setHeader('Access-Control-Allow-Origin', '*').end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let vanityKeypairId: string | null = null;

  try {
    const { 
      name, 
      ticker, 
      description, 
      imageUrl, 
      websiteUrl, 
      twitterUrl, 
      telegramUrl,
      phantomWallet,
      feeRecipientWallet,
      useVanityAddress = true,
      specificVanityId = null,
      vanityPublicKey = null,
      vanitySecretKeyHex = null,
      vanityEncryptedSecretKey = null,
      tradingFeeBps: rawFeeBps = 200,
      devBuySol = 0,
    } = req.body;

    // Validate and constrain trading fee to valid range (10-1000 bps = 0.1%-10%)
    const MIN_FEE_BPS = 10;
    const MAX_FEE_BPS = 1000;
    const DEFAULT_FEE_BPS = 200;
    const tradingFeeBps = Math.max(MIN_FEE_BPS, Math.min(MAX_FEE_BPS, Math.round(Number(rawFeeBps) || DEFAULT_FEE_BPS)));
    // Validate dev buy amount (max 10 SOL to prevent abuse)
    const effectiveDevBuySol = Math.max(0, Math.min(100, Number(devBuySol) || 0));
    console.log('[create-phantom] Validated tradingFeeBps:', tradingFeeBps, 'from raw:', rawFeeBps);
    console.log('[create-phantom] Dev buy amount:', effectiveDevBuySol, 'SOL');

    if (!name || !ticker || !phantomWallet) {
      return res.status(400).json({ error: 'Missing required fields: name, ticker, phantomWallet' });
    }

    // Validate phantomWallet is a valid Solana address
    try {
      new PublicKey(phantomWallet);
    } catch {
      return res.status(400).json({ error: 'Invalid phantomWallet address' });
    }

    console.log('[create-phantom] Creating Phantom-signed token:', { name, ticker, phantomWallet, useVanityAddress });

    const treasuryKeypair = getTreasuryKeypair();
    const supabase = getSupabase();
    const rpcUrl = process.env.HELIUS_RPC_URL;

    if (!rpcUrl) {
      throw new Error('HELIUS_RPC_URL not configured');
    }

    const connection = new Connection(rpcUrl, 'confirmed');

    // Try to get a pre-generated vanity address from pool
    let vanityKeypair: { id: string; publicKey: string; keypair: Keypair } | null = null;
    
    // If edge function already decrypted the keypair, use it directly (avoids TREASURY_PRIVATE_KEY mismatch)
    if (specificVanityId && vanityPublicKey && vanitySecretKeyHex) {
      try {
        const secretKeyBytes = Buffer.from(vanitySecretKeyHex, 'hex');
        const keypair = Keypair.fromSecretKey(new Uint8Array(secretKeyBytes));
        vanityKeypair = { id: specificVanityId, publicKey: vanityPublicKey, keypair };
        vanityKeypairId = specificVanityId;
        console.log('[create-phantom] 🔒 Using PRE-DECRYPTED vanity mint address:', vanityPublicKey, '(ID:', specificVanityId, ')');
      } catch (decryptError) {
        console.error('[create-phantom] ❌ Failed to reconstruct pre-decrypted vanity keypair:', decryptError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to reconstruct vanity keypair from edge function data. Launch aborted.' 
        });
      }
    } else if (specificVanityId) {
      // Fallback: try to fetch and decrypt locally (may fail if TREASURY_PRIVATE_KEY not set on Vercel)
      try {
        vanityKeypair = await getSpecificVanityAddress(specificVanityId);
        if (vanityKeypair) {
          vanityKeypairId = vanityKeypair.id;
          console.log('[create-phantom] 🔒 Using SPECIFIC vanity mint address:', vanityKeypair.publicKey, '(ID:', specificVanityId, ')');
        } else {
          console.error('[create-phantom] ❌ CRITICAL: Specific vanity keypair not found:', specificVanityId);
          return res.status(400).json({ 
            success: false, 
            error: `Specific vanity keypair not found: ${specificVanityId}. Launch aborted.` 
          });
        }
      } catch (vanityError) {
        console.error('[create-phantom] ❌ CRITICAL: Failed to get specific vanity address:', vanityError);
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to retrieve specific vanity keypair. Launch aborted.' 
        });
      }
    } else if (useVanityAddress) {
      try {
        vanityKeypair = await getAvailableVanityAddress('claw');
        if (vanityKeypair) {
          vanityKeypairId = vanityKeypair.id;
          console.log('[create-phantom] 🎯 Using pool vanity mint address:', vanityKeypair.publicKey);
        } else {
          console.log('[create-phantom] No vanity address available, using random mint');
        }
      } catch (vanityError) {
        console.error('[create-phantom] Failed to get vanity address:', vanityError);
      }
    }

    // For Phantom launches, we use the Phantom wallet as the fee recipient
    // This means 100% of trading fees go to the user's Phantom wallet
    const effectiveFeeRecipient = feeRecipientWallet || phantomWallet;

    console.log('[create-phantom] Creating Meteora DBC pool...', {
      name: name.slice(0, 32),
      ticker: ticker.toUpperCase().slice(0, 10),
      phantomWallet,
      feeRecipientWallet: effectiveFeeRecipient,
      tradingFeeBps,
      devBuySol: effectiveDevBuySol,
      devBuySolType: typeof effectiveDevBuySol,
      devBuySolFromReq: devBuySol,
      useVanityAddress,
      hasPoolVanityKeypair: !!vanityKeypair,
    });
    
    // Fetch ALT for transaction compression (critical for Phantom Lighthouse)
    let altAccount = null;
    try {
      altAccount = await getAddressLookupTable(connection);
      if (altAccount) {
        console.log('[create-phantom] ✅ ALT loaded for transaction compression');
      } else {
        console.warn('[create-phantom] ⚠️ No ALT available — pool tx may be too large for Lighthouse');
      }
    } catch (altErr) {
      console.warn('[create-phantom] ALT fetch failed (non-fatal):', altErr);
    }

    let transactions: (Transaction | VersionedTransaction)[];
    let mintKeypair: Keypair;
    let configKeypair: Keypair;
    let poolAddress: PublicKey;
    
    // Use pool vanity keypair if available, otherwise random
    // skipDevBuyMerge=true: keep dev buy as separate TX3 for Jito bundle submission
    // This prevents Phantom Lighthouse from blocking the oversized merged transaction
    const skipDevBuyMerge = false; // Merge dev buy into pool TX2 (2-TX flow)
    
    if (vanityKeypair) {
      const result = await createMeteoraPoolWithMint({
        creatorWallet: phantomWallet, // Phantom wallet is the creator
        leftoverReceiverWallet: effectiveFeeRecipient,
        mintKeypair: vanityKeypair.keypair,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description || `${name} - A fun meme coin!`,
        imageUrl: imageUrl || undefined,
        initialBuySol: effectiveDevBuySol, // Dev buy amount
        tradingFeeBps, // Pass custom fee
        enableDevBuy: effectiveDevBuySol > 0,
        addressLookupTable: altAccount, // ALT for V0 compression
        skipDevBuyMerge,
      });
      transactions = result.transactions;
      mintKeypair = vanityKeypair.keypair;
      configKeypair = result.configKeypair;
      poolAddress = result.poolAddress;
    } else {
      const result = await createMeteoraPool({
        creatorWallet: phantomWallet, // Phantom wallet is the creator  
        leftoverReceiverWallet: effectiveFeeRecipient,
        name: name.slice(0, 32),
        ticker: ticker.toUpperCase().slice(0, 10),
        description: description || `${name} - A fun meme coin!`,
        imageUrl: imageUrl || undefined,
        initialBuySol: effectiveDevBuySol, // Dev buy amount
        tradingFeeBps, // Pass custom fee
        enableDevBuy: effectiveDevBuySol > 0,
        addressLookupTable: altAccount, // ALT for V0 compression
        skipDevBuyMerge, // Keep dev buy as separate TX3 for Jito bundle
      });
      transactions = result.transactions;
      mintKeypair = result.mintKeypair;
      configKeypair = result.configKeypair;
      poolAddress = result.poolAddress;
    }

    const mintAddress = mintKeypair.publicKey.toBase58();
    const dbcPoolAddress = poolAddress.toBase58();
    
    console.log('[create-phantom] Pool transactions prepared:', {
      mintAddress,
      dbcPoolAddress,
      txCount: transactions.length,
      isPoolVanity: !!vanityKeypair,
    });

    // === UPLOAD STATIC METADATA JSON TO STORAGE BEFORE RETURNING TXs ===
    // CRITICAL: External indexers (Solscan, Axiom, DEXTools) prefer static .json files
    console.log('[create-phantom] Uploading static metadata JSON to storage...');
    
    try {
      const tokenName = name.slice(0, 32);
      const tokenSymbol = ticker.toUpperCase().slice(0, 10);
      const tokenDescription = description || `${tokenName} - A fun meme coin!`;
      const tokenImage = imageUrl || '';
      const tokenWebsite = websiteUrl || undefined;
      const tokenTwitter = twitterUrl || undefined;
      
      // Detect image MIME type
      const imageExt = tokenImage.split('.').pop()?.toLowerCase() || 'png';
      const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg', 'jpeg': 'image/jpeg', 'png': 'image/png',
        'gif': 'image/gif', 'webp': 'image/webp', 'svg': 'image/svg+xml',
      };
      const imageMimeType = mimeTypes[imageExt] || 'image/png';
      
      const metadataJson = {
        name: tokenName,
        symbol: tokenSymbol,
        description: tokenDescription,
        image: tokenImage,
        external_url: tokenWebsite,
        seller_fee_basis_points: 0,
        properties: {
          files: tokenImage ? [{ uri: tokenImage, type: imageMimeType }] : [],
          category: 'image',
          creators: [],
        },
        extensions: {
          website: tokenWebsite,
          twitter: tokenTwitter,
          ...(telegramUrl ? { telegram: telegramUrl } : {}),
        },
      };
      
      const jsonPath = `token-metadata/${mintAddress}.json`;
      const jsonBlob = new Blob([JSON.stringify(metadataJson, null, 2)], { type: 'application/json' });
      
      const { error: uploadError } = await supabase.storage
        .from('post-images')
        .upload(jsonPath, jsonBlob, {
          contentType: 'application/json',
          upsert: true,
          cacheControl: '60',
        });
      
      if (uploadError) {
        console.warn('[create-phantom] ⚠️ Failed to upload static metadata:', uploadError.message);
      } else {
        console.log('[create-phantom] ✅ Static metadata JSON uploaded:', jsonPath);
      }
    } catch (metaUploadError) {
      console.warn('[create-phantom] ⚠️ Metadata upload error (non-fatal):', metaUploadError);
    }

    // For Phantom Lighthouse compatibility:
    // 1. Send UNSIGNED transactions — Phantom signs first to inject Lighthouse instructions
    // 2. Return ephemeral keypair secret keys so frontend can partialSign AFTER Phantom
    // 3. No Jito tips — saves bytes, we use standard RPC submission
    
    const phantomPubkey = new PublicKey(phantomWallet);
    
    const serializedTransactions: string[] = [];
    const txRequiredKeypairs: string[][] = [];
    const txIsVersioned: boolean[] = []; // Track which txs are V0 for frontend

    // Build a map of available keypairs
    const availableKeypairs: Map<string, Keypair> = new Map([
      [mintKeypair.publicKey.toBase58(), mintKeypair],
      [configKeypair.publicKey.toBase58(), configKeypair],
    ]);

    console.log('[create-phantom] Available signers:', Array.from(availableKeypairs.keys()));

    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      const isVersioned = tx instanceof VersionedTransaction;
      txIsVersioned.push(isVersioned);

      if (isVersioned) {
        // VersionedTransaction (V0 with ALT) — already has blockhash from meteora.ts
        // Determine required signers from the compiled message
        const message = tx.message;
        const numSigners = message.header.numRequiredSignatures;
        const accountKeys = message.getAccountKeys({
          addressLookupTableAccounts: altAccount ? [altAccount] : undefined,
        });
        
        const requiredSignerPubkeys: string[] = [];
        for (let s = 0; s < numSigners; s++) {
          requiredSignerPubkeys.push(accountKeys.get(s)!.toBase58());
        }

        console.log(`[create-phantom] Tx ${i + 1}/${transactions.length} (V0) requires signers:`, requiredSignerPubkeys);

        const neededKeypairPubkeys = requiredSignerPubkeys
          .filter((pk) => availableKeypairs.has(pk));

        console.log(`[create-phantom] Tx ${i + 1} needs backend keypairs:`, neededKeypairPubkeys);
        txRequiredKeypairs.push(neededKeypairPubkeys);

        // Serialize V0 — no signatures needed yet
        const serializedBytes = tx.serialize();
        const txSizeBytes = serializedBytes.length;
        console.log(`[create-phantom] Tx ${i + 1} (V0) size: ${txSizeBytes} bytes (limit: 1232, Lighthouse headroom: ~${1232 - txSizeBytes} bytes)`);
        if (txSizeBytes > 1100) {
          console.warn(`[create-phantom] ⚠️ Tx ${i + 1} is ${txSizeBytes} bytes — may not have room for Lighthouse instructions (~100-150 bytes needed)`);
        }
        const serialized = Buffer.from(serializedBytes).toString('base64');
        serializedTransactions.push(serialized);
      } else {
        // Legacy Transaction — need fresh blockhash
        const latest = await getBlockhashWithRetry(connection);
        tx.recentBlockhash = latest.blockhash;
        tx.feePayer = phantomPubkey;

        const message = tx.compileMessage();
        const requiredSignerPubkeys = message.accountKeys
          .slice(0, message.header.numRequiredSignatures)
          .map((k) => k.toBase58());

        console.log(`[create-phantom] Tx ${i + 1}/${transactions.length} (legacy) requires signers:`, requiredSignerPubkeys);

        const neededKeypairPubkeys = requiredSignerPubkeys
          .filter((pk) => availableKeypairs.has(pk));

        console.log(`[create-phantom] Tx ${i + 1} needs backend keypairs:`, neededKeypairPubkeys);
        txRequiredKeypairs.push(neededKeypairPubkeys);

        const serializedBytes = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
        const txSizeBytes = serializedBytes.length;
        console.log(`[create-phantom] Tx ${i + 1} (legacy) size: ${txSizeBytes} bytes (limit: 1232, Lighthouse headroom: ~${1232 - txSizeBytes} bytes)`);
        if (txSizeBytes > 1100) {
          console.warn(`[create-phantom] ⚠️ Tx ${i + 1} is ${txSizeBytes} bytes — may not have room for Lighthouse instructions`);
        }
        const serialized = serializedBytes.toString('base64');
        serializedTransactions.push(serialized);
      }
    }

    console.log('[create-phantom] Returning UNSIGNED transactions for Phantom-first signing (Lighthouse compatible)');
    console.log('[create-phantom] Transaction types:', txIsVersioned.map((v, i) => `TX${i + 1}: ${v ? 'V0' : 'legacy'}`));

    // Mark vanity as used
    if (vanityKeypairId) {
      console.log('[create-phantom] Vanity address reserved:', vanityKeypairId);
    }

    // Build transaction labels for better UX
    const txLabels: string[] = [];
    for (let i = 0; i < serializedTransactions.length; i++) {
      if (i === 0) txLabels.push("Create Config");
      else if (i === 1) txLabels.push("Create Pool");
      else if (i === 2 && effectiveDevBuySol > 0) txLabels.push(`Dev Buy (${effectiveDevBuySol} SOL)`);
      else txLabels.push(`Transaction ${i + 1}`);
    }

    // Export ephemeral keypair secret keys (base58) so frontend can partialSign after Phantom
    const ephemeralKeypairs: Record<string, string> = {};
    for (const [pubkey, kp] of availableKeypairs.entries()) {
      ephemeralKeypairs[pubkey] = bs58.encode(kp.secretKey);
    }

    return res.status(200).json({
      success: true,
      mintAddress,
      dbcPoolAddress,
      poolAddress: dbcPoolAddress,
      unsignedTransactions: serializedTransactions,
      txLabels,
      txRequiredKeypairs,
      ephemeralKeypairs,
      txIsVersioned, // Frontend needs this to deserialize correctly
      vanityKeypairId,
      requiresPhantomSignature: true,
      phantomSignsFirst: true,
      txCount: serializedTransactions.length,
      devBuyRequested: effectiveDevBuySol > 0,
      devBuySol: effectiveDevBuySol,
      altAddress: process.env.ALT_ADDRESS || null,
      useJitoBundle: false,
      message: '2-TX sequential signing flow with ALT compression for Lighthouse compatibility.',
    });

  } catch (error) {
    console.error('[create-phantom] Error:', error);

    // Release vanity address on error
    if (vanityKeypairId) {
      try {
        await releaseVanityAddress(vanityKeypairId);
        console.log('[create-phantom] Released vanity address after error:', vanityKeypairId);
      } catch (releaseErr) {
        console.error('[create-phantom] Failed to release vanity:', releaseErr);
      }
    }

    const msg = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ 
      success: false, 
      error: msg 
    });
  }
}
