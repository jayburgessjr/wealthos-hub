create table if not exists public.paper_trades (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  company_name text,
  direction text not null check (direction in ('long','short')),
  strategy_type text default 'long_stock',
  entry_price numeric not null,
  current_price numeric,
  quantity numeric not null,
  total_value numeric,
  pnl_dollars numeric default 0,
  pnl_percent numeric default 0,
  status text default 'open' check (status in ('open','closed')),
  entry_date date not null default current_date,
  close_date date,
  close_price numeric,
  notes text,
  created_at timestamptz default now()
);

alter table public.paper_trades enable row level security;

create policy "Users manage own paper trades" on public.paper_trades
  for all using (auth.uid() = user_id);
