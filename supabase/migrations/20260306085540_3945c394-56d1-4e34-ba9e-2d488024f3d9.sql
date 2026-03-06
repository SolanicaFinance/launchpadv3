CREATE TABLE public.merch_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  buyer_wallet text,
  buyer_email text NOT NULL,
  shipping_name text NOT NULL,
  shipping_address jsonb NOT NULL,
  items jsonb NOT NULL,
  total_sol numeric NOT NULL,
  tx_signature text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.merch_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert orders" ON public.merch_orders FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view all orders" ON public.merch_orders FOR SELECT TO authenticated USING (public.is_admin());