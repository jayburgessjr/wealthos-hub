create table if not exists public.legal_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  document_key text not null,
  document_version text not null,
  initials text not null,
  accepted_text text not null,
  user_agent text,
  accepted_at timestamp with time zone not null default timezone('utc'::text, now()),
  created_at timestamp with time zone not null default timezone('utc'::text, now())
);

create unique index if not exists legal_acceptances_user_document_version_key
  on public.legal_acceptances (user_id, document_key, document_version);

create index if not exists legal_acceptances_user_id_idx
  on public.legal_acceptances (user_id, accepted_at desc);

alter table public.legal_acceptances enable row level security;

create policy "Users can view own legal acceptances"
  on public.legal_acceptances
  for select
  using (auth.uid() = user_id);

create policy "Users can insert own legal acceptances"
  on public.legal_acceptances
  for insert
  with check (auth.uid() = user_id);

create policy "Admins can view all legal acceptances"
  on public.legal_acceptances
  for select
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.is_admin = true
    )
  );
