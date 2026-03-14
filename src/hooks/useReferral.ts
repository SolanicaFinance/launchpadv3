import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const REF_STORAGE_KEY = "ref";
const REF_CODE_CACHE_KEY = "pulse-referral-code";

export function useReferralCode() {
  const { profileId } = useAuth();

  // Initialize from cache for instant display
  const [referralCode, setReferralCode] = useState<string | null>(() => {
    try {
      const cached = localStorage.getItem(REF_CODE_CACHE_KEY);
      return cached || null;
    } catch { return null; }
  });
  const [referralCount, setReferralCount] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);
    let cancelled = false;

    (async () => {
      try {
        // Skip profile existence check — go straight to get_or_create
        const { data, error } = await supabase.rpc("get_or_create_referral_code", {
          p_profile_id: profileId,
        });
        if (!error && data && !cancelled) {
          setReferralCode(data as string);
          try { localStorage.setItem(REF_CODE_CACHE_KEY, data as string); } catch {}
        }

        const { count } = await supabase
          .from("referrals")
          .select("*", { count: "exact", head: true })
          .eq("referrer_id", profileId);

        if (!cancelled) setReferralCount(count ?? 0);
      } catch {
        // silent
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profileId]);

  const referralLink = referralCode
    ? `https://saturn.trade/link/${referralCode}`
    : null;

  return { referralCode, referralLink, referralCount, loading };
}

/**
 * Full referral dashboard stats
 */
export function useReferralDashboard() {
  const { profileId } = useAuth();
  const [stats, setStats] = useState<{
    totalReferrals: number;
    totalRewardsSol: number;
    rewardsThisMonth: number;
  }>({ totalReferrals: 0, totalRewardsSol: 0, rewardsThisMonth: 0 });
  const [recentReferrals, setRecentReferrals] = useState<any[]>([]);
  const [recentRewards, setRecentRewards] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!profileId) return;
    setLoading(true);

    (async () => {
      try {
        // Fire all queries in parallel
        const [statsRes, refsRes, rewardsRes] = await Promise.all([
          supabase.rpc("get_referral_stats", { p_referrer_id: profileId }),
          supabase
            .from("referrals")
            .select("id, referred_id, referred_wallet, created_at")
            .eq("referrer_id", profileId)
            .order("created_at", { ascending: false })
            .limit(10),
          supabase
            .from("referral_rewards")
            .select("id, trade_sol_amount, reward_sol, reward_pct, created_at")
            .eq("referrer_id", profileId)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

        if (statsRes.data && Array.isArray(statsRes.data) && statsRes.data.length > 0) {
          const s = statsRes.data[0];
          setStats({
            totalReferrals: Number(s.total_referrals) || 0,
            totalRewardsSol: Number(s.total_rewards_sol) || 0,
            rewardsThisMonth: Number(s.rewards_this_month) || 0,
          });
        }

        setRecentReferrals(refsRes.data ?? []);
        setRecentRewards(rewardsRes.data ?? []);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    })();
  }, [profileId]);

  return { stats, recentReferrals, recentRewards, loading };
}

/**
 * Captures referral code from URL on first visit, persists in localStorage,
 * and records the referral when user authenticates.
 */
export function useTrackReferral() {
  const { profileId, solanaAddress } = useAuth();

  // On mount, check if we're on a /link/:code path and store it
  useEffect(() => {
    const path = window.location.pathname;
    const match = path.match(/^\/link\/([a-zA-Z0-9]+)$/);
    if (match) {
      localStorage.setItem(REF_STORAGE_KEY, match[1]);
    }
  }, []);

  // When user authenticates, record referral
  useEffect(() => {
    if (!profileId) return;
    const storedCode = localStorage.getItem(REF_STORAGE_KEY);
    if (!storedCode) return;

    (async () => {
      try {
        // Look up referrer from code
        const { data: codeRow } = await supabase
          .from("referral_codes")
          .select("profile_id")
          .eq("code", storedCode)
          .maybeSingle();

        if (!codeRow || codeRow.profile_id === profileId) {
          localStorage.removeItem(REF_STORAGE_KEY);
          return;
        }

        // Insert referral (unique constraint prevents duplicates)
        const { error } = await supabase.from("referrals").insert({
          referrer_id: codeRow.profile_id,
          referred_id: profileId,
          referred_wallet: solanaAddress || null,
        });

        if (!error || error.code === "23505") {
          // Success or already referred - clear storage either way
          localStorage.removeItem(REF_STORAGE_KEY);
        }
      } catch {
        // Keep in localStorage to retry next time
      }
    })();
  }, [profileId, solanaAddress]);
}
