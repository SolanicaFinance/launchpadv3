
-- Security: Deny direct INSERT/UPDATE/DELETE on btc_meme_trades (only execute_btc_swap SECURITY DEFINER can write)
CREATE POLICY "Deny direct insert on btc_meme_trades" ON btc_meme_trades FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update on btc_meme_trades" ON btc_meme_trades FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete on btc_meme_trades" ON btc_meme_trades FOR DELETE TO anon, authenticated USING (false);

-- Security: Deny direct INSERT/UPDATE/DELETE on btc_meme_balances
CREATE POLICY "Deny direct insert on btc_meme_balances" ON btc_meme_balances FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update on btc_meme_balances" ON btc_meme_balances FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete on btc_meme_balances" ON btc_meme_balances FOR DELETE TO anon, authenticated USING (false);

-- Security: Deny direct INSERT/UPDATE/DELETE on btc_meme_tokens
CREATE POLICY "Deny direct insert on btc_meme_tokens" ON btc_meme_tokens FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update on btc_meme_tokens" ON btc_meme_tokens FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete on btc_meme_tokens" ON btc_meme_tokens FOR DELETE TO anon, authenticated USING (false);

-- Security: Deny direct INSERT/UPDATE/DELETE on btc_trading_balances
CREATE POLICY "Deny direct insert on btc_trading_balances" ON btc_trading_balances FOR INSERT TO anon, authenticated WITH CHECK (false);
CREATE POLICY "Deny direct update on btc_trading_balances" ON btc_trading_balances FOR UPDATE TO anon, authenticated USING (false);
CREATE POLICY "Deny direct delete on btc_trading_balances" ON btc_trading_balances FOR DELETE TO anon, authenticated USING (false);
