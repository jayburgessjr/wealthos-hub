-- Trade ideas
create table public.trade_ideas (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  ticker text not null,
  title text not null,
  thesis text not null,
  action text not null check (action in ('buy','sell','short','watch','hold')),
  timeframe text not null check (timeframe in ('intraday','swing','position','long_term')),
  entry_price numeric,
  target_price numeric,
  stop_price numeric,
  risk_reward numeric generated always as (
    case when entry_price is not null and stop_price is not null and target_price is not null and stop_price != entry_price
    then round(abs(target_price - entry_price) / abs(entry_price - stop_price), 2)
    else null end
  ) stored,
  likes_count integer not null default 0,
  comments_count integer not null default 0,
  created_at timestamptz default now()
);

-- Likes (unique per user per idea)
create table public.idea_likes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  idea_id uuid references public.trade_ideas(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(user_id, idea_id)
);

-- Comments
create table public.idea_comments (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  idea_id uuid references public.trade_ideas(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- Follows
create table public.trader_follows (
  id uuid default gen_random_uuid() primary key,
  follower_id uuid references auth.users(id) on delete cascade not null,
  following_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique(follower_id, following_id)
);

-- RLS
alter table public.trade_ideas enable row level security;
alter table public.idea_likes enable row level security;
alter table public.idea_comments enable row level security;
alter table public.trader_follows enable row level security;

create policy "Anyone can read ideas" on public.trade_ideas for select using (true);
create policy "Auth users create ideas" on public.trade_ideas for insert with check (auth.uid() = user_id);
create policy "Users delete own ideas" on public.trade_ideas for delete using (auth.uid() = user_id);

create policy "Anyone can read likes" on public.idea_likes for select using (true);
create policy "Auth users manage own likes" on public.idea_likes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Anyone can read comments" on public.idea_comments for select using (true);
create policy "Auth users create comments" on public.idea_comments for insert with check (auth.uid() = user_id);
create policy "Users delete own comments" on public.idea_comments for delete using (auth.uid() = user_id);

create policy "Anyone can read follows" on public.trader_follows for select using (true);
create policy "Auth users manage own follows" on public.trader_follows for all using (auth.uid() = follower_id) with check (auth.uid() = follower_id);

-- Indexes
create index trade_ideas_user_idx on public.trade_ideas(user_id);
create index trade_ideas_ticker_idx on public.trade_ideas(ticker);
create index trade_ideas_created_idx on public.trade_ideas(created_at desc);
