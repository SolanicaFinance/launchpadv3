import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, x-launchpad-id",
};

const PLATFORM_FEE_WALLET = "HSVmkUnmjD9YLJmgeHCRyL1isusKkU3xv4VwDaZJqRx";
const FEE_BPS = 200; // 2% fee
const API_USER_FEE_SHARE = 0.75;
const PLATFORM_FEE_SHARE = 0.25;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mintAddress, userWallet, amount, isBuy, privyUserId, profileId, signature: clientSignature, mode } = await req.json();
    
    const launchpadId = req.headers.get("x-launchpad-id");
    const apiKey = req.headers.get("x-api-key");

    console.log("[launchpad-swap] Request:", { mintAddress, userWallet, amount, isBuy, hasSignature: !!clientSignature, mode, launchpadId });

    if (!mintAddress || !userWallet || amount === undefined) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: mintAddress, userWallet, amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if trade is from an API launchpad
    let apiAccountId: string | null = null;
    let apiUserFeeWallet: string | null = null;
    
    if (launchpadId) {
      const { data: launchpad } = await supabase
        .from("api_launchpads")
        .select("id, api_account_id, api_accounts(id, fee_wallet_address)")
        .eq("id", launchpadId)
        .single();
      
      if (launchpad) {
        apiAccountId = launchpad.api_account_id;
        apiUserFeeWallet = (launchpad.api_accounts as any)?.fee_wallet_address;
      }
    }

    // Get token
    const { data: token, error: tokenError } = await supabase
      .from("tokens")
      .select("*")
      .eq("mint_address", mintAddress)
      .single();

    if (tokenError || !token) {
      console.error("[launchpad-swap] Token not found:", tokenError);
      return new Response(
        JSON.stringify({ error: "Token not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (token.status === "graduated") {
      return new Response(
        JSON.stringify({ 
          error: "Token has graduated. Trade on DEX.",
          jupiterUrl: `https://jup.ag/swap/SOL-${mintAddress}`,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== RECORD MODE =====
    // When mode === 'record', the client has already executed the on-chain swap.
    // We just record the transaction in the database with the real signature.
    if (mode === 'record' && clientSignature) {
      console.log("[launchpad-swap] Record mode - recording real swap:", { signature: clientSignature, isBuy, amount });

      // Calculate estimated values for DB record using bonding curve math
      const virtualSol = token.virtual_sol_reserves || 30;
      const virtualToken = token.virtual_token_reserves || 1_000_000_000;
      const realSol = token.real_sol_reserves || 0;
      const k = virtualSol * virtualToken;

      let tokensOut = 0;
      let solOut = 0;
      let newPrice = token.price_sol || 0.00000003;
      let newVirtualSol = virtualSol;
      let newVirtualToken = virtualToken;
      let newRealSol = realSol;
      let solAmount = 0;
      let tokenAmount = 0;
      let systemFee = 0;

      if (isBuy) {
        const grossSolIn = amount;
        const totalFee = (grossSolIn * FEE_BPS) / 10000;
        systemFee = totalFee;
        const solIn = grossSolIn - totalFee;
        newVirtualSol = virtualSol + solIn;
        newVirtualToken = k / newVirtualSol;
        tokensOut = virtualToken - newVirtualToken;
        newRealSol = realSol + solIn;
        newPrice = newVirtualSol / newVirtualToken;
        solAmount = grossSolIn;
        tokenAmount = tokensOut;
      } else {
        const tokensIn = amount;
        newVirtualToken = virtualToken + tokensIn;
        newVirtualSol = k / newVirtualToken;
        const grossSolOut = virtualSol - newVirtualSol;
        const totalFee = (grossSolOut * FEE_BPS) / 10000;
        systemFee = totalFee;
        solOut = grossSolOut - totalFee;
        newRealSol = Math.max(0, realSol - grossSolOut);
        newPrice = newVirtualSol / newVirtualToken;
        solAmount = solOut;
        tokenAmount = tokensIn;
      }

      const graduationThreshold = token.graduation_threshold_sol || 85;
      const bondingProgress = Math.min(100, (newRealSol / graduationThreshold) * 100);
      const shouldGraduate = newRealSol >= graduationThreshold;
      const newStatus = shouldGraduate ? "graduated" : "bonding";
      const marketCap = newPrice * (token.total_supply || 1_000_000_000);

      // Update token state
      await supabase.from("tokens").update({
        virtual_sol_reserves: newVirtualSol,
        virtual_token_reserves: newVirtualToken,
        real_sol_reserves: newRealSol,
        price_sol: newPrice,
        bonding_curve_progress: bondingProgress,
        market_cap_sol: marketCap,
        status: newStatus,
        graduated_at: shouldGraduate && !token.graduated_at ? new Date().toISOString() : token.graduated_at,
        updated_at: new Date().toISOString(),
      }).eq("id", token.id);

      // Record transaction with real signature
      const txPayload = {
        token_id: token.id,
        user_wallet: userWallet,
        user_profile_id: profileId || null,
        transaction_type: isBuy ? "buy" : "sell",
        sol_amount: solAmount,
        token_amount: tokenAmount,
        price_per_token: newPrice,
        system_fee_sol: systemFee,
        creator_fee_sol: 0,
        signature: clientSignature,
      };

      const { error: txError } = await supabase.from("launchpad_transactions").insert(txPayload);
      if (txError) {
        // Retry without profile_id
        await supabase.from("launchpad_transactions").insert({ ...txPayload, user_profile_id: null });
      }

      // Update holdings
      if (isBuy) {
        const { data: existing } = await supabase.from("token_holdings").select("*")
          .eq("token_id", token.id).eq("wallet_address", userWallet).single();
        if (existing) {
          await supabase.from("token_holdings").update({
            balance: existing.balance + tokensOut,
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          const { error: insertErr } = await supabase.from("token_holdings").insert({
            token_id: token.id, wallet_address: userWallet, profile_id: profileId || null, balance: tokensOut,
          });
          if (insertErr) {
            await supabase.from("token_holdings").insert({
              token_id: token.id, wallet_address: userWallet, profile_id: null, balance: tokensOut,
            });
          }
        }
      } else {
        const { data: existing } = await supabase.from("token_holdings").select("*")
          .eq("token_id", token.id).eq("wallet_address", userWallet).single();
        if (existing) {
          await supabase.from("token_holdings").update({
            balance: Math.max(0, existing.balance - amount),
            updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        }
      }

      // Update holder count
      const { count: holderCount } = await supabase.from("token_holdings")
        .select("*", { count: "exact", head: true })
        .eq("token_id", token.id).gt("balance", 0);
      await supabase.from("tokens").update({ holder_count: holderCount || 0 }).eq("id", token.id);

      // Record price history
      await supabase.from('token_price_history').insert({
        token_id: token.id, price_sol: newPrice, market_cap_sol: marketCap,
        volume_sol: solAmount, interval_type: '1m', timestamp: new Date().toISOString(),
      });

      // Record referral reward if trader has a referrer (5% of system fee)
      if (profileId && systemFee > 0) {
        try {
          const { data: referrerId } = await supabase.rpc("get_referrer_for_user", { p_user_id: profileId });
          if (referrerId) {
            const REFERRAL_REWARD_PCT = 5;
            const referralReward = systemFee * (REFERRAL_REWARD_PCT / 100);
            if (referralReward > 0) {
              await supabase.from("referral_rewards").insert({
                referrer_id: referrerId,
                referred_id: profileId,
                trade_sol_amount: solAmount,
                reward_sol: referralReward,
                reward_pct: REFERRAL_REWARD_PCT,
                trade_signature: clientSignature,
                paid: false,
              });
              console.log(`[launchpad-swap] Referral reward: ${referralReward.toFixed(6)} SOL for referrer ${referrerId}`);
            }
          }
        } catch (refErr) {
          console.warn("[launchpad-swap] Referral reward recording failed (non-fatal):", refErr);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          signature: clientSignature,
          tokensOut: isBuy ? tokensOut : 0,
          solOut: isBuy ? 0 : solOut,
          newPrice,
          bondingProgress,
          graduated: shouldGraduate,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ===== LEGACY SIMULATE MODE (fallback) =====
    // Calculate using bonding curve
    const virtualSol = token.virtual_sol_reserves || 30;
    const virtualToken = token.virtual_token_reserves || 1_000_000_000;
    const realSol = token.real_sol_reserves || 0;
    const k = virtualSol * virtualToken;

    let tokensOut = 0;
    let solOut = 0;
    let newPrice = token.price_sol || 0.00000003;
    let newVirtualSol = virtualSol;
    let newVirtualToken = virtualToken;
    let newRealSol = realSol;
    let systemFee = 0;
    let creatorFee = 0;
    let apiUserFee = 0;
    let platformFee = 0;
    let solAmount = 0;
    let tokenAmount = 0;

    if (isBuy) {
      const grossSolIn = amount;
      const totalFee = (grossSolIn * FEE_BPS) / 10000;
      
      if (apiAccountId) {
        apiUserFee = totalFee * API_USER_FEE_SHARE;
        platformFee = totalFee * PLATFORM_FEE_SHARE;
        systemFee = platformFee;
      } else {
        systemFee = totalFee;
        platformFee = totalFee;
      }
      
      creatorFee = 0;
      const solIn = grossSolIn - totalFee;
      newVirtualSol = virtualSol + solIn;
      newVirtualToken = k / newVirtualSol;
      tokensOut = virtualToken - newVirtualToken;
      newRealSol = realSol + solIn;
      newPrice = newVirtualSol / newVirtualToken;
      solAmount = grossSolIn;
      tokenAmount = tokensOut;
    } else {
      const tokensIn = amount;
      newVirtualToken = virtualToken + tokensIn;
      newVirtualSol = k / newVirtualToken;
      const grossSolOut = virtualSol - newVirtualSol;
      const totalFee = (grossSolOut * FEE_BPS) / 10000;
      
      if (apiAccountId) {
        apiUserFee = totalFee * API_USER_FEE_SHARE;
        platformFee = totalFee * PLATFORM_FEE_SHARE;
        systemFee = platformFee;
      } else {
        systemFee = totalFee;
        platformFee = totalFee;
      }
      
      creatorFee = 0;
      solOut = grossSolOut - totalFee;
      newRealSol = Math.max(0, realSol - grossSolOut);
      newPrice = newVirtualSol / newVirtualToken;
      solAmount = solOut;
      tokenAmount = tokensIn;
    }

    const graduationThreshold = token.graduation_threshold_sol || 85;
    const bondingProgress = Math.min(100, (newRealSol / graduationThreshold) * 100);
    const shouldGraduate = newRealSol >= graduationThreshold;
    const newStatus = shouldGraduate ? "graduated" : "bonding";
    const marketCap = newPrice * (token.total_supply || 1_000_000_000);

    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentTxs } = await supabase
      .from('launchpad_transactions')
      .select('sol_amount')
      .eq('token_id', token.id)
      .gte('created_at', twentyFourHoursAgo);
    
    const volume24h = (recentTxs || []).reduce((sum, tx) => sum + Number(tx.sol_amount), 0) + solAmount;

    const { error: updateError } = await supabase
      .from("tokens")
      .update({
        virtual_sol_reserves: newVirtualSol,
        virtual_token_reserves: newVirtualToken,
        real_sol_reserves: newRealSol,
        price_sol: newPrice,
        bonding_curve_progress: bondingProgress,
        market_cap_sol: marketCap,
        volume_24h_sol: volume24h,
        status: newStatus,
        graduated_at: shouldGraduate && !token.graduated_at ? new Date().toISOString() : token.graduated_at,
        updated_at: new Date().toISOString(),
      })
      .eq("id", token.id);

    if (updateError) {
      console.error("[launchpad-swap] Token update error:", updateError);
      throw updateError;
    }

    await supabase.from('token_price_history').insert({
      token_id: token.id,
      price_sol: newPrice,
      market_cap_sol: marketCap,
      volume_sol: solAmount,
      interval_type: '1m',
      timestamp: new Date().toISOString(),
    });

    const signature = clientSignature || `pending_${token.id}_${Date.now()}`;

    const txPayload = {
      token_id: token.id,
      user_wallet: userWallet,
      user_profile_id: profileId || null,
      transaction_type: isBuy ? "buy" : "sell",
      sol_amount: solAmount,
      token_amount: tokenAmount,
      price_per_token: newPrice,
      system_fee_sol: systemFee,
      creator_fee_sol: creatorFee,
      signature,
    };

    const { error: firstTxError } = await supabase.from("launchpad_transactions").insert(txPayload);

    if (firstTxError) {
      const { error: retryError } = await supabase.from("launchpad_transactions").insert({
        ...txPayload,
        user_profile_id: null,
      });
      if (retryError) {
        console.error("[launchpad-swap] Transaction insert retry error:", retryError);
      }
    }

    // Record API fee distribution if applicable
    if (apiAccountId && apiUserFee > 0) {
      await supabase.from("api_fee_distributions").insert({
        api_account_id: apiAccountId,
        launchpad_id: launchpadId,
        token_id: token.id,
        total_fee_sol: apiUserFee + platformFee,
        api_user_share: apiUserFee,
        platform_share: platformFee,
        status: "pending",
      });

      const { data: currentAcc } = await supabase.from("api_accounts")
        .select("total_fees_earned").eq("id", apiAccountId).single();
      if (currentAcc) {
        await supabase.from("api_accounts").update({
          total_fees_earned: (currentAcc.total_fees_earned || 0) + apiUserFee,
          updated_at: new Date().toISOString(),
        }).eq("id", apiAccountId);
      }

      const { data: currentLp } = await supabase.from("api_launchpads")
        .select("total_volume_sol, total_fees_sol").eq("id", launchpadId).single();
      if (currentLp) {
        await supabase.from("api_launchpads").update({
          total_volume_sol: (currentLp.total_volume_sol || 0) + solAmount,
          total_fees_sol: (currentLp.total_fees_sol || 0) + apiUserFee,
          updated_at: new Date().toISOString(),
        }).eq("id", launchpadId);
      }
    }

    // Update holdings
    if (isBuy) {
      const { data: existingHolding } = await supabase.from("token_holdings")
        .select("*").eq("token_id", token.id).eq("wallet_address", userWallet).single();

      if (existingHolding) {
        await supabase.from("token_holdings").update({
          balance: existingHolding.balance + tokensOut,
          updated_at: new Date().toISOString(),
        }).eq("id", existingHolding.id);
      } else {
        const { error: holdingInsertError } = await supabase.from("token_holdings").insert({
          token_id: token.id, wallet_address: userWallet, profile_id: profileId || null, balance: tokensOut,
        });
        if (holdingInsertError) {
          await supabase.from("token_holdings").insert({
            token_id: token.id, wallet_address: userWallet, profile_id: null, balance: tokensOut,
          });
        }
      }
    } else {
      const { data: existingHolding } = await supabase.from("token_holdings")
        .select("*").eq("token_id", token.id).eq("wallet_address", userWallet).single();
      if (existingHolding) {
        await supabase.from("token_holdings").update({
          balance: Math.max(0, existingHolding.balance - amount),
          updated_at: new Date().toISOString(),
        }).eq("id", existingHolding.id);
      }
    }

    // Update fee tracking
    if (systemFee > 0) {
      const { data: systemEarner } = await supabase.from("fee_earners").select("*")
        .eq("token_id", token.id).eq("earner_type", "system").single();
      if (systemEarner) {
        await supabase.from("fee_earners").update({
          unclaimed_sol: (systemEarner.unclaimed_sol || 0) + systemFee,
          total_earned_sol: (systemEarner.total_earned_sol || 0) + systemFee,
        }).eq("id", systemEarner.id);
      }
    }

    // Update holder count
    const { count: holderCount } = await supabase.from("token_holdings")
      .select("*", { count: "exact", head: true })
      .eq("token_id", token.id).gt("balance", 0);
    await supabase.from("tokens").update({ holder_count: holderCount || 0 }).eq("id", token.id);

    // Record referral reward for legacy mode too
    if (profileId && systemFee > 0) {
      try {
        const { data: referrerId } = await supabase.rpc("get_referrer_for_user", { p_user_id: profileId });
        if (referrerId) {
          const REFERRAL_REWARD_PCT = 5;
          const referralReward = systemFee * (REFERRAL_REWARD_PCT / 100);
          if (referralReward > 0) {
            await supabase.from("referral_rewards").insert({
              referrer_id: referrerId,
              referred_id: profileId,
              trade_sol_amount: solAmount,
              reward_sol: referralReward,
              reward_pct: REFERRAL_REWARD_PCT,
              trade_signature: signature,
              paid: false,
            });
          }
        }
      } catch (refErr) {
        console.warn("[launchpad-swap] Referral reward failed (non-fatal):", refErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        signature,
        tokensOut: isBuy ? tokensOut : 0,
        solOut: isBuy ? 0 : solOut,
        newPrice,
        bondingProgress,
        graduated: shouldGraduate,
        jupiterUrl: shouldGraduate ? `https://jup.ag/swap/SOL-${mintAddress}` : undefined,
        feeSplit: apiAccountId ? { apiUserFee, platformFee } : null,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[launchpad-swap] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
