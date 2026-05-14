-- Fix signals table: add INSERT/UPDATE/DELETE policies so only service role can write signals.
-- Previously only a SELECT policy existed, allowing any authenticated user to insert/modify signals.

-- Only service role (edge functions) can insert signals
create policy "Service role inserts signals"
  on public.signals for insert
  to service_role
  with check (true);

-- Only service role can update signals
create policy "Service role updates signals"
  on public.signals for update
  to service_role
  using (true)
  with check (true);

-- Only service role can delete signals
create policy "Service role deletes signals"
  on public.signals for delete
  to service_role
  using (true);

-- Block all other authenticated users from writing signals
-- (the existing SELECT policy already allows reads for authenticated users)
