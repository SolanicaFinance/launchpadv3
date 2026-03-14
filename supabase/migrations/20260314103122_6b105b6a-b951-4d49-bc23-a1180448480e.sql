-- Sync wallet_trades into alpha_trades so recent tracked/quick trades appear in Alpha Tracker
CREATE OR REPLACE FUNCTION public.sync_alpha_trade_from_wallet_trade()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.signature IS NULL OR NEW.signature = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.alpha_trades (
    wallet_address,
    token_mint,
    token_name,
    token_ticker,
    trade_type,
    amount_sol,
    amount_tokens,
    price_sol,
    tx_hash,
    chain,
    created_at
  ) VALUES (
    NEW.wallet_address,
    NEW.token_mint,
    NEW.token_name,
    NEW.token_ticker,
    NEW.trade_type,
    COALESCE(NEW.sol_amount, 0),
    COALESCE(NEW.token_amount, 0),
    NEW.price_per_token,
    NEW.signature,
    'solana',
    NEW.created_at
  )
  ON CONFLICT (tx_hash) DO UPDATE SET
    wallet_address = EXCLUDED.wallet_address,
    token_mint = EXCLUDED.token_mint,
    token_name = COALESCE(EXCLUDED.token_name, alpha_trades.token_name),
    token_ticker = COALESCE(EXCLUDED.token_ticker, alpha_trades.token_ticker),
    trade_type = EXCLUDED.trade_type,
    amount_sol = EXCLUDED.amount_sol,
    amount_tokens = EXCLUDED.amount_tokens,
    price_sol = COALESCE(EXCLUDED.price_sol, alpha_trades.price_sol),
    chain = COALESCE(alpha_trades.chain, EXCLUDED.chain);

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS sync_alpha_trade_from_wallet_trade_trigger ON public.wallet_trades;
CREATE TRIGGER sync_alpha_trade_from_wallet_trade_trigger
AFTER INSERT ON public.wallet_trades
FOR EACH ROW
EXECUTE FUNCTION public.sync_alpha_trade_from_wallet_trade();