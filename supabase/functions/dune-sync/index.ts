import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DUNE_API_BASE = 'https://api.dune.com/api/v1/uploads';
const DUNE_QUERY_API = 'https://api.dune.com/api/v1/query';
const DUNE_NAMESPACE = 'saturntrade';

// Dashboard query IDs that need refreshing after data sync
// Get these from your Dune dashboard URLs (e.g., dune.com/queries/QUERY_ID)
const DASHBOARD_QUERY_IDS: string[] = [
  '6554781', // Platform stats
  '6554677', // Token snapshots
  '6554792', // Creator stats
  '6554793', // Volume by token
  '6554791', // Holder distribution
  '6554788', // Transactions
];

// Enhanced table schemas for pump.fun-style analytics
const TABLE_SCHEMAS = {
  platform_stats: [
    { name: 'timestamp', type: 'timestamp' },
    { name: 'total_tokens', type: 'integer' },
    { name: 'graduated_tokens', type: 'integer' },
    { name: 'active_tokens', type: 'integer' },
    { name: 'bonding_tokens', type: 'integer' },
    { name: 'total_transactions', type: 'integer' },
    { name: 'total_volume_sol', type: 'double' },
    { name: 'volume_24h_sol', type: 'double' },
    { name: 'unique_traders', type: 'integer' },
    { name: 'total_users', type: 'integer' },
    { name: 'total_fees_earned_sol', type: 'double' },
    { name: 'total_market_cap_sol', type: 'double' },
    { name: 'avg_market_cap_sol', type: 'double' },
    { name: 'total_holders', type: 'integer' },
    { name: 'graduation_rate', type: 'double' },
  ],
  token_snapshots: [
    { name: 'snapshot_time', type: 'timestamp' },
    { name: 'token_id', type: 'varchar' },
    { name: 'mint_address', type: 'varchar' },
    { name: 'name', type: 'varchar' },
    { name: 'ticker', type: 'varchar' },
    { name: 'creator_wallet', type: 'varchar' },
    { name: 'dbc_pool_address', type: 'varchar', nullable: true },
    { name: 'damm_pool_address', type: 'varchar', nullable: true },
    { name: 'price_sol', type: 'double' },
    { name: 'market_cap_sol', type: 'double' },
    { name: 'volume_24h_sol', type: 'double' },
    { name: 'holder_count', type: 'integer' },
    { name: 'bonding_curve_progress', type: 'double' },
    { name: 'status', type: 'varchar' },
    { name: 'created_at', type: 'timestamp' },
    { name: 'graduated_at', type: 'timestamp', nullable: true },
    { name: 'age_hours', type: 'double' },
    { name: 'price_change_24h', type: 'double' },
  ],
  transactions: [
    { name: 'id', type: 'varchar' },
    { name: 'token_id', type: 'varchar' },
    { name: 'token_name', type: 'varchar' },
    { name: 'token_ticker', type: 'varchar' },
    { name: 'user_wallet', type: 'varchar' },
    { name: 'transaction_type', type: 'varchar' },
    { name: 'sol_amount', type: 'double' },
    { name: 'token_amount', type: 'double' },
    { name: 'price_per_token', type: 'double' },
    { name: 'creator_fee_sol', type: 'double' },
    { name: 'system_fee_sol', type: 'double' },
    { name: 'signature', type: 'varchar' },
    { name: 'created_at', type: 'timestamp' },
  ],
  creator_stats: [
    { name: 'snapshot_time', type: 'timestamp' },
    { name: 'creator_wallet', type: 'varchar' },
    { name: 'total_tokens_created', type: 'integer' },
    { name: 'graduated_tokens', type: 'integer' },
    { name: 'total_volume_sol', type: 'double' },
    { name: 'total_holders', type: 'integer' },
    { name: 'total_market_cap_sol', type: 'double' },
    { name: 'avg_market_cap_sol', type: 'double' },
    { name: 'graduation_rate', type: 'double' },
    { name: 'first_token_at', type: 'timestamp' },
    { name: 'last_token_at', type: 'timestamp' },
  ],
  holder_distribution: [
    { name: 'snapshot_time', type: 'timestamp' },
    { name: 'token_id', type: 'varchar' },
    { name: 'mint_address', type: 'varchar' },
    { name: 'token_name', type: 'varchar' },
    { name: 'holder_wallet', type: 'varchar' },
    { name: 'balance', type: 'double' },
    { name: 'percentage_of_supply', type: 'double' },
    { name: 'rank', type: 'integer' },
  ],
  volume_by_token: [
    { name: 'snapshot_time', type: 'timestamp' },
    { name: 'token_id', type: 'varchar' },
    { name: 'mint_address', type: 'varchar' },
    { name: 'token_name', type: 'varchar' },
    { name: 'token_ticker', type: 'varchar' },
    { name: 'volume_1h_sol', type: 'double' },
    { name: 'volume_6h_sol', type: 'double' },
    { name: 'volume_24h_sol', type: 'double' },
    { name: 'volume_total_sol', type: 'double' },
    { name: 'buy_count_24h', type: 'integer' },
    { name: 'sell_count_24h', type: 'integer' },
    { name: 'unique_traders_24h', type: 'integer' },
  ],
};

async function deleteDuneTable(
  apiKey: string,
  tableName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Deleting Dune table: ${DUNE_NAMESPACE}.${tableName}`);
    
    const response = await fetch(`${DUNE_API_BASE}/${DUNE_NAMESPACE}/${tableName}`, {
      method: 'DELETE',
      headers: {
        'X-Dune-Api-Key': apiKey,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('not found') || errorText.includes('does not exist')) {
        console.log(`Table ${tableName} doesn't exist, nothing to delete`);
        return { success: true };
      }
      console.error(`Failed to delete table ${tableName}:`, errorText);
      return { success: false, error: errorText };
    }

    console.log(`Deleted table ${tableName}`);
    return { success: true };
  } catch (error) {
    console.error(`Error deleting table ${tableName}:`, error);
    return { success: false, error: String(error) };
  }
}

async function createDuneTable(
  apiKey: string,
  tableName: string,
  schema: { name: string; type: string; nullable?: boolean }[],
  forceRecreate = false
): Promise<{ success: boolean; error?: string }> {
  try {
    // If force recreate, delete first
    if (forceRecreate) {
      await deleteDuneTable(apiKey, tableName);
    }

    console.log(`Creating Dune table: ${DUNE_NAMESPACE}.${tableName}`);
    
    const response = await fetch(DUNE_API_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Dune-Api-Key': apiKey,
      },
      body: JSON.stringify({
        namespace: DUNE_NAMESPACE,
        table_name: tableName,
        schema: schema,
        is_private: false,
        description: `TUNA Launchpad - ${tableName}`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (errorText.includes('already exists')) {
        console.log(`Table ${tableName} already exists`);
        return { success: true };
      }
      console.error(`Failed to create table ${tableName}:`, errorText);
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log(`Created table ${tableName}:`, result);
    return { success: true };
  } catch (error) {
    console.error(`Error creating table ${tableName}:`, error);
    return { success: false, error: String(error) };
  }
}

async function insertToDune(
  apiKey: string,
  tableName: string,
  data: Record<string, unknown>[]
): Promise<{ success: boolean; error?: string; rows_written?: number }> {
  try {
    if (data.length === 0) {
      console.log(`No data to insert for ${tableName}`);
      return { success: true, rows_written: 0 };
    }

    console.log(`Inserting ${data.length} rows to ${DUNE_NAMESPACE}.${tableName}`);
    const ndjson = data.map(row => JSON.stringify(row)).join('\n');

    const response = await fetch(`${DUNE_API_BASE}/${DUNE_NAMESPACE}/${tableName}/insert`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
        'X-Dune-Api-Key': apiKey,
      },
      body: ndjson,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to insert to ${tableName}:`, errorText);
      
      // Handle schema mismatch - delete and recreate table
      if (errorText.includes('missing from schema') || errorText.includes('column')) {
        console.log(`Schema mismatch for ${tableName}, recreating table...`);
        const schema = TABLE_SCHEMAS[tableName as keyof typeof TABLE_SCHEMAS];
        if (schema) {
          const createResult = await createDuneTable(apiKey, tableName, schema, true);
          if (createResult.success) {
            return insertToDune(apiKey, tableName, data);
          }
          return createResult;
        }
      }
      
      if (errorText.includes('not found') || errorText.includes('does not exist')) {
        console.log(`Table ${tableName} not found, creating it...`);
        const schema = TABLE_SCHEMAS[tableName as keyof typeof TABLE_SCHEMAS];
        if (schema) {
          const createResult = await createDuneTable(apiKey, tableName, schema);
          if (createResult.success) {
            return insertToDune(apiKey, tableName, data);
          }
          return createResult;
        }
      }
      
      return { success: false, error: errorText };
    }

    const result = await response.json();
    console.log(`Inserted ${data.length} rows to ${tableName}:`, result);
    return { success: true, rows_written: data.length };
  } catch (error) {
    console.error(`Error inserting to ${tableName}:`, error);
    return { success: false, error: String(error) };
  }
}

async function ensureTablesExist(apiKey: string): Promise<void> {
  console.log('Ensuring Dune tables exist...');
  for (const [tableName, schema] of Object.entries(TABLE_SCHEMAS)) {
    await createDuneTable(apiKey, tableName, schema);
  }
}

// Refresh Dune dashboard queries after data sync
async function refreshDashboardQueries(apiKey: string): Promise<{ refreshed: number; errors: string[] }> {
  if (DASHBOARD_QUERY_IDS.length === 0) {
    console.log('No dashboard query IDs configured - skipping query refresh');
    return { refreshed: 0, errors: [] };
  }

  console.log(`Refreshing ${DASHBOARD_QUERY_IDS.length} dashboard queries...`);
  const errors: string[] = [];
  let refreshed = 0;

  for (const queryId of DASHBOARD_QUERY_IDS) {
    try {
      const response = await fetch(`${DUNE_QUERY_API}/${queryId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Dune-Api-Key': apiKey,
        },
        body: JSON.stringify({ performance: 'medium' }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to refresh query ${queryId}:`, errorText);
        errors.push(`Query ${queryId}: ${errorText}`);
      } else {
        const result = await response.json();
        console.log(`Refreshed query ${queryId}:`, result.execution_id);
        refreshed++;
      }
    } catch (error) {
      console.error(`Error refreshing query ${queryId}:`, error);
      errors.push(`Query ${queryId}: ${String(error)}`);
    }
  }

  return { refreshed, errors };
}

async function fetchPlatformStats(supabase: SupabaseClient) {
  const timestamp = new Date().toISOString();

  const [tokensResult, transactionsResult, usersResult, feesResult, holdingsResult] = await Promise.all([
    supabase.from('tokens').select('status, market_cap_sol, volume_24h_sol, holder_count'),
    supabase.from('launchpad_transactions').select('sol_amount, user_wallet, created_at'),
    supabase.from('profiles').select('id', { count: 'exact' }),
    supabase.from('fee_claims').select('amount_sol'),
    supabase.from('token_holdings').select('id', { count: 'exact' }),
  ]);

  const tokens = tokensResult.data || [];
  const transactions = transactionsResult.data || [];
  const totalUsers = usersResult.count || 0;
  const fees = feesResult.data || [];
  const totalHolders = holdingsResult.count || 0;

  const totalTokens = tokens.length;
  const graduatedTokens = tokens.filter((t: { status: string }) => t.status === 'graduated').length;
  const activeTokens = tokens.filter((t: { status: string }) => t.status === 'active').length;
  const bondingTokens = tokens.filter((t: { status: string }) => t.status === 'bonding').length;
  const totalMarketCap = tokens.reduce((sum: number, t: { market_cap_sol: number | null }) => sum + (Number(t.market_cap_sol) || 0), 0);
  const volume24h = tokens.reduce((sum: number, t: { volume_24h_sol: number | null }) => sum + (Number(t.volume_24h_sol) || 0), 0);

  const totalTransactions = transactions.length;
  const totalVolume = transactions.reduce((sum: number, t: { sol_amount: number | null }) => sum + (Number(t.sol_amount) || 0), 0);
  const uniqueTraders = new Set(transactions.map((t: { user_wallet: string }) => t.user_wallet)).size;
  const totalFeesEarned = fees.reduce((sum: number, f: { amount_sol: number | null }) => sum + (Number(f.amount_sol) || 0), 0);

  return {
    timestamp,
    total_tokens: totalTokens,
    graduated_tokens: graduatedTokens,
    active_tokens: activeTokens,
    bonding_tokens: bondingTokens,
    total_transactions: totalTransactions,
    total_volume_sol: totalVolume,
    volume_24h_sol: volume24h,
    unique_traders: uniqueTraders,
    total_users: totalUsers,
    total_fees_earned_sol: totalFeesEarned,
    total_market_cap_sol: totalMarketCap,
    avg_market_cap_sol: totalTokens > 0 ? totalMarketCap / totalTokens : 0,
    total_holders: totalHolders,
    graduation_rate: totalTokens > 0 ? (graduatedTokens / totalTokens) * 100 : 0,
  };
}

async function fetchTokenSnapshots(supabase: SupabaseClient) {
  const snapshotTime = new Date().toISOString();

  const { data: tokens, error } = await supabase
    .from('tokens')
    .select('*')
    .order('market_cap_sol', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching tokens:', error);
    return [];
  }

  return (tokens || []).map((token: Record<string, unknown>) => {
    const createdAt = new Date(token.created_at as string);
    const ageHours = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);

    return {
      snapshot_time: snapshotTime,
      token_id: token.id,
      mint_address: token.mint_address,
      name: token.name,
      ticker: token.ticker,
      creator_wallet: token.creator_wallet,
      dbc_pool_address: token.dbc_pool_address,
      damm_pool_address: token.damm_pool_address,
      price_sol: Number(token.price_sol) || 0,
      market_cap_sol: Number(token.market_cap_sol) || 0,
      volume_24h_sol: Number(token.volume_24h_sol) || 0,
      holder_count: token.holder_count || 0,
      bonding_curve_progress: Number(token.bonding_curve_progress) || 0,
      status: token.status || 'bonding',
      created_at: token.created_at,
      graduated_at: token.graduated_at,
      age_hours: ageHours,
      price_change_24h: Number(token.price_change_24h) || 0,
    };
  });
}

async function fetchCreatorStats(supabase: SupabaseClient) {
  const snapshotTime = new Date().toISOString();

  const { data: tokens, error } = await supabase
    .from('tokens')
    .select('creator_wallet, status, market_cap_sol, volume_24h_sol, holder_count, created_at');

  if (error) {
    console.error('Error fetching creator stats:', error);
    return [];
  }

  // Group by creator
  const creatorMap = new Map<string, {
    tokens: number;
    graduated: number;
    volume: number;
    holders: number;
    marketCap: number;
    firstToken: Date;
    lastToken: Date;
  }>();

  for (const token of tokens || []) {
    const wallet = token.creator_wallet;
    const existing = creatorMap.get(wallet) || {
      tokens: 0,
      graduated: 0,
      volume: 0,
      holders: 0,
      marketCap: 0,
      firstToken: new Date(),
      lastToken: new Date(0),
    };

    const tokenDate = new Date(token.created_at);
    
    creatorMap.set(wallet, {
      tokens: existing.tokens + 1,
      graduated: existing.graduated + (token.status === 'graduated' ? 1 : 0),
      volume: existing.volume + (Number(token.volume_24h_sol) || 0),
      holders: existing.holders + (token.holder_count || 0),
      marketCap: existing.marketCap + (Number(token.market_cap_sol) || 0),
      firstToken: tokenDate < existing.firstToken ? tokenDate : existing.firstToken,
      lastToken: tokenDate > existing.lastToken ? tokenDate : existing.lastToken,
    });
  }

  return Array.from(creatorMap.entries()).map(([wallet, stats]) => ({
    snapshot_time: snapshotTime,
    creator_wallet: wallet,
    total_tokens_created: stats.tokens,
    graduated_tokens: stats.graduated,
    total_volume_sol: stats.volume,
    total_holders: stats.holders,
    total_market_cap_sol: stats.marketCap,
    avg_market_cap_sol: stats.tokens > 0 ? stats.marketCap / stats.tokens : 0,
    graduation_rate: stats.tokens > 0 ? (stats.graduated / stats.tokens) * 100 : 0,
    first_token_at: stats.firstToken.toISOString(),
    last_token_at: stats.lastToken.toISOString(),
  }));
}

async function fetchVolumeByToken(supabase: SupabaseClient) {
  const snapshotTime = new Date().toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  // Get all tokens
  const { data: tokens } = await supabase
    .from('tokens')
    .select('id, mint_address, name, ticker, volume_24h_sol');

  // Get all transactions from last 24h
  const { data: txs } = await supabase
    .from('launchpad_transactions')
    .select('token_id, sol_amount, transaction_type, user_wallet, created_at')
    .gte('created_at', twentyFourHoursAgo);

  const txMap = new Map<string, {
    vol1h: number;
    vol6h: number;
    vol24h: number;
    buys24h: number;
    sells24h: number;
    traders24h: Set<string>;
  }>();

  for (const tx of txs || []) {
    const existing = txMap.get(tx.token_id) || {
      vol1h: 0, vol6h: 0, vol24h: 0, buys24h: 0, sells24h: 0, traders24h: new Set<string>(),
    };

    const amount = Number(tx.sol_amount) || 0;
    const txTime = tx.created_at;

    existing.vol24h += amount;
    existing.traders24h.add(tx.user_wallet);
    
    if (tx.transaction_type === 'buy') existing.buys24h++;
    else existing.sells24h++;
    
    if (txTime >= oneHourAgo) existing.vol1h += amount;
    if (txTime >= sixHoursAgo) existing.vol6h += amount;

    txMap.set(tx.token_id, existing);
  }

  // Get total volume per token
  const { data: totalVolumes } = await supabase
    .from('launchpad_transactions')
    .select('token_id, sol_amount');

  const totalVolumeMap = new Map<string, number>();
  for (const tx of totalVolumes || []) {
    const existing = totalVolumeMap.get(tx.token_id) || 0;
    totalVolumeMap.set(tx.token_id, existing + (Number(tx.sol_amount) || 0));
  }

  return (tokens || []).map((token: Record<string, unknown>) => {
    const stats = txMap.get(token.id as string) || {
      vol1h: 0, vol6h: 0, vol24h: 0, buys24h: 0, sells24h: 0, traders24h: new Set(),
    };

    return {
      snapshot_time: snapshotTime,
      token_id: token.id,
      mint_address: token.mint_address,
      token_name: token.name,
      token_ticker: token.ticker,
      volume_1h_sol: stats.vol1h,
      volume_6h_sol: stats.vol6h,
      volume_24h_sol: stats.vol24h,
      volume_total_sol: totalVolumeMap.get(token.id as string) || 0,
      buy_count_24h: stats.buys24h,
      sell_count_24h: stats.sells24h,
      unique_traders_24h: stats.traders24h.size,
    };
  });
}

async function fetchHolderDistribution(supabase: SupabaseClient) {
  const snapshotTime = new Date().toISOString();

  // Get top holders per token (limit to top 10 per token)
  const { data: tokens } = await supabase
    .from('tokens')
    .select('id, mint_address, name, total_supply')
    .order('market_cap_sol', { ascending: false })
    .limit(100); // Top 100 tokens

  const results = [];

  for (const token of tokens || []) {
    const { data: holdings } = await supabase
      .from('token_holdings')
      .select('wallet_address, balance')
      .eq('token_id', token.id)
      .gt('balance', 0)
      .order('balance', { ascending: false })
      .limit(10);

    const totalSupply = Number(token.total_supply) || 1000000000;

    for (let i = 0; i < (holdings || []).length; i++) {
      const holding = holdings![i];
      results.push({
        snapshot_time: snapshotTime,
        token_id: token.id,
        mint_address: token.mint_address,
        token_name: token.name,
        holder_wallet: holding.wallet_address,
        balance: Number(holding.balance) || 0,
        percentage_of_supply: ((Number(holding.balance) || 0) / totalSupply) * 100,
        rank: i + 1,
      });
    }
  }

  return results;
}

async function fetchRecentTransactions(supabase: SupabaseClient) {
  const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

  const { data: transactions, error } = await supabase
    .from('launchpad_transactions')
    .select('*, tokens(name, ticker)')
    .gte('created_at', fifteenMinutesAgo)
    .order('created_at', { ascending: false })
    .limit(1000);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return (transactions || []).map((tx: Record<string, unknown>) => ({
    id: tx.id,
    token_id: tx.token_id,
    token_name: (tx.tokens as Record<string, unknown>)?.name || '',
    token_ticker: (tx.tokens as Record<string, unknown>)?.ticker || '',
    user_wallet: tx.user_wallet,
    transaction_type: tx.transaction_type,
    sol_amount: Number(tx.sol_amount) || 0,
    token_amount: Number(tx.token_amount) || 0,
    price_per_token: Number(tx.price_per_token) || 0,
    creator_fee_sol: Number(tx.creator_fee_sol) || 0,
    system_fee_sol: Number(tx.system_fee_sol) || 0,
    signature: tx.signature,
    created_at: tx.created_at,
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const duneApiKey = Deno.env.get('DUNE_API_KEY');
    if (!duneApiKey) {
      console.error('DUNE_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'DUNE_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting enhanced Dune sync...');

    // Ensure all tables exist
    await ensureTablesExist(duneApiKey);

    // Fetch all data in parallel
    const [platformStats, tokenSnapshots, creatorStats, volumeByToken, holderDistribution, recentTransactions] = await Promise.all([
      fetchPlatformStats(supabase),
      fetchTokenSnapshots(supabase),
      fetchCreatorStats(supabase),
      fetchVolumeByToken(supabase),
      fetchHolderDistribution(supabase),
      fetchRecentTransactions(supabase),
    ]);

    console.log(`Fetched: ${tokenSnapshots.length} tokens, ${creatorStats.length} creators, ${holderDistribution.length} holder records`);

    // Insert all data to Dune
    const [statsResult, tokensResult, creatorsResult, volumeResult, holdersResult, txResult] = await Promise.all([
      insertToDune(duneApiKey, 'platform_stats', [platformStats] as unknown as Record<string, unknown>[]),
      insertToDune(duneApiKey, 'token_snapshots', tokenSnapshots as unknown as Record<string, unknown>[]),
      insertToDune(duneApiKey, 'creator_stats', creatorStats as unknown as Record<string, unknown>[]),
      insertToDune(duneApiKey, 'volume_by_token', volumeByToken as unknown as Record<string, unknown>[]),
      insertToDune(duneApiKey, 'holder_distribution', holderDistribution as unknown as Record<string, unknown>[]),
      insertToDune(duneApiKey, 'transactions', recentTransactions as unknown as Record<string, unknown>[]),
    ]);

    const results = {
      timestamp: new Date().toISOString(),
      platform_stats: statsResult,
      token_snapshots: { ...tokensResult, count: tokenSnapshots.length },
      creator_stats: { ...creatorsResult, count: creatorStats.length },
      volume_by_token: { ...volumeResult, count: volumeByToken.length },
      holder_distribution: { ...holdersResult, count: holderDistribution.length },
      transactions: { ...txResult, count: recentTransactions.length },
    };

    const allSuccess = statsResult.success && tokensResult.success && creatorsResult.success && 
                       volumeResult.success && holdersResult.success && txResult.success;

    console.log('Dune sync completed:', results);

    // Refresh dashboard queries after successful data upload
    const queryRefreshResult = await refreshDashboardQueries(duneApiKey);
    console.log('Dashboard query refresh:', queryRefreshResult);

    return new Response(
      JSON.stringify({ 
        success: allSuccess, 
        results,
        queryRefresh: queryRefreshResult,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Dune sync error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
