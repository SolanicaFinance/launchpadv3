// TUNA Launchpad Configuration
// Full Meteora SDK Integration - No Mock Data
// All operations are real on-chain Solana transactions

// Meteora Program IDs (Mainnet)
// Note: SDK uses its internal hardcoded address, this is for reference/documentation
export const DBC_PROGRAM_ID = 'dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN'; // Official Meteora DBC
export const DAMM_V2_PROGRAM_ID = 'cpamdpZCGKUy5JxQXB4dcpGPiikHawvSWAd6mEn1sGG';

// Token Mints
export const WSOL_MINT = 'So11111111111111111111111111111111111111112';

// Platform Configuration - Treasury Wallet
// This wallet receives all platform fees and locked LP tokens
export const PLATFORM_FEE_WALLET = 'B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc';

// Token settings
// CRITICAL: Use 9 decimals to match Axiom/DEXTools expectations for migration display
// This ensures migrationQuoteThreshold encodes to exactly 85 SOL on-chain
export const TOKEN_DECIMALS = 9;
export const TOTAL_SUPPLY = 1_000_000_000;

// Bonding curve parameters
export const INITIAL_VIRTUAL_SOL = 30; // Starting virtual SOL reserves
export const GRADUATION_THRESHOLD_SOL = 85; // SOL needed to graduate

// Trading fees - 2% total to treasury
// 100% of 2% goes to platform treasury wallet
// Treasury handles all fee distribution (buybacks, operations, etc.)
export const TRADING_FEE_BPS = 200; // 2% (200 basis points)
export const CREATOR_FEE_SHARE = 0; // 0% - No on-chain creator fees
export const SYSTEM_FEE_SHARE = 1.0; // 100% of fees go to treasury

// LP distribution on graduation
// 100% of LP locked to platform treasury - no rugs possible
export const PARTNER_LP_PERCENTAGE = 0;
export const CREATOR_LP_PERCENTAGE = 0;
export const PARTNER_LOCKED_LP_PERCENTAGE = 100; // Platform gets all locked LP
export const CREATOR_LOCKED_LP_PERCENTAGE = 0;

// Post-graduation DAMM V2 pool fees
export const MIGRATED_POOL_FEE_BPS = 200; // 2% on graduated pools

// Token type configuration
export const TOKEN_TYPE = 0; // 0 = SPL Token (not Token-2022)
export const TOKEN_UPDATE_AUTHORITY = 1; // 1 = immutable metadata

// Fresh deployer wallet configuration
// Each token launch uses a unique wallet as deployer for better on-chain attribution
export const LAUNCH_FUNDING_SOL = 0.05; // SOL to fund each fresh deployer
export const USE_FRESH_DEPLOYER = false; // Disabled: all launches use treasury wallet directly

// Environment variables with validation
// SUPABASE_URL is required
export const SUPABASE_URL = process.env.SUPABASE_URL || '';

// Use ANON_KEY (publishable) for reads - no service role needed for basic operations
// The anon key is safe to use since RLS policies protect the data
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

// Service role key is OPTIONAL - only needed for admin operations that bypass RLS
// If not provided, we'll use anon key with security definer functions for writes
export const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const HELIUS_RPC_URL = process.env.HELIUS_RPC_URL || '';
export const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY || '';

// Get RPC URL with helpful error messages
export function getHeliusRpcUrl(): string {
  const url = process.env.HELIUS_RPC_URL;
  if (!url) {
    console.error('[Config] HELIUS_RPC_URL is not set!');
    console.error('[Config] Available env vars:', Object.keys(process.env).filter(k => k.includes('HELIUS') || k.includes('RPC')));
    throw new Error('HELIUS_RPC_URL environment variable is required');
  }
  console.log('[Config] Using Helius RPC:', url.substring(0, 50) + '...');
  return url;
}

// Check if service role key is available for admin operations
export function hasServiceRoleKey(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Validate required environment variables
export function validateEnv() {
  // Minimum required: SUPABASE_URL and either ANON_KEY or SERVICE_ROLE_KEY
  const baseRequired = ['SUPABASE_URL', 'HELIUS_RPC_URL', 'TREASURY_PRIVATE_KEY'];
  
  // Need at least one Supabase key
  const hasAnonKey = !!process.env.SUPABASE_ANON_KEY;
  const hasServiceRoleKey = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!hasAnonKey && !hasServiceRoleKey) {
    console.error('[Config] Missing Supabase credentials! Need SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
    throw new Error('Missing Supabase credentials. Set SUPABASE_ANON_KEY (recommended) or SUPABASE_SERVICE_ROLE_KEY');
  }
  
  const missing = baseRequired.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error('[Config] Missing environment variables:', missing);
    console.error('[Config] All env vars:', Object.keys(process.env).join(', '));
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('[Config] Environment validated ✓');
  console.log('[Config] Using:', hasServiceRoleKey ? 'SERVICE_ROLE_KEY' : 'ANON_KEY');
}
