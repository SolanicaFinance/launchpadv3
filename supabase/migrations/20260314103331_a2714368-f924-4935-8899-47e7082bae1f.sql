-- Allow anon inserts to alpha_trades (public trade feed, no sensitive data)
-- This enables client-side fallback when edge function calls silently fail
DROP POLICY IF EXISTS "Authenticated can insert alpha trades" ON public.alpha_trades;
CREATE POLICY "Anyone can insert alpha trades"
  ON public.alpha_trades
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);