
-- CRITICAL SECURITY FIX: Remove all public access to x_bot_accounts and related tables
-- These tables contain sensitive credentials (cookies, auth tokens, passwords)

-- x_bot_accounts: DROP all public policies, keep only service_role
DROP POLICY IF EXISTS "Allow public select on x_bot_accounts" ON public.x_bot_accounts;
DROP POLICY IF EXISTS "Allow public insert on x_bot_accounts" ON public.x_bot_accounts;
DROP POLICY IF EXISTS "Allow public update on x_bot_accounts" ON public.x_bot_accounts;
DROP POLICY IF EXISTS "Allow public delete on x_bot_accounts" ON public.x_bot_accounts;

-- x_bot_account_rules: DROP all public policies
DROP POLICY IF EXISTS "Allow public select on x_bot_account_rules" ON public.x_bot_account_rules;
DROP POLICY IF EXISTS "Allow public insert on x_bot_account_rules" ON public.x_bot_account_rules;
DROP POLICY IF EXISTS "Allow public update on x_bot_account_rules" ON public.x_bot_account_rules;
DROP POLICY IF EXISTS "Allow public delete on x_bot_account_rules" ON public.x_bot_account_rules;

-- x_bot_account_replies: DROP public policies
DROP POLICY IF EXISTS "Allow public select on x_bot_account_replies" ON public.x_bot_account_replies;
DROP POLICY IF EXISTS "Allow public insert on x_bot_account_replies" ON public.x_bot_account_replies;

-- x_bot_account_queue: DROP public policies
DROP POLICY IF EXISTS "Allow public select on x_bot_account_queue" ON public.x_bot_account_queue;
DROP POLICY IF EXISTS "Allow public insert on x_bot_account_queue" ON public.x_bot_account_queue;
DROP POLICY IF EXISTS "Allow public update on x_bot_account_queue" ON public.x_bot_account_queue;

-- x_bot_account_logs: DROP public policy
DROP POLICY IF EXISTS "Service role has full access to logs" ON public.x_bot_account_logs;

-- x_bot_conversation_history & x_bot_user_topics: DROP public policies  
DROP POLICY IF EXISTS "Service role full access" ON public.x_bot_conversation_history;
DROP POLICY IF EXISTS "Service role full access" ON public.x_bot_user_topics;

-- Now create STRICT service_role-only policies for ALL x_bot tables
CREATE POLICY "service_role_only" ON public.x_bot_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_only" ON public.x_bot_account_rules FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_only" ON public.x_bot_account_replies FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_only" ON public.x_bot_account_queue FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_only" ON public.x_bot_account_logs FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_only" ON public.x_bot_conversation_history FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "service_role_only" ON public.x_bot_user_topics FOR ALL TO service_role USING (true) WITH CHECK (true);
