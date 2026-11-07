-- Desk hardening (audit B1, B4, B8). Additive and backward compatible: no table is dropped or truncated, no RLS policy is
-- removed or loosened, existing rows are untouched. Functions are replaced with stricter versions of themselves.
-- 20261107000000_desk_core.sql and 20261108000000_desk_multi_owner.sql are already applied and are not edited.

-- ---------- risk event types used by the hardening work (widening a CHECK list only; the table stays append-only) ----------
alter table public.desk_risk_events drop constraint if exists desk_risk_events_event_type_check;
alter table public.desk_risk_events add constraint desk_risk_events_event_type_check check (event_type in (
  'check_passed','check_failed','kill_switch_tripped','kill_switch_reset','daily_limit_hit','owner_claimed','trigger_block','mode_resolved',
  'proposal_released','order_reconciled','order_reconcile_failed','stale_quote','option_stop_breach'));

-- ---------- B1: an approved decision needs a server-written risk marker ----------
-- The owner can reach desk_approvals through PostgREST, so risk_passed alone cannot be trusted. The approve function
-- writes a 'check_passed' risk event (service role only: no API role can insert into desk_risk_events) after the risk
-- engine passes. The guard below refuses an approved decision unless a fresh marker exists for the same proposal, the same
-- risk input hash and the same economics (qty, stop, limit, target). Rejections need no marker (they only make things safer).
create or replace function public.desk_approvals_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare po public.desk_proposed_orders; st public.desk_state; uid uuid := (select auth.uid());
begin
  if tg_op = 'DELETE' then raise exception 'desk_approvals is immutable'; end if;
  if tg_op = 'UPDATE' then
    if public.desk_internal() and old.consumed_at is null and new.consumed_at is not null
       and (to_jsonb(new) - 'consumed_at') = (to_jsonb(old) - 'consumed_at') then
      return new;
    end if;
    raise exception 'desk_approvals is immutable';
  end if;
  if uid is null or not public.is_desk_owner() or new.decided_by <> uid then
    raise exception 'approvals require the owner session'; end if;
  if new.consumed_at is not null then raise exception 'approvals cannot be created consumed'; end if;
  new.decided_at := now();   -- never trust a caller-supplied timestamp: the 5 minute window depends on it
  select * into po from public.desk_proposed_orders where id = new.proposed_order_id for update;
  if not found or po.status <> 'pending' or po.expires_at < now() then
    raise exception 'proposal not pending'; end if;
  select * into st from public.desk_state;
  if new.decision = 'approved' and new.risk_passed and st.halted and po.intent = 'open' then
    raise exception 'kill switch engaged'; end if;
  if new.decision = 'approved' and new.risk_passed then
    if po.stop_price is null or po.stop_price <= 0 then raise exception 'approval needs a proposal with a stop'; end if;
    if not exists (
      select 1 from public.desk_risk_events e
       where e.event_type = 'check_passed'
         and e.proposed_order_id = po.id
         and e.created_at >= now() - interval '5 minutes'
         and e.details->>'inputHash' = new.risk_input_hash
         and (e.details->>'qty')::numeric = po.qty
         and (e.details->>'stopPrice')::numeric = po.stop_price
         and (e.details->>'limitPrice')::numeric is not distinct from po.limit_price
         and (e.details->>'targetPrice')::numeric is not distinct from po.target_price
    ) then
      raise exception 'approval rejected: no server risk check on record for this proposal';
    end if;
  end if;
  perform set_config('desk.internal', '1', true);
  update public.desk_proposed_orders
     set status = case when new.decision = 'approved' and new.risk_passed then 'approved' else 'rejected' end
   where id = po.id;
  perform set_config('desk.internal', '', true);
  return new;
end $$;
revoke all on function public.desk_approvals_guard() from public, anon, authenticated;

-- ---------- B4: kill switch reset needs a note of at least 10 characters (trimmed), only works while halted, and records the prior high-water mark ----------
create or replace function public.desk_reset_kill_switch(p_note text) returns void
language plpgsql security definer set search_path = '' as $$
declare st public.desk_state; uid uuid := (select auth.uid()); note text := left(btrim(coalesce(p_note, '')), 500);
begin
  if not public.is_desk_owner() then raise exception 'owner only'; end if;
  if char_length(note) < 10 then raise exception 'a reset note is required (at least 10 characters)'; end if;
  select * into st from public.desk_state for update;
  if not st.halted then raise exception 'kill switch is not engaged: nothing to reset'; end if;
  perform set_config('desk.reset', '1', true);
  update public.desk_state set halted = false, halted_reason = null, reset_at = now(),
         reset_by = uid, high_water_mark = last_equity;
  perform set_config('desk.reset', '', true);
  insert into public.desk_risk_events(event_type, actor, details)
    values ('kill_switch_reset', 'owner',
            jsonb_build_object('note', note, 'reset_by', uid,
              'prior_high_water_mark', st.high_water_mark, 'rebased_hwm', st.last_equity,
              'prior_halted_reason', st.halted_reason, 'prior_halted_at', st.halted_at));
end $$;
revoke all on function public.desk_reset_kill_switch(text) from public, anon;
grant execute on function public.desk_reset_kill_switch(text) to authenticated;

-- ---------- B8: journal entries record who wrote and who last edited them ----------
alter table public.desk_journal add column if not exists author_user_id uuid references auth.users(id);
alter table public.desk_journal add column if not exists last_edited_by uuid references auth.users(id);

create or replace function public.desk_journal_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    new.last_edited_by := null;
    new.author_user_id := case when uid is not null then uid else null end;   -- never caller supplied
    return new;
  end if;
  if new.author_user_id is distinct from old.author_user_id then
    raise exception 'journal author cannot be changed'; end if;
  new.last_edited_by := uid;
  return new;
end $$;
revoke all on function public.desk_journal_guard() from public, anon, authenticated;
drop trigger if exists trg_desk_journal_guard on public.desk_journal;
create trigger trg_desk_journal_guard before insert or update on public.desk_journal
  for each row execute function public.desk_journal_guard();
