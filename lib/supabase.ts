import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { 
  SUPABASE_URL, 
  SUPABASE_ANON_KEY, 
  SUPABASE_SERVICE_ROLE_KEY,
  hasServiceRoleKey 
} from './config.js';

// Cached clients
let anonClient: SupabaseClient | null = null;
let serviceClient: SupabaseClient | null = null;

/**
 * Get Supabase client with anon key (for RLS-protected operations)
 * This is the preferred client for most operations
 */
export function getSupabaseAnonClient(): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL not configured');
  }
  
  if (!SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_ANON_KEY not configured');
  }
  
  if (!anonClient) {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  
  return anonClient;
}

/**
 * Get Supabase client with service role key (bypasses RLS)
 * Use only when absolutely necessary for admin operations
 */
export function getSupabaseServiceClient(): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL not configured');
  }
  
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY not configured - use anon client instead');
  }
  
  if (!serviceClient) {
    serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  }
  
  return serviceClient;
}

/**
 * Get the best available Supabase client
 * Prefers service role key if available for write operations,
 * falls back to anon key (which requires RLS to allow the operation)
 */
export function getSupabaseClient(): SupabaseClient {
  if (!SUPABASE_URL) {
    throw new Error('SUPABASE_URL not configured');
  }
  
  // Prefer service role key if available (for backward compatibility)
  if (hasServiceRoleKey()) {
    return getSupabaseServiceClient();
  }
  
  // Fall back to anon key
  if (SUPABASE_ANON_KEY) {
    return getSupabaseAnonClient();
  }
  
  throw new Error('No Supabase credentials configured. Set SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
}

// Token type definition
export interface Token {
  id: string;
  mint_address: string;
  name: string;
  ticker: string;
  creator_wallet: string;
  creator_id: string | null;
  dbc_pool_address: string | null;
  damm_pool_address: string | null;
  virtual_sol_reserves: number;
  virtual_token_reserves: number;
  real_sol_reserves: number;
  real_token_reserves: number;
  total_supply: number;
  bonding_curve_progress: number;
  graduation_threshold_sol: number;
  price_sol: number;
  market_cap_sol: number;
  volume_24h_sol: number;
  status: 'bonding' | 'graduated' | 'failed';
  migration_status: string;
  holder_count: number;
  graduated_at: string | null;
  created_at: string;
  updated_at: string;
}

// Get token by ID
export async function getTokenById(tokenId: string): Promise<Token | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('tokens')
    .select('*')
    .eq('id', tokenId)
    .single();
  
  if (error) {
    console.error('Error fetching token:', error);
    return null;
  }
  
  return data as Token;
}

// Get token by mint address (checks both tokens and fun_tokens tables)
export async function getTokenByMint(mintAddress: string): Promise<Token | null> {
  const supabase = getSupabaseClient();
  
  // Try tokens table first
  const { data } = await supabase
    .from('tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .maybeSingle();
  
  if (data) {
    return data as Token;
  }
  
  // Fallback to fun_tokens table
  const { data: funToken, error: funError } = await supabase
    .from('fun_tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .maybeSingle();
  
  if (funError) {
    console.error('Error fetching token from fun_tokens:', funError);
    return null;
  }
  
  if (funToken) {
    // Map fun_tokens fields to Token interface for compatibility
    return {
      id: funToken.id,
      mint_address: funToken.mint_address,
      name: funToken.name,
      ticker: funToken.ticker,
      creator_wallet: funToken.creator_wallet,
      creator_id: null,
      dbc_pool_address: funToken.dbc_pool_address,
      damm_pool_address: null,
      virtual_sol_reserves: 30,
      virtual_token_reserves: 1_000_000_000,
      real_sol_reserves: 0,
      real_token_reserves: 0,
      total_supply: 1_000_000_000,
      bonding_curve_progress: funToken.bonding_progress || 0,
      graduation_threshold_sol: 85,
      price_sol: funToken.price_sol || 0,
      market_cap_sol: funToken.market_cap_sol || 0,
      volume_24h_sol: funToken.volume_24h_sol || 0,
      status: funToken.status === 'active' ? 'bonding' : funToken.status,
      migration_status: 'pending',
      holder_count: funToken.holder_count || 0,
      graduated_at: null,
      created_at: funToken.created_at,
      updated_at: funToken.updated_at,
    } as Token;
  }

  // Fallback to claw_tokens table
  const { data: clawToken, error: clawError } = await supabase
    .from('claw_tokens')
    .select('*')
    .eq('mint_address', mintAddress)
    .maybeSingle();

  if (clawError) {
    console.error('Error fetching token from claw_tokens:', clawError);
    return null;
  }

  if (clawToken) {
    return {
      id: clawToken.id,
      mint_address: clawToken.mint_address,
      name: clawToken.name,
      ticker: clawToken.ticker,
      creator_wallet: clawToken.creator_wallet,
      creator_id: null,
      dbc_pool_address: clawToken.dbc_pool_address,
      damm_pool_address: null,
      virtual_sol_reserves: 30,
      virtual_token_reserves: 1_000_000_000,
      real_sol_reserves: 0,
      real_token_reserves: 0,
      total_supply: 1_000_000_000,
      bonding_curve_progress: clawToken.bonding_progress || 0,
      graduation_threshold_sol: 85,
      price_sol: clawToken.price_sol || 0,
      market_cap_sol: clawToken.market_cap_sol || 0,
      volume_24h_sol: clawToken.volume_24h_sol || 0,
      status: clawToken.status === 'active' ? 'bonding' : clawToken.status,
      migration_status: 'pending',
      holder_count: clawToken.holder_count || 0,
      graduated_at: null,
      created_at: clawToken.created_at,
      updated_at: clawToken.updated_at,
    } as Token;
  }
  
  return null;
}

// Update token
export async function updateToken(tokenId: string, updates: Partial<Token>) {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('tokens')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', tokenId);
  
  if (error) {
    throw new Error(`Failed to update token: ${error.message}`);
  }
}

// Acquire claim lock
export async function acquireClaimLock(tokenId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data } = await supabase.rpc('acquire_claim_lock', {
    p_token_id: tokenId,
    p_lock_duration_seconds: 60,
  });
  return !!data;
}

// Release claim lock
export async function releaseClaimLock(tokenId: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.rpc('release_claim_lock', { p_token_id: tokenId });
}
