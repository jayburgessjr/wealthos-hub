-- USERS PORTFOLIO
create table portfolios (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  total_capital numeric(12,2) default 0,
  available_capital numeric(12,2) default 0,
  deployed_capital numeric(12,2) default 0,
  total_pnl numeric(12,2) default 0,
  total_pnl_pct numeric(6,2) default 0,
  win_rate numeric(5,2) default 0,
  total_trades int default 0,
  updated_at timestamptz default now()
);

-- POSITIONS
create table positions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  ticker text not null,
  company_name text,
  strategy_type text check (strategy_type in (
    'covered_call','cash_secured_put','call_debit',
    'put_debit','call_spread','put_spread','long_stock',
    'short_stock','hard_money','tax_lien','p2p_lending','other'
  )),
  asset_class text check (asset_class in (
    'options','equities','real_estate','lending','crypto','other'
  )),
  entry_date date not null,
  expiry_date date,
  entry_price numeric(10,4) not null,
  current_price numeric(10,4),
  strike_price numeric(10,4),
  shares_contracts numeric(10,4) not null,
  value numeric(12,2),
  pnl_dollars numeric(12,2) default 0,
  pnl_percent numeric(8,2) default 0,
  signal_score int check (signal_score between 0 and 100),
  status text check (status in ('open','closed','pending')) default 'open',
  notes text,
  created_at timestamptz default now()
);

-- SIGNALS (AI generated)
create table signals (
  id uuid default gen_random_uuid() primary key,
  ticker text not null,
  company_name text,
  strategy_type text not null,
  asset_class text,
  signal_score int check (signal_score between 0 and 100),
  action text check (action in (
    'strong_buy','buy','hold','watch','exit','strong_exit'
  )),
  entry_price numeric(10,4),
  target_price numeric(10,4),
  stop_price numeric(10,4),
  position_size_pct numeric(5,2),
  position_size_dollars numeric(10,2),
  expected_return_pct numeric(6,2),
  time_horizon_days int,
  reasoning jsonb,
  sentiment_score numeric(5,2),
  options_flow_score numeric(5,2),
  technical_score numeric(5,2),
  macro_score numeric(5,2),
  expires_at timestamptz,
  created_at timestamptz default now()
);

-- WATCHLIST
create table watchlist (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  ticker text not null,
  company_name text,
  alert_price_above numeric(10,4),
  alert_price_below numeric(10,4),
  alert_signal_above int,
  added_at timestamptz default now(),
  unique(user_id, ticker)
);

-- TRANSACTIONS LOG
create table transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  position_id uuid references positions(id),
  ticker text not null,
  action text check (action in ('buy','sell','open','close')),
  strategy_type text,
  price numeric(10,4) not null,
  quantity numeric(10,4) not null,
  total_value numeric(12,2) not null,
  fees numeric(8,2) default 0,
  pnl_realized numeric(12,2),
  signal_score_at_entry int,
  notes text,
  executed_at timestamptz default now()
);

-- COMPOUND SETTINGS
create table compound_settings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null unique,
  starting_capital numeric(12,2) default 0,
  monthly_contribution numeric(10,2) default 0,
  target_return_pct numeric(5,2) default 15,
  time_horizon_months int default 24,
  reinvestment_pct numeric(5,2) default 100,
  max_drawdown_pct numeric(5,2) default 20,
  risk_tier text check (risk_tier in ('conservative','moderate','aggressive')) default 'moderate',
  updated_at timestamptz default now()
);

-- STRATEGY PERFORMANCE
create table strategy_performance (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  strategy_type text not null,
  total_trades int default 0,
  winning_trades int default 0,
  total_pnl numeric(12,2) default 0,
  avg_return_pct numeric(6,2) default 0,
  best_trade_pct numeric(6,2),
  worst_trade_pct numeric(6,2),
  avg_hold_days numeric(6,1),
  capital_allocated numeric(12,2) default 0,
  updated_at timestamptz default now(),
  unique(user_id, strategy_type)
);

-- RLS POLICIES
alter table portfolios enable row level security;
alter table positions enable row level security;
alter table watchlist enable row level security;
alter table transactions enable row level security;
alter table compound_settings enable row level security;
alter table strategy_performance enable row level security;
alter table signals enable row level security;

create policy "own data only" on portfolios for all using (auth.uid() = user_id);
create policy "own data only" on positions for all using (auth.uid() = user_id);
create policy "own data only" on watchlist for all using (auth.uid() = user_id);
create policy "own data only" on transactions for all using (auth.uid() = user_id);
create policy "own data only" on compound_settings for all using (auth.uid() = user_id);
create policy "own data only" on strategy_performance for all using (auth.uid() = user_id);

create policy "signals readable by all auth users" on signals for select using (auth.role() = 'authenticated');