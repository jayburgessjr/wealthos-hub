create table public.bots (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  status text not null default 'draft' check (status in ('active','paused','draft')),
  entry_conditions jsonb not null default '[]',
  exit_conditions jsonb not null default '[]',
  symbols text[] not null default '{}',
  position_size_pct numeric not null default 5 check (position_size_pct > 0 and position_size_pct <= 100),
  max_concurrent_trades integer not null default 1,
  paper_mode boolean not null default true,
  webhook_url text,
  executions_count integer not null default 0,
  last_triggered_at timestamptz,
  created_at timestamptz default now()
);

create table public.bot_executions (
  id uuid default gen_random_uuid() primary key,
  bot_id uuid references public.bots(id) on delete cascade not null,
  symbol text not null,
  action text not null check (action in ('buy','sell','short','cover')),
  price numeric,
  quantity numeric,
  status text not null default 'pending' check (status in ('pending','filled','cancelled','failed')),
  paper_mode boolean not null default true,
  note text,
  executed_at timestamptz default now()
);

alter table public.bots enable row level security;
alter table public.bot_executions enable row level security;

create policy "Users manage own bots" on public.bots for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Users view own executions" on public.bot_executions for select using (
  exists (select 1 from public.bots where id = bot_id and user_id = auth.uid())
);
create policy "Users insert own executions" on public.bot_executions for insert with check (
  exists (select 1 from public.bots where id = bot_id and user_id = auth.uid())
);

create index bots_user_idx on public.bots(user_id);
create index bot_executions_bot_idx on public.bot_executions(bot_id, executed_at desc);
