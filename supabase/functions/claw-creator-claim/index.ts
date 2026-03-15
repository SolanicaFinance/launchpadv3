import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } from "https://esm.sh/@solana/web3.js@1.98.0";
import bs58 from "https://esm.sh/bs58@5.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MIN_CLAIM_SOL = 0.01;
const MAX_SINGLE_CLAIM_SOL = 5.0;
const CLAIM_COOLDOWN_MS = 60 * 60 * 1000;
const CLAIM_LOCK_SECONDS = 60;
const TREASURY_RESERVE_SOL = 0.05;

// Unified fee calculation: creator_fee_bps / trading_fee_bps
function getCreatorRatio(creatorFeeBps: number | null, tradingFeeBps: number | null): number {
  const bps = tradingFeeBps || 200;
  const cBps = creatorFeeBps || 0;
  if (bps <= 0) return 0;
  return cBps / bps;
}

/**
 * Calculate claimable amount for a twitter user.
 * Checks BOTH token-specific and username-based distributions to prevent double-pay.
 */
async function calculateClaimable(
  supabase: any,
  normalizedUsername: string,
  targetTokenIds: string[],
  funTokenIds: string[],
  clawTokenIds: string[],
  tokenBpsMap: Map<string, { creator_fee_bps: number; trading_fee_bps: number }>,
) {
  let totalCreatorEarned = 0;
  const tokenEarnings: Record<string, number> = {};

  // Get actual claimed fees from fun_fee_claims for fun tokens
  const funTargetIds = targetTokenIds.filter((id) => funTokenIds.includes(id));
  if (funTargetIds.length > 0) {
    const { data: feeClaims } = await supabase
      .from("fun_fee_claims")
      .select("fun_token_id, claimed_sol")
      .in("fun_token_id", funTargetIds);

    for (const fc of feeClaims || []) {
      const bps = tokenBpsMap.get(fc.fun_token_id) || { creator_fee_bps: 100, trading_fee_bps: 200 };
      const ratio = getCreatorRatio(bps.creator_fee_bps, bps.trading_fee_bps);
      const earned = Math.floor((fc.claimed_sol || 0) * ratio * 1e9) / 1e9;
      tokenEarnings[fc.fun_token_id] = (tokenEarnings[fc.fun_token_id] || 0) + earned;
      totalCreatorEarned += earned;
    }
  }

  // Also check claw_fee_claims for claw tokens
  const clawTargetIds = targetTokenIds.filter((id) => clawTokenIds.includes(id) && !funTokenIds.includes(id));
  if (clawTargetIds.length > 0) {
    const { data: feeClaims } = await supabase
      .from("claw_fee_claims")
      .select("fun_token_id, claimed_sol")
      .in("fun_token_id", clawTargetIds);

    for (const fc of feeClaims || []) {
      const bps = tokenBpsMap.get(fc.fun_token_id) || { creator_fee_bps: 100, trading_fee_bps: 200 };
      const ratio = getCreatorRatio(bps.creator_fee_bps, bps.trading_fee_bps);
      const earned = Math.floor((fc.claimed_sol || 0) * ratio * 1e9) / 1e9;
      tokenEarnings[fc.fun_token_id] = (tokenEarnings[fc.fun_token_id] || 0) + earned;
      totalCreatorEarned += earned;
    }
  }

  // Get already-paid distributions — check BOTH claw_distributions AND fun_distributions
  // This prevents double-claiming across the old and new systems
  const [
    { data: distByToken },
    { data: distByUsername },
    { data: funDistByToken },
    { data: funDistByUsername },
  ] = await Promise.all([
    targetTokenIds.length > 0
      ? supabase
          .from("claw_distributions")
          .select("amount_sol, fun_token_id, id")
          .in("fun_token_id", targetTokenIds)
          .in("distribution_type", ["creator_claim", "creator"])
          .in("status", ["completed", "pending"])
      : Promise.resolve({ data: [] }),
    supabase
      .from("claw_distributions")
      .select("amount_sol, fun_token_id, id")
      .eq("twitter_username", normalizedUsername)
      .in("distribution_type", ["creator_claim", "creator"])
      .in("status", ["completed", "pending"]),
    // Also check legacy fun_distributions table
    targetTokenIds.length > 0
      ? supabase
          .from("fun_distributions")
          .select("amount_sol, fun_token_id, id")
          .in("fun_token_id", targetTokenIds)
          .in("distribution_type", ["creator_claim", "creator"])
          .in("status", ["completed", "pending"])
      : Promise.resolve({ data: [] }),
    supabase
      .from("fun_distributions")
      .select("amount_sol, fun_token_id, id")
      .eq("twitter_username", normalizedUsername)
      .in("distribution_type", ["creator_claim", "creator"])
      .in("status", ["completed", "pending"]),
  ]);

  // Merge and deduplicate by id (prefix fun_ IDs to avoid collision)
  const allDists = new Map<string, any>();
  for (const d of [...(distByToken || []), ...(distByUsername || [])]) {
    allDists.set(d.id, d);
  }
  for (const d of [...(funDistByToken || []), ...(funDistByUsername || [])]) {
    allDists.set("fun_" + d.id, d);
  }

  let totalCreatorPaid = 0;
  const paidPerToken: Record<string, number> = {};
  for (const d of allDists.values()) {
    totalCreatorPaid += d.amount_sol || 0;
    if (d.fun_token_id) {
      paidPerToken[d.fun_token_id] = (paidPerToken[d.fun_token_id] || 0) + (d.amount_sol || 0);
    }
  }

  let claimable = Math.max(0, totalCreatorEarned - totalCreatorPaid);

  // Safety cap
  if (claimable > MAX_SINGLE_CLAIM_SOL) {
    console.log(`[saturn-creator-claim] ⚠️ Capping claim from ${claimable.toFixed(6)} to ${MAX_SINGLE_CLAIM_SOL} SOL`);
    claimable = MAX_SINGLE_CLAIM_SOL;
  }

  return { claimable, totalCreatorEarned, totalCreatorPaid, tokenEarnings, paidPerToken };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const { twitterUsername, tokenIds, checkOnly, creatorWallet } = body;
    const payoutWallet = body.payoutWallet || body.walletAddress;

    // Support either twitterUsername or creatorWallet for token lookup
    if (!twitterUsername && !creatorWallet) return new Response(JSON.stringify({ success: false, error: "twitterUsername or creatorWallet is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!checkOnly && !payoutWallet) return new Response(JSON.stringify({ success: false, error: "payoutWallet is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Determine if this is a wallet-based or twitter-based claim
    const isWalletBased = !!creatorWallet && !twitterUsername;

    if (payoutWallet) {
      try { new PublicKey(payoutWallet); } catch { return new Response(JSON.stringify({ success: false, error: "Invalid wallet address" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
    }

    const normalizedUsername = twitterUsername ? twitterUsername.replace(/^@/, "").toLowerCase() : null;
    const lockKey = normalizedUsername || creatorWallet;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const treasuryKey = Deno.env.get("TREASURY_PRIVATE_KEY");
    const heliusRpcUrl = Deno.env.get("HELIUS_RPC_URL") || Deno.env.get("VITE_HELIUS_RPC_URL");

    if (!treasuryKey || !heliusRpcUrl) return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, supabaseKey);

    // ===== Find tokens — wallet-based or twitter-based =====
    let funTokenIds: string[] = [];
    let clawTokenIds: string[] = [];

    if (isWalletBased) {
      // Wallet-based: find tokens by creator_wallet
      const [{ data: funTokenData }, { data: saturnTokenData }] = await Promise.all([
        supabase.from("fun_tokens").select("id").eq("creator_wallet", creatorWallet),
        supabase.from("tokens").select("id").eq("creator_wallet", creatorWallet),
      ]);
      funTokenIds = (funTokenData || []).map((t: any) => t.id);
      // Saturn tokens go into funTokenIds for unified processing
      const saturnIds = (saturnTokenData || []).map((t: any) => t.id);
      funTokenIds = [...new Set([...funTokenIds, ...saturnIds])];
    } else {
      // Twitter-based lookup (legacy)
      const { data: socialPosts } = await supabase
        .from("agent_social_posts")
        .select("fun_token_id")
        .ilike("post_author", normalizedUsername!)
        .eq("platform", "twitter")
        .eq("status", "completed")
        .not("fun_token_id", "is", null);

      funTokenIds = [...new Set((socialPosts || []).map((p: any) => p.fun_token_id).filter(Boolean))];

      const { data: matchingAgents } = await supabase
        .from("claw_agents")
        .select("id")
        .ilike("twitter_handle", normalizedUsername!);

      if (matchingAgents && matchingAgents.length > 0) {
        const agentIds = matchingAgents.map((a: any) => a.id);
        const [{ data: agentClawTokens }, { data: agentTokenLinks }] = await Promise.all([
          supabase.from("claw_tokens").select("id").in("agent_id", agentIds),
          supabase.from("claw_agent_tokens").select("fun_token_id").in("agent_id", agentIds),
        ]);
        clawTokenIds = [
          ...(agentClawTokens || []).map((t: any) => t.id),
          ...(agentTokenLinks || []).map((t: any) => t.fun_token_id),
        ];
        clawTokenIds = [...new Set(clawTokenIds)];
      }
    }

    const allTokenIds = [...new Set([...funTokenIds, ...clawTokenIds])];
    const targetTokenIds = tokenIds?.length ? allTokenIds.filter((id: string) => tokenIds.includes(id)) : allTokenIds;

    if (targetTokenIds.length === 0) {
      const who = isWalletBased ? `wallet ${creatorWallet?.slice(0,8)}...` : `@${normalizedUsername}`;
      return new Response(JSON.stringify({ success: false, error: `No tokens found launched by ${who}` }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Fetch token bps for accurate creator share calculation =====
    const tokenBpsMap = new Map<string, { creator_fee_bps: number; trading_fee_bps: number }>();
    
    if (isWalletBased) {
      // For wallet-based, query both fun_tokens and tokens tables
      const [{ data: funBps }, { data: saturnBps }] = await Promise.all([
        targetTokenIds.length > 0 ? supabase.from("fun_tokens").select("id, creator_fee_bps, trading_fee_bps").in("id", targetTokenIds) : Promise.resolve({ data: [] }),
        targetTokenIds.length > 0 ? supabase.from("tokens").select("id, creator_fee_bps, system_fee_bps").in("id", targetTokenIds) : Promise.resolve({ data: [] }),
      ]);
      for (const t of funBps || []) {
        tokenBpsMap.set(t.id, { creator_fee_bps: t.creator_fee_bps || 100, trading_fee_bps: t.trading_fee_bps || 200 });
      }
      for (const t of saturnBps || []) {
        if (!tokenBpsMap.has(t.id)) {
          const cBps = t.creator_fee_bps || 100;
          tokenBpsMap.set(t.id, { creator_fee_bps: cBps, trading_fee_bps: cBps + (t.system_fee_bps || 100) });
        }
      }
    } else {
      const funTargetIds = targetTokenIds.filter((id: string) => funTokenIds.includes(id));
      const clawTargetIds = targetTokenIds.filter((id: string) => clawTokenIds.includes(id) && !funTokenIds.includes(id));
      
      if (funTargetIds.length > 0) {
        const { data: funTokenData } = await supabase.from("fun_tokens").select("id, creator_fee_bps, trading_fee_bps").in("id", funTargetIds);
        for (const t of funTokenData || []) {
          tokenBpsMap.set(t.id, { creator_fee_bps: t.creator_fee_bps || 100, trading_fee_bps: t.trading_fee_bps || 200 });
        }
      }
      if (clawTargetIds.length > 0) {
        const { data: clawTokenData } = await supabase.from("claw_tokens").select("id, creator_fee_bps, trading_fee_bps").in("id", clawTargetIds);
        for (const t of clawTokenData || []) {
          tokenBpsMap.set(t.id, { creator_fee_bps: t.creator_fee_bps || 100, trading_fee_bps: t.trading_fee_bps || 200 });
        }
      }
    }

    // ===== Rate limit check — by wallet or twitter_username =====
    let rateLimitQuery = supabase
      .from("claw_distributions")
      .select("created_at")
      .in("distribution_type", ["creator_claim", "creator"])
      .in("status", ["completed", "pending"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (isWalletBased) {
      rateLimitQuery = rateLimitQuery.eq("creator_wallet", creatorWallet);
    } else {
      rateLimitQuery = rateLimitQuery.eq("twitter_username", normalizedUsername);
    }

    const { data: lastClaim } = await rateLimitQuery.maybeSingle();

    const now = Date.now();
    let canClaim = true;
    let remainingSeconds = 0;
    let nextClaimAt: string | null = null;

    if (lastClaim) {
      const timeSince = now - new Date(lastClaim.created_at).getTime();
      if (timeSince < CLAIM_COOLDOWN_MS) {
        canClaim = false;
        remainingSeconds = Math.ceil((CLAIM_COOLDOWN_MS - timeSince) / 1000);
        nextClaimAt = new Date(new Date(lastClaim.created_at).getTime() + CLAIM_COOLDOWN_MS).toISOString();
      }
    }

    // Calculate claimable
    const lookupKey = normalizedUsername || creatorWallet;
    const initialCalc = await calculateClaimable(supabase, lookupKey, targetTokenIds, funTokenIds, clawTokenIds, tokenBpsMap);

    const who = isWalletBased ? `wallet:${creatorWallet?.slice(0,8)}` : `@${normalizedUsername}`;
    console.log(`[saturn-creator-claim] ${who}: earned=${initialCalc.totalCreatorEarned.toFixed(6)}, paid=${initialCalc.totalCreatorPaid.toFixed(6)}, claimable=${initialCalc.claimable.toFixed(6)}, tokens=${targetTokenIds.length}`);

    if (checkOnly) {
      return new Response(JSON.stringify({
        success: true, canClaim, remainingSeconds, nextClaimAt,
        pendingAmount: initialCalc.claimable,
        totalEarned: initialCalc.totalCreatorEarned,
        totalClaimed: initialCalc.totalCreatorPaid,
        minClaimAmount: MIN_CLAIM_SOL,
        meetsMinimum: initialCalc.claimable >= MIN_CLAIM_SOL,
        tokenCount: targetTokenIds.length,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (!canClaim) {
      return new Response(JSON.stringify({ success: false, error: `Rate limited. Next claim in ${Math.floor(remainingSeconds / 60)}m`, rateLimited: true, remainingSeconds, pendingAmount: initialCalc.claimable }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (initialCalc.claimable < MIN_CLAIM_SOL) {
      return new Response(JSON.stringify({ success: false, error: `Minimum claim is ${MIN_CLAIM_SOL} SOL. Current: ${initialCalc.claimable.toFixed(6)} SOL`, pendingAmount: initialCalc.claimable }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ===== Acquire lock =====
    let lockAcquired: boolean;
    if (isWalletBased) {
      const { data } = await supabase.rpc("acquire_creator_claim_lock_by_wallet", { p_wallet_address: creatorWallet, p_duration_seconds: CLAIM_LOCK_SECONDS });
      lockAcquired = !!data;
    } else {
      const { data } = await supabase.rpc("acquire_claw_creator_claim_lock", { p_twitter_username: normalizedUsername, p_duration_seconds: CLAIM_LOCK_SECONDS });
      lockAcquired = !!data;
    }
    if (!lockAcquired) {
      return new Response(JSON.stringify({ success: false, error: "Another claim in progress", locked: true }), { status: 423, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    try {
      // Re-verify after lock
      const verifiedCalc = await calculateClaimable(supabase, lookupKey, targetTokenIds, funTokenIds, clawTokenIds, tokenBpsMap);
      
      if (verifiedCalc.claimable < MIN_CLAIM_SOL) {
        console.log(`[saturn-creator-claim] ⚠️ Post-lock: claimable=${verifiedCalc.claimable.toFixed(6)} < ${MIN_CLAIM_SOL}`);
        return new Response(JSON.stringify({ success: false, error: `Nothing left to claim. Another claim may have just completed.`, pendingAmount: verifiedCalc.claimable }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Re-check rate limit after lock
      let recentRateLimitQuery = supabase
        .from("claw_distributions")
        .select("created_at")
        .in("distribution_type", ["creator_claim", "creator"])
        .in("status", ["completed", "pending"])
        .order("created_at", { ascending: false })
        .limit(1);

      if (isWalletBased) {
        recentRateLimitQuery = recentRateLimitQuery.eq("creator_wallet", creatorWallet);
      } else {
        recentRateLimitQuery = recentRateLimitQuery.eq("twitter_username", normalizedUsername);
      }

      const { data: recentClaim } = await recentRateLimitQuery.maybeSingle();

      if (recentClaim) {
        const timeSinceRecent = Date.now() - new Date(recentClaim.created_at).getTime();
        if (timeSinceRecent < CLAIM_COOLDOWN_MS) {
          const secs = Math.ceil((CLAIM_COOLDOWN_MS - timeSinceRecent) / 1000);
          return new Response(JSON.stringify({ success: false, error: `Rate limited. Try again in ${Math.floor(secs / 60)}m`, rateLimited: true, remainingSeconds: secs }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
      }

      const claimable = verifiedCalc.claimable;

      // ===== STEP 1: Record distributions as PENDING *before* sending SOL =====
      const distributionIds: string[] = [];
      for (const tokenId of targetTokenIds) {
        const tokenEarned = verifiedCalc.tokenEarnings[tokenId] || 0;
        const tokenPaid = verifiedCalc.paidPerToken[tokenId] || 0;
        const tokenClaimable = Math.max(0, tokenEarned - tokenPaid);
        if (tokenClaimable > 0.000001) {
          const { data: inserted, error: insertError } = await supabase.from("claw_distributions").insert({
            fun_token_id: null, // Use null to avoid any FK issues
            creator_wallet: payoutWallet,
            amount_sol: tokenClaimable,
            distribution_type: "creator_claim",
            signature: null,
            status: "pending",
            twitter_username: normalizedUsername || null,
          }).select("id").single();

          if (insertError || !inserted) {
            console.error(`[saturn-creator-claim] ❌ Failed to insert pending distribution:`, insertError);
            // Clean up any already-inserted pending distributions
            if (distributionIds.length > 0) {
              await supabase.from("claw_distributions").delete().in("id", distributionIds);
            }
            throw new Error("Failed to record distribution - claim aborted for safety");
          }
          distributionIds.push(inserted.id);
          console.log(`[saturn-creator-claim] 📝 Recorded pending distribution ${inserted.id}: ${tokenClaimable.toFixed(6)} SOL`);
        }
      }

      if (distributionIds.length === 0) {
        throw new Error("No distributions to record - claim aborted");
      }

      console.log(`[saturn-creator-claim] ✅ ${distributionIds.length} pending distributions recorded. Now sending SOL...`);

      // ===== STEP 2: Send SOL on-chain =====
      let treasuryKeypair: Keypair;
      try {
        if (treasuryKey.startsWith("[")) treasuryKeypair = Keypair.fromSecretKey(new Uint8Array(JSON.parse(treasuryKey)));
        else treasuryKeypair = Keypair.fromSecretKey(bs58.decode(treasuryKey));
      } catch {
        // Clean up pending distributions
        await supabase.from("claw_distributions").update({ status: "failed" }).in("id", distributionIds);
        throw new Error("Invalid treasury configuration");
      }

      const connection = new Connection(heliusRpcUrl, "confirmed");
      const treasuryBalance = await connection.getBalance(treasuryKeypair.publicKey);
      const treasuryBalanceSol = treasuryBalance / 1e9;

      console.log(`[saturn-creator-claim] Treasury: ${treasuryBalanceSol.toFixed(6)} SOL, claiming: ${claimable.toFixed(6)} SOL`);

      if (treasuryBalanceSol < claimable + TREASURY_RESERVE_SOL) {
        // Mark distributions as failed
        await supabase.from("claw_distributions").update({ status: "failed" }).in("id", distributionIds);
        throw new Error(`Insufficient treasury balance (${treasuryBalanceSol.toFixed(4)} SOL available, need ${(claimable + TREASURY_RESERVE_SOL).toFixed(4)} SOL)`);
      }

      let signature: string;
      try {
        const recipientPubkey = new PublicKey(payoutWallet);
        const lamports = Math.floor(claimable * 1e9);
        const transaction = new Transaction().add(SystemProgram.transfer({ fromPubkey: treasuryKeypair.publicKey, toPubkey: recipientPubkey, lamports }));
        const { blockhash } = await connection.getLatestBlockhash();
        transaction.recentBlockhash = blockhash;
        transaction.feePayer = treasuryKeypair.publicKey;
        signature = await sendAndConfirmTransaction(connection, transaction, [treasuryKeypair], { commitment: "confirmed", maxRetries: 3 });
      } catch (txError) {
        // Mark distributions as failed since SOL wasn't sent
        await supabase.from("claw_distributions").update({ status: "failed" }).in("id", distributionIds);
        throw txError;
      }

      console.log(`[saturn-creator-claim] ✅ Sent ${claimable.toFixed(6)} SOL to ${payoutWallet}, sig: ${signature}`);

      // ===== STEP 3: Mark distributions as completed with signature =====
      const { error: updateError } = await supabase
        .from("claw_distributions")
        .update({ status: "completed", signature })
        .in("id", distributionIds);

      if (updateError) {
        console.error(`[saturn-creator-claim] ⚠️ Failed to mark distributions as completed (SOL was sent!):`, updateError);
        // SOL was sent but we couldn't update status - this is logged but not fatal
      }

      return new Response(JSON.stringify({
        success: true, claimedAmount: claimable, payoutWallet, signature,
        solscanUrl: `https://solscan.io/tx/${signature}`,
        tokensClaimed: targetTokenIds.length,
        nextClaimAt: new Date(Date.now() + CLAIM_COOLDOWN_MS).toISOString(),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    } finally {
      await supabase.rpc("release_claw_creator_claim_lock", { p_twitter_username: normalizedUsername });
    }
  } catch (error) {
    console.error("[saturn-creator-claim] Error:", error);
    return new Response(JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
