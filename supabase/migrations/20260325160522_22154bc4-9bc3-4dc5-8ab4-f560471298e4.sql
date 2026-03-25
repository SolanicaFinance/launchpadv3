
CREATE OR REPLACE FUNCTION public.execute_btc_swap(
  p_token_id uuid,
  p_wallet_address text,
  p_trade_type text,
  p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_token btc_meme_tokens%ROWTYPE;
  v_btc_amount numeric;
  v_token_amount numeric;
  v_fee_amount numeric;
  v_net_btc numeric;
  v_new_virtual_btc numeric;
  v_new_virtual_tokens numeric;
  v_new_real_btc numeric;
  v_new_real_tokens numeric;
  v_new_price numeric;
  v_new_mcap numeric;
  v_new_progress numeric;
  v_is_graduated boolean := false;
  v_k numeric;
  v_gross_btc numeric;
  v_balance_row btc_meme_balances%ROWTYPE;
  v_avg_buy_price numeric;
  v_pnl_btc numeric;
  v_pnl_percent numeric;
BEGIN
  -- Lock the token row
  SELECT * INTO v_token FROM btc_meme_tokens WHERE id = p_token_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Token not found';
  END IF;
  IF v_token.status = 'graduated' THEN
    RAISE EXCEPTION 'Token has graduated';
  END IF;

  v_k := v_token.virtual_btc_reserves * v_token.virtual_token_reserves;

  IF p_trade_type = 'buy' THEN
    v_btc_amount := p_amount;
    v_fee_amount := v_btc_amount * v_token.platform_fee_bps / 10000;
    v_net_btc := v_btc_amount - v_fee_amount;

    v_token_amount := v_token.virtual_token_reserves - (v_k / (v_token.virtual_btc_reserves + v_net_btc));
    IF v_token_amount <= 0 THEN RAISE EXCEPTION 'Insufficient liquidity'; END IF;
    IF v_token_amount > v_token.real_token_reserves THEN
      v_token_amount := v_token.real_token_reserves;
    END IF;

    v_new_virtual_btc := v_token.virtual_btc_reserves + v_net_btc;
    v_new_virtual_tokens := v_token.virtual_token_reserves - v_token_amount;
    v_new_real_btc := v_token.real_btc_reserves + v_net_btc;
    v_new_real_tokens := v_token.real_token_reserves - v_token_amount;

    -- Update or insert balance
    INSERT INTO btc_meme_balances (token_id, wallet_address, balance, total_bought, avg_buy_price_btc)
    VALUES (p_token_id, p_wallet_address, v_token_amount, v_token_amount,
            CASE WHEN v_token_amount > 0 THEN v_net_btc / v_token_amount ELSE 0 END)
    ON CONFLICT (token_id, wallet_address)
    DO UPDATE SET
      balance = btc_meme_balances.balance + v_token_amount,
      total_bought = COALESCE(btc_meme_balances.total_bought, 0) + v_token_amount,
      avg_buy_price_btc = CASE
        WHEN (COALESCE(btc_meme_balances.total_bought, 0) + v_token_amount) > 0
        THEN (COALESCE(btc_meme_balances.avg_buy_price_btc, 0) * COALESCE(btc_meme_balances.total_bought, 0) + v_net_btc)
             / (COALESCE(btc_meme_balances.total_bought, 0) + v_token_amount)
        ELSE 0
      END,
      updated_at = now();

  ELSIF p_trade_type = 'sell' THEN
    v_token_amount := p_amount;

    SELECT * INTO v_balance_row FROM btc_meme_balances
    WHERE token_id = p_token_id AND wallet_address = p_wallet_address;

    IF NOT FOUND OR v_balance_row.balance < v_token_amount THEN
      RAISE EXCEPTION 'Insufficient token balance';
    END IF;

    v_gross_btc := v_token.virtual_btc_reserves - (v_k / (v_token.virtual_token_reserves + v_token_amount));
    IF v_gross_btc <= 0 THEN RAISE EXCEPTION 'Insufficient liquidity'; END IF;

    v_fee_amount := v_gross_btc * v_token.platform_fee_bps / 10000;
    v_btc_amount := v_gross_btc - v_fee_amount;

    v_new_virtual_btc := v_token.virtual_btc_reserves - v_gross_btc;
    v_new_virtual_tokens := v_token.virtual_token_reserves + v_token_amount;
    v_new_real_btc := GREATEST(v_token.real_btc_reserves - v_gross_btc, 0);
    v_new_real_tokens := v_token.real_token_reserves + v_token_amount;

    UPDATE btc_meme_balances SET
      balance = balance - v_token_amount,
      total_sold = COALESCE(total_sold, 0) + v_token_amount,
      updated_at = now()
    WHERE token_id = p_token_id AND wallet_address = p_wallet_address;
  ELSE
    RAISE EXCEPTION 'Invalid trade type';
  END IF;

  v_new_price := CASE WHEN v_new_virtual_tokens > 0 THEN v_new_virtual_btc / v_new_virtual_tokens ELSE 0 END;
  v_new_mcap := v_new_price * v_token.total_supply;
  v_new_progress := CASE WHEN v_token.graduation_threshold_btc > 0
    THEN LEAST((v_new_real_btc / v_token.graduation_threshold_btc) * 100, 100) ELSE 0 END;

  IF v_new_progress >= 100 AND v_token.status != 'graduated' THEN
    v_is_graduated := true;
  END IF;

  -- Update token state
  UPDATE btc_meme_tokens SET
    virtual_btc_reserves = v_new_virtual_btc,
    virtual_token_reserves = v_new_virtual_tokens,
    real_btc_reserves = v_new_real_btc,
    real_token_reserves = v_new_real_tokens,
    price_btc = v_new_price, market_cap_btc = v_new_mcap,
    bonding_progress = v_new_progress,
    trade_count = trade_count + 1,
    volume_btc = volume_btc + v_btc_amount,
    status = CASE WHEN v_is_graduated THEN 'graduated' ELSE status END,
    graduated_at = CASE WHEN v_is_graduated THEN now() ELSE graduated_at END,
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

  -- Get PnL data
  SELECT avg_buy_price_btc INTO v_avg_buy_price FROM btc_meme_balances
  WHERE token_id = p_token_id AND wallet_address = p_wallet_address;

  IF v_avg_buy_price IS NOT NULL AND v_avg_buy_price > 0 THEN
    v_pnl_btc := (v_new_price - v_avg_buy_price) * COALESCE((SELECT balance FROM btc_meme_balances WHERE token_id = p_token_id AND wallet_address = p_wallet_address), 0);
    v_pnl_percent := ((v_new_price - v_avg_buy_price) / v_avg_buy_price) * 100;
  END IF;

  -- Update holder count
  UPDATE btc_meme_tokens SET holder_count = (
    SELECT COUNT(*) FROM btc_meme_balances WHERE token_id = p_token_id AND balance >= 1
  ) WHERE id = p_token_id;

  RETURN jsonb_build_object(
    'success', true, 'tradeType', p_trade_type,
    'btcAmount', v_btc_amount, 'tokenAmount', v_token_amount,
    'feeBtc', v_fee_amount, 'priceBtc', v_new_price,
    'marketCapBtc', v_new_mcap, 'bondingProgress', v_new_progress,
    'isGraduated', v_is_graduated, 'ticker', v_token.ticker,
    'genesisTxid', v_token.genesis_txid, 'imageHash', v_token.image_hash,
    'tokenName', v_token.name, 'avgBuyPrice', v_avg_buy_price,
    'pnlBtc', v_pnl_btc, 'pnlPercent', v_pnl_percent,
    'realBtcReserves', v_new_real_btc
  );
END;
$function$;
