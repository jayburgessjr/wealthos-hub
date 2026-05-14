create table public.screener_presets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  filters jsonb not null default '{}',
  created_at timestamptz default now()
);

alter table public.screener_presets enable row level security;

create policy "Users manage own screener presets"
  on public.screener_presets for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
