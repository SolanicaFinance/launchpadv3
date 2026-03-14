-- Backfill: sync launchpad_transactions to alpha_trades that are missing
INSERT INTO public.alpha_trades (
  wallet_address, token_mint, token_name, token_ticker,
  trade_type, amount_sol, amount_tokens, price_sol,
  tx_hash, chain, created_at
)
SELECT
  lt.user_wallet,
  t.mint_address,
  t.name,
  t.ticker,
  lt.transaction_type,
  COALESCE(lt.sol_amount, 0),
  COALESCE(lt.token_amount, 0),
  lt.price_per_token,
  lt.signature,
  'solana',
  lt.created_at
FROM public.launchpad_transactions lt
JOIN public.tokens t ON t.id = lt.token_id
WHERE lt.signature IS NOT NULL
  AND lt.signature != ''
ON CONFLICT (tx_hash) DO NOTHING;

-- Also backfill from wallet_trades
INSERT INTO public.alpha_trades (
  wallet_address, token_mint, token_name, token_ticker,
  trade_type, amount_sol, amount_tokens, price_sol,
  tx_hash, chain, created_at
)
SELECT
  wt.wallet_address,
  wt.token_mint,
  wt.token_name,
  wt.token_ticker,
  wt.trade_type,
  COALESCE(wt.sol_amount, 0),
  COALESCE(wt.token_amount, 0),
  wt.price_per_token,
  wt.signature,
  'solana',
  wt.created_at
FROM public.wallet_trades wt
WHERE wt.signature IS NOT NULL
  AND wt.signature != ''
ON CONFLICT (tx_hash) DO NOTHING;