
-- Add Solana proof signature to trades
ALTER TABLE public.btc_meme_trades ADD COLUMN IF NOT EXISTS solana_proof_signature TEXT;
ALTER TABLE public.btc_meme_trades ADD COLUMN IF NOT EXISTS solana_proof_memo TEXT;

-- Add image hash to tokens for OP_RETURN verification
ALTER TABLE public.btc_meme_tokens ADD COLUMN IF NOT EXISTS image_hash TEXT;

-- Create Merkle anchoring table
CREATE TABLE IF NOT EXISTS public.btc_merkle_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anchor_txid TEXT NOT NULL,
  merkle_root TEXT NOT NULL,
  total_accounts INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  balances_snapshot JSONB,
  block_height INTEGER,
  fee_sats INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS but allow public reads (anchors are public proof)
ALTER TABLE public.btc_merkle_anchors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view merkle anchors" ON public.btc_merkle_anchors FOR SELECT USING (true);
