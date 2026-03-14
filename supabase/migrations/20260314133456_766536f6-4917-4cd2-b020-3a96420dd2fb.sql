CREATE POLICY "Anyone can update alpha trades"
  ON public.alpha_trades
  FOR UPDATE
  TO anon, authenticated
  USING (true)
  WITH CHECK (true);