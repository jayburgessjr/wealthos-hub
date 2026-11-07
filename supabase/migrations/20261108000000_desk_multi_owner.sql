-- Desk: allow up to two owners (both must be on the DESK_OWNER_EMAIL allowlist to claim).
-- Replaces the single-row key on desk_owner with a primary key on user_id and a hard cap of 2 rows.
-- is_desk_owner() and every RLS policy are unchanged: they already test membership, not row count.
-- Additive in effect: no existing rows are touched (desk_owner is empty at the time of writing).

alter table public.desk_owner drop constraint if exists desk_owner_pkey;
alter table public.desk_owner drop column if exists id;
alter table public.desk_owner add primary key (user_id);

create or replace function public.desk_owner_cap() returns trigger
  language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform pg_advisory_xact_lock(hashtext('desk_owner_cap'));
  if (select count(*) from public.desk_owner) >= 2 then
    raise exception 'desk owner cap (2) reached';
  end if;
  return new;
end $$;
revoke all on function public.desk_owner_cap() from public, anon, authenticated;

drop trigger if exists desk_owner_cap on public.desk_owner;
create trigger desk_owner_cap before insert on public.desk_owner
  for each row execute function public.desk_owner_cap();
