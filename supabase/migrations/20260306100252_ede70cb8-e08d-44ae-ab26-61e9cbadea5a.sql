
-- user_wallets table for multi-wallet system
CREATE TABLE public.user_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Wallet',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, wallet_address)
);

ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallets"
  ON public.user_wallets FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own wallets"
  ON public.user_wallets FOR INSERT
  TO authenticated
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own wallets"
  ON public.user_wallets FOR UPDATE
  TO authenticated
  USING (profile_id = auth.uid());

CREATE POLICY "Users can delete own wallets"
  ON public.user_wallets FOR DELETE
  TO authenticated
  USING (profile_id = auth.uid());

-- Add paid and payout_signature columns to referral_rewards
ALTER TABLE public.referral_rewards
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS payout_signature TEXT;

CREATE INDEX IF NOT EXISTS idx_referral_rewards_unpaid ON public.referral_rewards(paid) WHERE paid = false;
CREATE INDEX IF NOT EXISTS idx_user_wallets_profile ON public.user_wallets(profile_id);
