import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import bs58 from 'https://esm.sh/bs58@6.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
};

// Configuration
const TARGET_SUFFIX = 'STRN'; // Case-sensitive matching, uppercase only
const TARGET_AVAILABLE = 500; // Keep at least 500 available
const MAX_DURATION_MS = 8000; // 8 seconds (edge functions have limited CPU)
const BATCH_SIZE = 10; // Small batches for edge function CPU limits
const CASE_SENSITIVE = true; // Case-sensitive matching — STRN uppercase only
const YIELD_EVERY = 1; // Yield CPU every attempt to avoid compute limit

// XOR encryption for secret key storage
function encryptSecretKey(secretKeyHex: string, encryptionKey: string): string {
  const keyBytes = new TextEncoder().encode(encryptionKey);
  const dataBytes = new Uint8Array(secretKeyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
  
  const encrypted = new Uint8Array(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return Array.from(encrypted).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Convert bytes to hex string
function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate Ed25519 keypair using Deno's crypto
async function generateKeypair(): Promise<{ address: string; secretKeyHex: string } | null> {
  try {
    const keyPair = await crypto.subtle.generateKey(
      { name: 'Ed25519' },
      true,
      ['sign', 'verify']
    ) as CryptoKeyPair;
    
    // Export public key
    const publicKeyBuffer = await crypto.subtle.exportKey('raw', keyPair.publicKey);
    const publicKeyBytes = new Uint8Array(publicKeyBuffer);
    
    // Export private key (PKCS8 format)
    const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
    const privateKeyBytes = new Uint8Array(privateKeyBuffer);
    
    // Extract seed from PKCS8 (bytes 16-48 for Ed25519)
    const seed = privateKeyBytes.slice(16, 48);
    
    // Build Solana-compatible secret key (seed + public key = 64 bytes)
    const fullSecretKey = new Uint8Array(64);
    fullSecretKey.set(seed, 0);
    fullSecretKey.set(publicKeyBytes, 32);
    
    const address = bs58.encode(publicKeyBytes);
    
    return {
      address,
      secretKeyHex: toHex(fullSecretKey),
    };
  } catch (error) {
    console.error('[vanity-cron] Key generation error:', error);
    return null;
  }
}

// Check if address matches suffix (case-sensitive or insensitive based on config)
function matchesSuffix(address: string, suffix: string, caseSensitive: boolean): boolean {
  if (caseSensitive) {
    return address.endsWith(suffix);
  }
  return address.toLowerCase().endsWith(suffix.toLowerCase());
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  try {
    console.log('[vanity-cron] Starting background generation...');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceKey);
    
    // Check current available count
    const { count: availableCount, error: countError } = await supabase
      .from('vanity_keypairs')
      .select('*', { count: 'exact', head: true })
      .eq('suffix', TARGET_SUFFIX)
      .eq('status', 'available');
    
    if (countError) {
      console.error('[vanity-cron] Count error:', countError);
      throw countError;
    }
    
    console.log(`[vanity-cron] Current available: ${availableCount}, target: ${TARGET_AVAILABLE}`);
    
    // If we have enough, skip generation
    if (availableCount !== null && availableCount >= TARGET_AVAILABLE) {
      console.log('[vanity-cron] Target reached, skipping generation');
      return new Response(
        JSON.stringify({ 
          success: true, 
          skipped: true,
          available: availableCount,
          target: TARGET_AVAILABLE,
          message: 'Target count already reached'
        }),
        { status: 200, headers: corsHeaders }
      );
    }
    
    // Get encryption key
    const encryptionKey = Deno.env.get('TREASURY_PRIVATE_KEY')?.slice(0, 32) || 'default-encryption-key-12345678';
    
    // Generate vanity addresses
    let attempts = 0;
    let found = 0;
    const newAddresses: string[] = [];
    
    while (Date.now() - startTime < MAX_DURATION_MS) {
      // Generate batch
      for (let i = 0; i < BATCH_SIZE; i++) {
        attempts++;
        
        // Yield CPU periodically to avoid timeout
        if (attempts % YIELD_EVERY === 0) {
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        
        const keypair = await generateKeypair();
        if (!keypair) continue;
        
        if (matchesSuffix(keypair.address, TARGET_SUFFIX, CASE_SENSITIVE)) {
          // Found a match! Save to database
          const encryptedSecretKey = encryptSecretKey(keypair.secretKeyHex, encryptionKey);
          
          const { error: insertError } = await supabase
            .from('vanity_keypairs')
            .insert({
              suffix: TARGET_SUFFIX,
              public_key: keypair.address,
              secret_key_encrypted: encryptedSecretKey,
              status: 'available',
            });
          
          if (insertError) {
            if (insertError.code === '23505') {
              // Duplicate, skip
              console.log(`[vanity-cron] Duplicate address skipped: ${keypair.address.slice(0, 8)}...`);
            } else {
              console.error('[vanity-cron] Insert error:', insertError);
            }
          } else {
            found++;
            newAddresses.push(keypair.address);
            console.log(`[vanity-cron] Found #${found}: ${keypair.address.slice(0, 8)}...${keypair.address.slice(-8)}`);
          }
        }
      }
    }
    
    const duration = Date.now() - startTime;
    const rate = Math.round(attempts / (duration / 1000));
    
    console.log(`[vanity-cron] Complete: ${attempts} attempts, ${found} found, ${rate}/s, ${duration}ms`);
    
    return new Response(
      JSON.stringify({ 
        success: true,
        attempts,
        found,
        duration,
        rate,
        previousAvailable: availableCount,
        newAvailable: (availableCount || 0) + found,
        target: TARGET_AVAILABLE,
        newAddresses: newAddresses.slice(0, 10), // Return first 10
      }),
      { status: 200, headers: corsHeaders }
    );
    
  } catch (error) {
    console.error('[vanity-cron] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Generation failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime,
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});
