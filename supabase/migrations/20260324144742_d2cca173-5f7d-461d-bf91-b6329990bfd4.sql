
-- Atomic swap function: runs inside a single transaction with row-level locking.
-- Guarantees that concurrent trades are serialized per token.
-- Returns the trade result or raises an exception on failure.

CREATE OR REPLACE FUNCTION public.execute_btc_swap(
  p_token_id uuid,
  p_wallet_address text,
  p_trade_type text,   -- 'buy' or 'sell'
  p_amount numeric     -- BTC amount for buy, token amount for sell
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token btc_meme_tokens%ROWTYPE;
  v_total_supply numeric := 1000000000;
  v_total_fee_bps numeric;
  v_fee_amount numeric;
  v_btc_amount numeric;
  v_token_amount numeric;
  v_net_btc numeric;
  v_gross_btc numeric;
  v_new_virtual_btc numeric;
  v_new_virtual_tokens numeric;
  v_new_real_btc numeric;
  v_new_real_tokens numeric;
  v_new_price numeric;
  v_new_mcap numeric;
  v_new_progress numeric;
  v_is_graduated boolean;
  v_bal_btc numeric;
  v_total_deposited numeric;
  v_token_bal numeric;
  v_token_total_bought numeric;
  v_token_total_sold numeric;
  v_token_avg_price numeric;
  v_token_bal_id uuid;
  v_btc_bal_id uuid;
  v_holder_count integer;
  v_exec_price numeric;
  v_new_avg numeric;
  v_user_btc_bal numeric;
BEGIN
  -- 1. Lock the token row exclusively (blocks other swaps on same token)
  SELECT * INTO v_token
    FROM btc_meme_tokens
    WHERE id = p_token_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;

  IF v_token.status = 'pending_genesis' THEN
    RAISE EXCEPTION 'Token genesis not yet confirmed';
  END IF;

  IF v_token.status IN ('graduated', 'migrating', 'migration_blocked') THEN
    RAISE EXCEPTION 'Token has graduated, trading closed';
  END IF;

  IF v_token.status != 'active' THEN
    RAISE EXCEPTION 'Token is not active for trading';
  END IF;

  v_total_fee_bps := v_token.platform_fee_bps + COALESCE(v_token.creator_fee_bps, 0);

  IF p_trade_type = 'buy' THEN
    v_btc_amount := p_amount;

    -- Lock user's BTC balance row
    SELECT balance_btc, total_deposited INTO v_bal_btc, v_total_deposited
      FROM btc_trading_balances
      WHERE wallet_address = p_wallet_address
      FOR UPDATE;

    IF NOT FOUND OR v_total_deposited <= 0 THEN
      RAISE EXCEPTION 'No verified BTC deposit found';
    END IF;

    IF v_bal_btc < v_btc_amount THEN
      RAISE EXCEPTION 'Insufficient BTC balance (available: %)', v_bal_btc;
    END IF;

    v_fee_amount := v_btc_amount * (v_total_fee_bps / 10000.0);
    v_net_btc := v_btc_amount - v_fee_amount;
    v_token_amount := (v_token.virtual_token_reserves * v_net_btc) / (v_token.virtual_btc_reserves + v_net_btc);

    IF v_token_amount > v_token.real_token_reserves THEN
      RAISE EXCEPTION 'Not enough tokens in pool';
    END IF;

    v_new_virtual_btc := v_token.virtual_btc_reserves + v_net_btc;
    v_new_virtual_tokens := v_token.virtual_token_reserves - v_token_amount;
    v_new_real_btc := v_token.real_btc_reserves + v_net_btc;
    v_new_real_tokens := v_token.real_token_reserves - v_token_amount;

    -- Deduct BTC from user (atomic, already locked)
    UPDATE btc_trading_balances
      SET balance_btc = balance_btc - v_btc_amount, updated_at = now()
      WHERE wallet_address = p_wallet_address;

    -- Credit tokens to user
    SELECT id, balance, total_bought, total_sold, avg_buy_price_btc
      INTO v_token_bal_id, v_token_bal, v_token_total_bought, v_token_total_sold, v_token_avg_price
      FROM btc_meme_balances
      WHERE token_id = p_token_id AND wallet_address = p_wallet_address
      FOR UPDATE;

    v_exec_price := v_new_virtual_btc / v_new_virtual_tokens;

    IF FOUND THEN
      v_new_avg := CASE
        WHEN (v_token_total_bought + v_token_amount) > 0 THEN
          ((COALESCE(v_token_avg_price, 0) * COALESCE(v_token_total_bought, 0)) + (v_exec_price * v_token_amount))
          / (COALESCE(v_token_total_bought, 0) + v_token_amount)
        ELSE v_exec_price
      END;

      UPDATE btc_meme_balances SET
        balance = balance + v_token_amount,
        total_bought = COALESCE(total_bought, 0) + v_token_amount,
        avg_buy_price_btc = v_new_avg,
        updated_at = now()
      WHERE id = v_token_bal_id;
    ELSE
      INSERT INTO btc_meme_balances (token_id, wallet_address, balance, total_bought, avg_buy_price_btc)
        VALUES (p_token_id, p_wallet_address, v_token_amount, v_token_amount, v_exec_price);
    END IF;

  ELSIF p_trade_type = 'sell' THEN
    v_token_amount := p_amount;

    -- Lock user's token balance
    SELECT id, balance, total_sold INTO v_token_bal_id, v_token_bal, v_token_total_sold
      FROM btc_meme_balances
      WHERE token_id = p_token_id AND wallet_address = p_wallet_address
      FOR UPDATE;

    IF NOT FOUND OR v_token_bal < v_token_amount THEN
      RAISE EXCEPTION 'Insufficient token balance (available: %)', COALESCE(v_token_bal, 0);
    END IF;

    v_gross_btc := (v_token.virtual_btc_reserves * v_token_amount) / (v_token.virtual_token_reserves + v_token_amount);
    v_fee_amount := v_gross_btc * (v_total_fee_bps / 10000.0);
    v_btc_amount := v_gross_btc - v_fee_amount;

    v_new_virtual_btc := v_token.virtual_btc_reserves - v_gross_btc;
    v_new_virtual_tokens := v_token.virtual_token_reserves + v_token_amount;
    v_new_real_btc := GREATEST(v_token.real_btc_reserves - v_gross_btc, 0);
    v_new_real_tokens := v_token.real_token_reserves + v_token_amount;

    -- Deduct tokens
    UPDATE btc_meme_balances SET
      balance = balance - v_token_amount,
      total_sold = COALESCE(total_sold, 0) + v_token_amount,
      updated_at = now()
    WHERE id = v_token_bal_id;

    -- Credit BTC to user
    SELECT balance_btc INTO v_user_btc_bal
      FROM btc_trading_balances
      WHERE wallet_address = p_wallet_address
      FOR UPDATE;

    IF FOUND THEN
      UPDATE btc_trading_balances SET
        balance_btc = balance_btc + v_btc_amount, updated_at = now()
      WHERE wallet_address = p_wallet_address;
    ELSE
      INSERT INTO btc_trading_balances (wallet_address, balance_btc)
        VALUES (p_wallet_address, v_btc_amount);
    END IF;

  ELSE
    RAISE EXCEPTION 'Invalid trade type: %', p_trade_type;
  END IF;

  -- Compute new price & progress
  v_new_price := CASE WHEN v_new_virtual_tokens > 0 THEN v_new_virtual_btc / v_new_virtual_tokens ELSE 0 END;
  v_new_mcap := v_new_price * v_total_supply;
  v_new_progress := LEAST((v_new_real_btc / v_token.graduation_threshold_btc) * 100, 100);
  v_is_graduated := v_new_progress >= 100;

  -- Count holders
  SELECT count(*) INTO v_holder_count
    FROM btc_meme_balances
    WHERE token_id = p_token_id AND balance > 0;

  -- Update pool state (still holding row lock)
  UPDATE btc_meme_tokens SET
    virtual_btc_reserves = v_new_virtual_btc,
    virtual_token_reserves = v_new_virtual_tokens,
    real_btc_reserves = v_new_real_btc,
    real_token_reserves = v_new_real_tokens,
    price_btc = v_new_price,
    market_cap_btc = v_new_mcap,
    bonding_progress = v_new_progress,
    holder_count = v_holder_count,
    trade_count = trade_count + 1,
    volume_btc = volume_btc + v_btc_amount,
    status = CASE WHEN v_is_graduated THEN 'graduated' ELSE 'active' END,
    graduated_at = CASE WHEN v_is_graduated THEN now() ELSE NULL END,
    updated_at = now()
  WHERE id = p_token_id;

  -- Insert trade record
  INSERT INTO btc_meme_trades (
    token_id, wallet_address, trade_type,
    btc_amount, token_amount, price_btc, fee_btc,
    pool_virtual_btc, pool_virtual_tokens,
    pool_real_btc, bonding_progress, market_cap_btc
  ) VALUES (
    p_token_id, p_wallet_address, p_trade_type,
    v_btc_amount, v_token_amount, v_new_price, v_fee_amount,
    v_new_virtual_btc, v_new_virtual_tokens,
    v_new_real_btc, v_new_progress, v_new_mcap
  );

  RETURN jsonb_build_object(
    'success', true,
    'tradeType', p_trade_type,
    'btcAmount', v_btc_amount,
    'tokenAmount', v_token_amount,
    'feeBtc', v_fee_amount,
    'priceBtc', v_new_price,
    'marketCapBtc', v_new_mcap,
    'bondingProgress', v_new_progress,
    'isGraduated', v_is_graduated,
    'ticker', v_token.ticker,
    'genesisTxid', v_token.genesis_txid,
    'imageHash', v_token.image_hash,
    'tokenName', v_token.name
  );
END;
$$;
