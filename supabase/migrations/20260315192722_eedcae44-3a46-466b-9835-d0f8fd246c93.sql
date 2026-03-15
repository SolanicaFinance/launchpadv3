
-- CRITICAL SECURITY FIX: Lock down ALL tables with private keys from public reads

-- 1. claw_deployer_wallets: encrypted_private_key exposed
DROP POLICY IF EXISTS "claw_deployer_wallets_public_read" ON public.claw_deployer_wallets;
CREATE POLICY "claw_deployer_wallets_service_only" ON public.claw_deployer_wallets FOR SELECT TO service_role USING (true);

-- 2. claw_trading_agents: wallet_private_key_encrypted, bid_wallet_private_key_encrypted exposed
DROP POLICY IF EXISTS "claw_trading_agents_public_read" ON public.claw_trading_agents;
CREATE POLICY "claw_trading_agents_service_only" ON public.claw_trading_agents FOR SELECT TO service_role USING (true);

-- 3. opentuna_agents: wallet_private_key_encrypted exposed
DROP POLICY IF EXISTS "Anyone can view opentuna agents" ON public.opentuna_agents;
CREATE POLICY "opentuna_agents_service_only" ON public.opentuna_agents FOR SELECT TO service_role USING (true);

-- 4. trading_agents: wallet_private_key_encrypted, wallet_private_key_backup exposed
DROP POLICY IF EXISTS "Trading agents are publicly readable" ON public.trading_agents;
DROP POLICY IF EXISTS "Service role can manage trading agents" ON public.trading_agents;
CREATE POLICY "trading_agents_service_role_all" ON public.trading_agents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- 5. claw_bribes: bribe_wallet_private_key_encrypted exposed
DROP POLICY IF EXISTS "Anyone can view bribes" ON public.claw_bribes;
CREATE POLICY "claw_bribes_service_only" ON public.claw_bribes FOR SELECT TO service_role USING (true);

-- 6. token_promotions: payment_private_key exposed
DROP POLICY IF EXISTS "Anyone can view promotions" ON public.token_promotions;
CREATE POLICY "token_promotions_service_only" ON public.token_promotions FOR SELECT TO service_role USING (true);

-- Create safe PUBLIC views that exclude secret columns for frontend use

CREATE OR REPLACE VIEW public.claw_trading_agents_safe AS
SELECT id, name, ticker, description, avatar_url, wallet_address,
       trading_capital_sol, total_invested_sol, total_profit_sol, unrealized_pnl_sol,
       win_rate, total_trades, winning_trades, losing_trades, strategy_type,
       status, agent_id, fun_token_id, creator_wallet, mint_address,
       bid_wallet_address, owner_wallet, is_owned,
       created_at, updated_at
FROM public.claw_trading_agents;

CREATE OR REPLACE VIEW public.trading_agents_safe AS
SELECT id, agent_id, fun_token_id, name, ticker, description, avatar_url, wallet_address,
       trading_capital_sol, total_invested_sol, total_profit_sol, unrealized_pnl_sol,
       win_rate, total_trades, winning_trades, losing_trades, strategy_type,
       status, creator_wallet, creator_profile_id, mint_address, twitter_url,
       created_at, updated_at
FROM public.trading_agents;

CREATE OR REPLACE VIEW public.claw_bribes_safe AS
SELECT id, parent_agent_id, child_agent_id, child_trading_agent_id,
       briber_wallet, bribe_amount_sol, bribe_wallet_address,
       status, tx_signature, created_at, completed_at
FROM public.claw_bribes;

CREATE OR REPLACE VIEW public.token_promotions_safe AS
SELECT id, fun_token_id, promoter_wallet, payment_address,
       status, signature, twitter_post_id, paid_at, posted_at, expires_at, created_at
FROM public.token_promotions;
