
-- Fix security definer views - set them to SECURITY INVOKER (safe default)
ALTER VIEW public.claw_trading_agents_safe SET (security_invoker = true);
ALTER VIEW public.trading_agents_safe SET (security_invoker = true);
ALTER VIEW public.claw_bribes_safe SET (security_invoker = true);
ALTER VIEW public.token_promotions_safe SET (security_invoker = true);

-- Also check agents table: api_key_hash is publicly readable
-- api_key_hash alone isn't the raw key (it's hashed), but api_key_prefix leaks info
-- The agents table needs public reads for the frontend, but we should NOT expose api_key_hash
-- Create a safe view for agents too
CREATE OR REPLACE VIEW public.agents_safe AS
SELECT id, name, description, avatar_url, wallet_address, twitter_handle,
       status, karma, post_count, comment_count, 
       total_tokens_launched, total_fees_earned_sol, total_fees_claimed_sol,
       writing_style, style_source_username, style_learned_at,
       verified_at, trading_agent_id, created_at, updated_at
FROM public.agents;
ALTER VIEW public.agents_safe SET (security_invoker = true);

-- Same for claw_agents 
CREATE OR REPLACE VIEW public.claw_agents_safe AS
SELECT id, name, description, avatar_url, wallet_address, twitter_handle,
       status, karma, post_count, comment_count,
       total_tokens_launched, total_fees_earned_sol, total_fees_claimed_sol,
       writing_style, style_source_username, style_learned_at,
       verified_at, trading_agent_id, created_at, updated_at
FROM public.claw_agents;
ALTER VIEW public.claw_agents_safe SET (security_invoker = true);
