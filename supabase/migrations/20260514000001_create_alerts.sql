-- Create alerts table
create table public.alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  symbol text not null,
  condition_type text not null check (condition_type in ('price_above','price_below','rsi_above','rsi_below','volume_spike','pct_change_above','pct_change_below')),
  threshold numeric not null,
  current_value numeric,
  status text not null default 'active' check (status in ('active','triggered','paused')),
  delivery text not null default 'email' check (delivery in ('email','webhook','both')),
  webhook_url text,
  note text,
  triggered_at timestamptz,
  created_at timestamptz default now()
);

alter table public.alerts enable row level security;

create policy "Users manage own alerts"
  on public.alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index alerts_user_status_idx on public.alerts(user_id, status);
