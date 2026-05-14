-- Holdings table — stores all user asset positions across every asset class
create table public.holdings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Asset classification
  asset_type text not null check (asset_type in (
    'stock', 'etf', 'option', 'crypto', 'commodity',
    'kalshi', 'fixed_income', 'real_estate', 'cash', 'other'
  )),

  -- Core identity
  symbol      text,           -- ticker / coin / contract id
  name        text not null,  -- human-readable name
  account     text,           -- broker/exchange (Schwab, Fidelity, Coinbase…)

  -- Sizing
  quantity    numeric not null default 0,
  unit        text default 'shares', -- shares / coins / oz / contracts / sqft / $

  -- Cost
  avg_cost    numeric,        -- per unit cost basis
  total_cost  numeric,        -- quantity * avg_cost (stored for options/RE)

  -- Current value (user-entered or auto-fetched)
  current_price  numeric,
  current_value  numeric,     -- quantity * current_price

  -- Options-specific
  option_type    text check (option_type in ('call','put', null)),
  strike_price   numeric,
  expiry_date    date,
  contracts      integer,     -- number of contracts (1 contract = 100 shares)

  -- Kalshi-specific
  kalshi_market  text,
  kalshi_outcome text,        -- YES or NO

  -- Fixed income-specific
  coupon_rate    numeric,
  maturity_date  date,
  face_value     numeric,

  -- Real estate-specific
  property_address text,
  mortgage_balance  numeric,
  monthly_income    numeric,  -- rental income

  -- Metadata
  notes         text,
  tags          text[],
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- RLS
alter table public.holdings enable row level security;

create policy "Users manage own holdings"
  on public.holdings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast user queries
create index holdings_user_id_idx on public.holdings(user_id);
create index holdings_asset_type_idx on public.holdings(user_id, asset_type);
create index holdings_symbol_idx on public.holdings(user_id, symbol);

-- Auto-update updated_at
create or replace function public.update_holdings_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger holdings_updated_at
  before update on public.holdings
  for each row execute procedure public.update_holdings_updated_at();
