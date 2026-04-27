create table if not exists public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  trade_date date not null default current_date,
  ticker text not null,
  direction text not null check (direction in ('long','short')),
  entry_price numeric,
  exit_price numeric,
  pnl_dollars numeric default 0,
  pnl_percent numeric default 0,
  emotion_tag text check (emotion_tag in ('disciplined','confident','fomo','revenge','patient','anxious','greedy')),
  setup_quality integer check (setup_quality between 1 and 5),
  followed_plan boolean default true,
  notes text,
  lessons text,
  created_at timestamptz default now()
);

alter table public.journal_entries enable row level security;

create policy "Users manage own journal" on public.journal_entries
  for all using (auth.uid() = user_id);
