import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import { createClient } from '@supabase/supabase-js';

// Base58 alphabet for Solana addresses
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

// XOR encryption for secret key storage
function encryptSecretKey(secretKeyHex: string, encryptionKey: string): string {
  const keyBytes = Buffer.from(encryptionKey, 'utf-8');
  const dataBytes = Buffer.from(secretKeyHex, 'hex');
  
  const encrypted = Buffer.alloc(dataBytes.length);
  for (let i = 0; i < dataBytes.length; i++) {
    encrypted[i] = dataBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return encrypted.toString('hex');
}

// Decrypt secret key for token launch
export function decryptSecretKey(encryptedHex: string, encryptionKey: string): Uint8Array {
  const keyBytes = Buffer.from(encryptionKey, 'utf-8');
  const encryptedBytes = Buffer.from(encryptedHex, 'hex');
  
  const decrypted = Buffer.alloc(encryptedBytes.length);
  for (let i = 0; i < encryptedBytes.length; i++) {
    decrypted[i] = encryptedBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return new Uint8Array(decrypted);
}

// Check if address ends with target suffix (case-SENSITIVE for STRN)
function matchesSuffix(address: string, suffix: string): boolean {
  return address.endsWith(suffix);
}

// Generate a single keypair and check suffix
function generateAndCheck(suffix: string): { keypair: Keypair; address: string } | null {
  const keypair = Keypair.generate();
  const address = keypair.publicKey.toBase58();
  
  if (matchesSuffix(address, suffix)) {
    return { keypair, address };
  }
  return null;
}

// Get Supabase client - MUST use service role key to bypass RLS on vanity_keypairs
function getSupabaseClient() {
  // Accept multiple env var name conventions (Vercel sets SUPABASE_URL, Vite apps use VITE_SUPABASE_URL)
  const supabaseUrl = 
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://ptwytypavumcrbofspno.supabase.co';
  
  // Service role key preferred, but SECURITY DEFINER functions work with anon key
  const supabaseKey = 
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB0d3l0eXBhdnVtY3Jib2ZzcG5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5MTIyODksImV4cCI6MjA4MjQ4ODI4OX0.7FFIiwQTgqIQn4lzyDHPTsX-6PD5MPqgZSdVVsH9A44';
  
  if (!supabaseKey) {
    throw new Error('No Supabase key configured for vanity keypair operations');
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export interface VanityGenerationResult {
  found: number;
  attempts: number;
  duration: number;
  addresses: string[];
}

export interface SavedKeypair {
  id: string;
  suffix: string;
  publicKey: string;
  status: string;
  createdAt: string;
}

// Main generation function - runs for up to maxDuration seconds
export async function generateVanityAddresses(
  suffix: string,
  maxDuration: number = 55000, // 55 seconds (leave 5s buffer for Vercel 60s limit)
  batchSize: number = 1000
): Promise<VanityGenerationResult> {
  const startTime = Date.now();
  let attempts = 0;
  const foundKeypairs: { keypair: Keypair; address: string }[] = [];
  
  console.log(`[vanity] Starting generation for suffix "${suffix}" (max ${maxDuration}ms)`);
  
  const supabase = getSupabaseClient();
  const encryptionKey = process.env.TREASURY_PRIVATE_KEY?.slice(0, 32) || 'default-encryption-key-12345678';
  
  // Generation loop
  while (Date.now() - startTime < maxDuration) {
    // Process batch
    for (let i = 0; i < batchSize; i++) {
      attempts++;
      const result = generateAndCheck(suffix);
      
      if (result) {
        foundKeypairs.push(result);
        console.log(`[vanity] ✅ Found match #${foundKeypairs.length}: ${result.address} (${attempts} attempts)`);
        
        // Save immediately to database using SECURITY DEFINER function
        const secretKeyHex = Buffer.from(result.keypair.secretKey).toString('hex');
        const encryptedSecretKey = encryptSecretKey(secretKeyHex, encryptionKey);
        
        try {
          const { data, error } = await supabase.rpc('backend_insert_vanity_keypair', {
            p_suffix: suffix.toLowerCase(),
            p_public_key: result.address,
            p_secret_key_encrypted: encryptedSecretKey,
          });
          
          if (error) {
            console.error(`[vanity] Failed to save keypair:`, error);
          } else if (data === null) {
            console.log(`[vanity] Address already exists, skipping: ${result.address}`);
          } else {
            console.log(`[vanity] 💾 Saved to database: ${result.address}`);
          }
        } catch (saveError) {
          console.error(`[vanity] Save error:`, saveError);
        }
      }
    }
    
    // Log progress every 100k attempts
    if (attempts % 100000 === 0) {
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = Math.round(attempts / elapsed);
      console.log(`[vanity] Progress: ${attempts.toLocaleString()} attempts, ${rate.toLocaleString()}/sec, ${foundKeypairs.length} found`);
    }
  }
  
  const duration = Date.now() - startTime;
  const rate = Math.round(attempts / (duration / 1000));
  
  console.log(`[vanity] Generation complete: ${attempts.toLocaleString()} attempts in ${duration}ms (${rate.toLocaleString()}/sec), ${foundKeypairs.length} addresses found`);
  
  return {
    found: foundKeypairs.length,
    attempts,
    duration,
    addresses: foundKeypairs.map(kp => kp.address),
  };
}

// Get next available vanity address for token launch
export async function getAvailableVanityAddress(suffix: string): Promise<{
  id: string;
  publicKey: string;
  keypair: Keypair;
} | null> {
  const encryptionKey = process.env.TREASURY_PRIVATE_KEY?.slice(0, 32) || 'default-encryption-key-12345678';
  
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.log(`[vanity] Supabase credentials not configured, skipping vanity lookup`);
    return null;
  }
  
  // Use SECURITY DEFINER function to reserve address
  const { data, error } = await supabase.rpc('backend_reserve_vanity_address', {
    p_suffix: suffix.toLowerCase(),
  });
  
  if (error) {
    console.log(`[vanity] Query error for suffix "${suffix}":`, error.message);
    return null;
  }
  
  if (!data || data.length === 0) {
    console.log(`[vanity] No available vanity address for suffix "${suffix}" (table may be empty)`);
    return null;
  }
  
  const row = data[0];
  
  // Decrypt the secret key
  const secretKeyBytes = decryptSecretKey(row.secret_key_encrypted, encryptionKey);
  const keypair = Keypair.fromSecretKey(secretKeyBytes);
  
  console.log(`[vanity] Reserved vanity address: ${row.public_key}`);
  
  return {
    id: row.id,
    publicKey: row.public_key,
    keypair,
  };
}

// Get a specific vanity address by ID (for reserved/official launches)
export async function getSpecificVanityAddress(keypairId: string): Promise<{
  id: string;
  publicKey: string;
  keypair: Keypair;
} | null> {
  const encryptionKey = process.env.TREASURY_PRIVATE_KEY?.slice(0, 32) || 'default-encryption-key-12345678';
  
  let supabase;
  try {
    supabase = getSupabaseClient();
  } catch (e) {
    console.log(`[vanity] Supabase credentials not configured, skipping specific vanity lookup`);
    return null;
  }
  
  // Use atomic SECURITY DEFINER function that fetches AND reserves in one call
  // This bypasses RLS and avoids the separate table UPDATE that would fail with anon key
  const { data: rows, error } = await supabase.rpc('backend_get_and_reserve_specific_vanity_keypair', {
    p_keypair_id: keypairId,
  });
  const data = rows?.[0] ?? null;
  
  if (error || !data) {
    console.error(`[vanity] Failed to fetch specific vanity keypair ${keypairId}:`, error?.message);
    return null;
  }
  
  console.log(`[vanity] Found specific vanity keypair: ${data.public_key} (status: ${data.status})`);
  
  // Decrypt the secret key
  const secretKeyBytes = decryptSecretKey(data.secret_key_encrypted, encryptionKey);
  const keypair = Keypair.fromSecretKey(secretKeyBytes);
  
  return {
    id: data.id,
    publicKey: data.public_key,
    keypair,
  };
}

// Mark vanity address as used for a token
export async function markVanityAddressUsed(keypairId: string, tokenId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('backend_mark_vanity_used', {
    p_keypair_id: keypairId,
    p_token_id: tokenId,
  });
  
  if (error) {
    console.error(`[vanity] Failed to mark keypair as used:`, error);
    throw error;
  }
  
  console.log(`[vanity] Marked keypair ${keypairId} as used for token ${tokenId}`);
}

// Release a reserved address back to available
export async function releaseVanityAddress(keypairId: string): Promise<void> {
  const supabase = getSupabaseClient();
  
  const { error } = await supabase.rpc('backend_release_vanity_address', {
    p_keypair_id: keypairId,
  });
  
  if (error) {
    console.error(`[vanity] Failed to release keypair:`, error);
    throw error;
  }
  
  console.log(`[vanity] Released keypair ${keypairId} back to available`);
}

// Get statistics about vanity keypairs
export async function getVanityStats(suffix?: string): Promise<{
  total: number;
  available: number;
  reserved: number;
  used: number;
  suffixes: { suffix: string; count: number }[];
}> {
  const supabase = getSupabaseClient();
  
  // Get stats using SECURITY DEFINER function
  const { data: statsData, error: statsError } = await supabase.rpc('backend_get_vanity_stats', {
    p_suffix: suffix?.toLowerCase() || null,
  });
  
  if (statsError) {
    throw new Error(`Failed to get vanity stats: ${statsError.message}`);
  }
  
  // Get suffix breakdown
  const { data: suffixData, error: suffixError } = await supabase.rpc('backend_get_vanity_suffixes');
  
  if (suffixError) {
    console.error(`[vanity] Failed to get suffix breakdown:`, suffixError);
  }
  
  const stats = statsData?.[0] || { total: 0, available: 0, reserved: 0, used: 0 };
  
  return {
    total: Number(stats.total) || 0,
    available: Number(stats.available) || 0,
    reserved: Number(stats.reserved) || 0,
    used: Number(stats.used) || 0,
    suffixes: (suffixData || []).map((s: { suffix: string; count: number }) => ({
      suffix: s.suffix,
      count: Number(s.count),
    })),
  };
}
