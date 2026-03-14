import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Treasury/deployer wallet that created all the tokens
const DEPLOYER_WALLET = "B85zVUNhN6bzyjEVkn7qwMVYTYodKUdWAfBHztpWxWvc";

// Meteora DBC Program ID
const DBC_PROGRAM_ID = "dbcij3LWUppWqq96dh6gJWwBifmcGfLSB5D4DuSMaqN";

// Meteora API base URL
const METEORA_API_URL = Deno.env.get("METEORA_API_URL") || Deno.env.get("VITE_METEORA_API_URL");

interface PoolData {
  poolAddress: string;
  mintAddress?: string;
  tokenName?: string;
  isRegistered: boolean;
  registeredIn?: string;
  claimableSol?: number;
  lastCheckedAt?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  
  // Parse request body
  let mode = "scan"; // Default: scan for pools
  let checkFees = false;
  let poolsToCheck: string[] = [];
  
  try {
    const body = await req.json().catch(() => ({}));
    mode = body.mode || "scan";
    checkFees = body.checkFees === true;
    poolsToCheck = body.pools || [];
  } catch {
    // Use defaults
  }

  console.log(`[treasury-scan-pools] Starting in mode=${mode}, checkFees=${checkFees}`);

  try {
    const heliusApiKey = Deno.env.get("HELIUS_API_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`;
    
    if (!heliusApiKey) {
      throw new Error("HELIUS_API_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get registered tokens from database
    const { data: funTokens } = await supabase
      .from("fun_tokens")
      .select("mint_address, dbc_pool_address, name, ticker");
    
    const { data: tokens } = await supabase
      .from("tokens")
      .select("mint_address, dbc_pool_address, name, ticker");

    const registeredPools = new Map<string, { name: string; ticker: string; table: string; mintAddress?: string }>();

    (funTokens || []).forEach((t) => {
      if (t.dbc_pool_address) {
        registeredPools.set(t.dbc_pool_address, { 
          name: t.name, 
          ticker: t.ticker, 
          table: "fun_tokens",
          mintAddress: t.mint_address,
        });
      }
    });

    (tokens || []).forEach((t) => {
      if (t.dbc_pool_address) {
        registeredPools.set(t.dbc_pool_address, { 
          name: t.name, 
          ticker: t.ticker, 
          table: "tokens",
          mintAddress: t.mint_address,
        });
      }
    });

    // MODE: check-fees - Only check fees for specific pools
    if (mode === "check-fees" && poolsToCheck.length > 0) {
      console.log(`[treasury-scan-pools] Checking fees for ${poolsToCheck.length} pools`);
      
      const results: PoolData[] = [];
      const BATCH_SIZE = 5;
      
      for (let i = 0; i < poolsToCheck.length; i += BATCH_SIZE) {
        const batch = poolsToCheck.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async (poolAddress) => {
          const regInfo = registeredPools.get(poolAddress);
          
          try {
            if (!METEORA_API_URL) {
              return { poolAddress, claimableSol: 0, isRegistered: !!regInfo };
            }
            
            const feeResponse = await fetch(
              `${METEORA_API_URL}/api/fees/claim-from-pool?poolAddress=${poolAddress}`,
              { method: "GET", headers: { "Content-Type": "application/json" } }
            );
            
            let claimableSol = 0;
            let mintAddress = regInfo?.mintAddress;
            let tokenName = regInfo ? `${regInfo.name} ($${regInfo.ticker})` : undefined;
            
            if (feeResponse.ok) {
              const feeData = await feeResponse.json();
              claimableSol = feeData.claimableSol || 0;
              mintAddress = feeData.mintAddress || mintAddress;
              tokenName = tokenName || feeData.tokenName;
            }
            
            // Cache to database
            await supabase.rpc("backend_upsert_pool_cache", {
              p_pool_address: poolAddress,
              p_mint_address: mintAddress || null,
              p_token_name: tokenName || null,
              p_is_registered: !!regInfo,
              p_registered_in: regInfo?.table || null,
              p_claimable_sol: claimableSol,
            });
            
            return {
              poolAddress,
              mintAddress,
              tokenName,
              isRegistered: !!regInfo,
              registeredIn: regInfo?.table,
              claimableSol,
            } as PoolData;
          } catch (err) {
            console.warn(`Error checking pool ${poolAddress}:`, err);
            return { poolAddress, claimableSol: 0, isRegistered: !!regInfo } as PoolData;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
        
        if (i + BATCH_SIZE < poolsToCheck.length) {
          await new Promise((r) => setTimeout(r, 200));
        }
      }
      
      const claimablePools = results.filter((p) => (p.claimableSol || 0) >= 0.001);
      const totalClaimable = claimablePools.reduce((sum, p) => sum + (p.claimableSol || 0), 0);
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: "check-fees",
          summary: {
            checkedCount: results.length,
            claimableCount: claimablePools.length,
            totalClaimableSol: totalClaimable,
          },
          pools: results,
          duration: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODE: get-cached - Return cached pools from database
    if (mode === "get-cached") {
      const { data: cachedPools } = await supabase.rpc("get_treasury_pool_cache");
      
      const pools = (cachedPools || []).map((p: Record<string, unknown>) => ({
        poolAddress: p.pool_address,
        mintAddress: p.mint_address,
        tokenName: p.token_name,
        isRegistered: p.is_registered,
        registeredIn: p.registered_in,
        claimableSol: Number(p.claimable_sol) || 0,
        lastCheckedAt: p.last_checked_at,
      }));
      
      const claimablePools = pools.filter((p: PoolData) => (p.claimableSol || 0) >= 0.001);
      const totalClaimable = claimablePools.reduce((sum: number, p: PoolData) => sum + (p.claimableSol || 0), 0);
      
      return new Response(
        JSON.stringify({
          success: true,
          mode: "get-cached",
          summary: {
            totalPools: pools.length,
            claimablePoolCount: claimablePools.length,
            totalClaimableSol: totalClaimable,
          },
          pools: claimablePools,
          allPools: pools,
          duration: Date.now() - startTime,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // MODE: scan - Discover all DBC pools from transaction history
    console.log("[treasury-scan-pools] Starting pool discovery scan...");

    // Get all transaction signatures
    const allSignatures: string[] = [];
    let beforeSignature: string | undefined = undefined;

    for (let page = 0; page < 50; page++) {
      const sigParams: Record<string, unknown> = { limit: 1000 };
      if (beforeSignature) sigParams.before = beforeSignature;

      const sigResponse = await fetch(heliusRpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: `sigs-${page}`,
          method: "getSignaturesForAddress",
          params: [DEPLOYER_WALLET, sigParams],
        }),
      });

      if (!sigResponse.ok) break;

      const sigData = await sigResponse.json();
      const signatures = sigData.result || [];
      if (signatures.length === 0) break;

      for (const sig of signatures) {
        if (sig.signature && !sig.err) allSignatures.push(sig.signature);
      }

      beforeSignature = signatures[signatures.length - 1]?.signature;
      if (signatures.length < 1000) break;
      await new Promise((r) => setTimeout(r, 50));
    }

    console.log(`[treasury-scan-pools] Found ${allSignatures.length} signatures`);

    // Parse transactions to find DBC pools
    const allDbcPools = new Set<string>();
    const BATCH_SIZE = 20;

    for (let i = 0; i < allSignatures.length; i += BATCH_SIZE) {
      const batch = allSignatures.slice(i, i + BATCH_SIZE);
      
      const txPromises = batch.map(async (sig) => {
        try {
          const txResponse = await fetch(heliusRpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: sig,
              method: "getTransaction",
              params: [sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }],
            }),
          });
          if (!txResponse.ok) return null;
          return (await txResponse.json()).result;
        } catch {
          return null;
        }
      });

      const txResults = await Promise.all(txPromises);

      for (const tx of txResults) {
        if (!tx?.transaction?.message) continue;

        const accountKeys = tx.transaction.message.accountKeys || [];
        const instructions = tx.transaction.message.instructions || [];
        const innerInstructions = tx.meta?.innerInstructions || [];

        // Check if involves DBC program
        const involvesDbc = accountKeys.some((k: { pubkey?: string } | string) => 
          (typeof k === 'string' ? k : k.pubkey) === DBC_PROGRAM_ID
        );

        if (involvesDbc) {
          for (const ix of instructions) {
            if (ix.programId === DBC_PROGRAM_ID) {
              const accounts = ix.accounts || [];
              if (accounts.length > 0) {
                const poolAddr = typeof accounts[0] === 'string' ? accounts[0] : accounts[0]?.pubkey;
                if (poolAddr?.length >= 32) allDbcPools.add(poolAddr);
              }
            }
          }

          for (const innerGroup of innerInstructions) {
            for (const innerIx of innerGroup.instructions || []) {
              if (innerIx.programId === DBC_PROGRAM_ID) {
                const accounts = innerIx.accounts || [];
                if (accounts.length > 0) {
                  const poolAddr = typeof accounts[0] === 'string' ? accounts[0] : accounts[0]?.pubkey;
                  if (poolAddr?.length >= 32) allDbcPools.add(poolAddr);
                }
              }
            }
          }
        }
      }

      if ((i + BATCH_SIZE) % 200 === 0) {
        console.log(`[treasury-scan-pools] Processed ${i + BATCH_SIZE}/${allSignatures.length}, found ${allDbcPools.size} pools`);
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    // Add registered pools
    for (const poolAddr of registeredPools.keys()) {
      allDbcPools.add(poolAddr);
    }

    const poolAddresses = Array.from(allDbcPools);
    console.log(`[treasury-scan-pools] Discovered ${poolAddresses.length} unique DBC pools`);

    // Cache all discovered pools to database (without fee check yet)
    for (const poolAddress of poolAddresses) {
      const regInfo = registeredPools.get(poolAddress);
      await supabase.rpc("backend_upsert_pool_cache", {
        p_pool_address: poolAddress,
        p_mint_address: regInfo?.mintAddress || null,
        p_token_name: regInfo ? `${regInfo.name} ($${regInfo.ticker})` : null,
        p_is_registered: !!regInfo,
        p_registered_in: regInfo?.table || null,
        p_claimable_sol: 0, // Will be updated in check-fees mode
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[treasury-scan-pools] Scan complete: ${poolAddresses.length} pools cached, ${duration}ms`);

    return new Response(
      JSON.stringify({
        success: true,
        mode: "scan",
        summary: {
          totalPoolsDiscovered: poolAddresses.length,
          registeredCount: poolAddresses.filter(p => registeredPools.has(p)).length,
          unregisteredCount: poolAddresses.filter(p => !registeredPools.has(p)).length,
          totalSignaturesScanned: allSignatures.length,
        },
        pools: poolAddresses.slice(0, 50), // Return first 50 for preview
        allPoolAddresses: poolAddresses,
        deployerWallet: DEPLOYER_WALLET,
        duration,
        nextStep: "Call with mode='check-fees' and pools array to check claimable fees",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[treasury-scan-pools] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: Date.now() - startTime,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
