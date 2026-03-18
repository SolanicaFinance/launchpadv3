create table public.assisted_swaps_log (
  id uuid primary key default gen_random_uuid(),
  user_identifier text not null,
  resolved_wallet text,
  mint_address text not null,
  amount numeric not null,
  is_buy boolean default true,
  slippage_bps int default 3000,
  tx_signature text,
  status text default 'pending',
  error_message text,
  executed_at timestamptz default now(),
  executed_by text default 'admin'
);
alter table public.assisted_swaps_log enable row level security;