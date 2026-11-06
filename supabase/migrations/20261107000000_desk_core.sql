-- Desk core (paper-trading terminal). Additive only: every object is desk_* (plus is_desk_owner).
-- Design authority: docs/builds/desk/ARCHITECTURE.md section 2.
-- A raising guard rolls back its transaction, so no trigger_block risk event is written from SQL.

-- ---------- ownership + state ----------
create table if not exists public.desk_owner (
  id boolean primary key default true check (id),            -- single-row enforcement
  user_id uuid not null unique references auth.users(id) on delete restrict,
  claimed_at timestamptz not null default now()
);

create table if not exists public.desk_state (
  id boolean primary key default true check (id),
  halted boolean not null default false,
  halted_reason text,
  halted_at timestamptz,
  high_water_mark numeric(18,2) not null default 0 check (high_water_mark >= 0),
  day_start_equity numeric(18,2) not null default 0,
  day_start_date date,                                       -- America/New_York trading date
  last_equity numeric(18,2) not null default 0,
  last_equity_at timestamptz,
  reset_at timestamptz, reset_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.desk_state(id) values (true) on conflict do nothing;

-- ---------- reference + research ----------
create table if not exists public.desk_instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,                                      -- equity/ETF ticker or OCC symbol for options
  asset_class text not null check (asset_class in ('equity','etf','index','option','crypto')),
  name text, exchange text,
  underlying_id uuid references public.desk_instruments(id),
  option_right text check (option_right in ('call','put')),
  strike numeric(18,4), expiry date, multiplier int not null default 1 check (multiplier > 0),
  active boolean not null default true,
  on_watchlist boolean not null default false,               -- owner-maintained; scanners read on_watchlist and active
  created_at timestamptz not null default now(),
  unique (symbol),
  check ((asset_class = 'option') = (underlying_id is not null and option_right is not null
         and strike is not null and expiry is not null))
);

create table if not exists public.desk_agent_runs (
  id uuid primary key default gen_random_uuid(),
  agent_name text not null,
  trigger text not null check (trigger in ('cron','manual')),
  idempotency_key text not null,                             -- e.g. 'momentum:2026-11-07'
  status text not null default 'running' check (status in ('running','ok','error','skipped')),
  model text, input_tokens int, output_tokens int, cost_usd numeric(10,4),
  summary text, error text,
  started_at timestamptz not null default now(), finished_at timestamptz,
  unique (agent_name, idempotency_key)
);

create table if not exists public.desk_signals (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.desk_instruments(id),
  agent_name text not null, agent_run_id uuid references public.desk_agent_runs(id),
  kind text not null,                                        -- 'momentum','earnings','flow','news',...
  direction text not null check (direction in ('long','short','neutral')),
  strength numeric(4,3) not null check (strength between 0 and 1),
  summary text not null,
  source_links jsonb not null default '[]' check (jsonb_typeof(source_links) = 'array'), -- [{url,title,published_at}]
  dedupe_key text unique,                                    -- nullable; nulls never collide, so re-runs with a key cannot duplicate
  raw jsonb, expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.desk_signals (instrument_id, created_at desc);
create index on public.desk_signals (agent_name, created_at desc);

create table if not exists public.desk_theses (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.desk_instruments(id),
  signal_ids uuid[] not null default '{}',
  agent_name text not null, agent_run_id uuid references public.desk_agent_runs(id),
  direction text not null check (direction in ('long','short')),
  bull_case text not null, bear_case text not null,
  catalysts jsonb not null default '[]' check (jsonb_typeof(catalysts) = 'array'), -- [{event,date}]
  entry_price numeric(18,4) not null check (entry_price > 0),
  stop_price numeric(18,4) not null check (stop_price > 0),
  target_price numeric(18,4) not null check (target_price > 0),
  size_risk_pct numeric(5,4) check (size_risk_pct between 0 and 0.015),  -- suggestion only; engine decides
  size_qty numeric(18,4) check (size_qty > 0),
  confidence numeric(4,3) not null check (confidence between 0 and 1),
  invalidation text not null,
  horizon_days int not null default 20 check (horizon_days > 0),
  status text not null default 'active' check (status in ('active','invalidated','closed','expired')),
  created_at timestamptz not null default now(),
  check ((direction = 'long' and stop_price < entry_price and target_price > entry_price)
      or (direction = 'short' and stop_price > entry_price and target_price < entry_price))
);
create index on public.desk_theses (instrument_id, created_at desc);

-- ---------- order pipeline ----------
create table if not exists public.desk_proposed_orders (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid references public.desk_theses(id),
  instrument_id uuid not null references public.desk_instruments(id),   -- underlying for option structures
  agent_name text not null, agent_run_id uuid references public.desk_agent_runs(id),
  intent text not null default 'open' check (intent in ('open','close')),
  position_id uuid,                                                      -- required when intent='close' (FK added after positions)
  structure text not null default 'stock' check (structure in
    ('stock','crypto','long_call','long_put','debit_spread','credit_spread','iron_condor','iron_butterfly')),
  side text not null check (side in ('buy','sell')),
  qty numeric(18,4) not null check (qty > 0),                            -- shares or contracts
  order_type text not null check (order_type in ('market','limit')),
  limit_price numeric(18,4) check (limit_price > 0),
  legs jsonb,                                                            -- option legs (see OptionLeg)
  stop_price numeric(18,4) not null check (stop_price > 0),              -- MANDATORY
  stop_basis text not null default 'price' check (stop_basis in ('price','underlying','premium')),
  target_price numeric(18,4),
  max_loss numeric(18,2),                                                -- agent estimate; engine recomputes
  rationale text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','expired','executed','failed')),
  expires_at timestamptz not null default (now() + interval '1 day'),
  created_at timestamptz not null default now(),
  check (order_type <> 'limit' or limit_price is not null),
  check (structure in ('stock','crypto') or legs is not null),
  check (intent <> 'close' or position_id is not null)
);
create index on public.desk_proposed_orders (status, created_at desc);

create table if not exists public.desk_approvals (
  id uuid primary key default gen_random_uuid(),
  proposed_order_id uuid not null unique references public.desk_proposed_orders(id),  -- one decision per proposal
  decision text not null check (decision in ('approved','rejected')),
  risk_passed boolean not null,
  risk_decision jsonb not null,           -- full RiskDecision
  risk_input_hash text not null,          -- sha256(canonical RiskInput) for audit
  mode text not null check (mode in ('paper','live')),
  live_confirmed boolean not null default false,
  live_confirmation text,                 -- exact typed phrase, e.g. 'LIVE AAPL BUY 10'
  decided_by uuid not null references auth.users(id),
  decided_at timestamptz not null default now(),
  consumed_at timestamptz,                -- set when order row created (one-shot)
  check (mode <> 'live' or decision <> 'approved' or live_confirmed)
);

create table if not exists public.desk_orders (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null unique references public.desk_approvals(id),  -- one order per approval
  proposed_order_id uuid not null references public.desk_proposed_orders(id),
  instrument_id uuid not null references public.desk_instruments(id),
  mode text not null check (mode in ('paper','live')),
  broker text not null check (broker in ('paper','alpaca','ibkr')),
  client_order_id text not null unique,   -- = approval_id::text; broker-side dedupe
  broker_order_id text,
  intent text not null check (intent in ('open','close')),
  structure text not null check (structure in ('stock','crypto','long_call','long_put','debit_spread','credit_spread','iron_condor','iron_butterfly')),
  side text not null check (side in ('buy','sell')), qty numeric(18,4) not null check (qty > 0),
  order_type text not null check (order_type in ('market','limit')), limit_price numeric(18,4),
  legs jsonb,
  stop_price numeric(18,4) not null,                                       -- MANDATORY (closes inherit the position stop)
  target_price numeric(18,4),
  status text not null default 'submitting' check (status in
    ('submitting','submitted','partially_filled','filled','canceled','rejected','failed')),
  filled_qty numeric(18,4) not null default 0, avg_fill_price numeric(18,4),
  error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table if not exists public.desk_positions (
  id uuid primary key default gen_random_uuid(),
  position_group uuid not null default gen_random_uuid(),   -- a spread/condor = ONE group = ONE "options position"
  instrument_id uuid not null references public.desk_instruments(id),  -- underlying
  thesis_id uuid references public.desk_theses(id), agent_name text,
  mode text not null check (mode in ('paper','live')),
  structure text not null check (structure in ('stock','crypto','long_call','long_put','debit_spread','credit_spread','iron_condor','iron_butterfly')),
  legs jsonb, qty numeric(18,4) not null check (qty > 0),
  avg_price numeric(18,4) not null, stop_price numeric(18,4) not null, target_price numeric(18,4),
  max_loss numeric(18,2) not null,                          -- capital at risk (see 3.3)
  exposure numeric(18,2) not null,                          -- per-position cap basis (see 3.3)
  mark_price numeric(18,4), marked_at timestamptz,
  status text not null default 'open' check (status in ('open','closed')),
  opened_order_id uuid references public.desk_orders(id), closed_order_id uuid references public.desk_orders(id),
  opened_at timestamptz not null default now(), closed_at timestamptz,
  close_price numeric(18,4), realized_pnl numeric(18,2)
);
create index on public.desk_positions (status, instrument_id);
alter table public.desk_proposed_orders add foreign key (position_id) references public.desk_positions(id);

create table if not exists public.desk_journal (
  id uuid primary key default gen_random_uuid(),
  author text not null,                                     -- 'owner' or agent name
  entry_type text not null check (entry_type in ('note','entry','exit','review','postmortem')),
  thesis_id uuid references public.desk_theses(id), position_id uuid references public.desk_positions(id),
  order_id uuid references public.desk_orders(id),
  body text not null, tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.desk_scorecard (
  id uuid primary key default gen_random_uuid(),
  subject_kind text not null check (subject_kind in ('signal','thesis','trade')),
  subject_id uuid not null,                                     -- polymorphic, no FK
  agent_name text not null,
  horizon_days int not null check (horizon_days in (1,5,20)),   -- trading days
  t0_date date not null, t0_price numeric(18,4) not null,
  tn_date date not null, tn_price numeric(18,4) not null,
  return_pct numeric(9,4) not null,                             -- direction-signed
  benchmark_symbol text not null default 'SPY',
  benchmark_return_pct numeric(9,4) not null,                   -- direction-signed
  alpha_pct numeric(9,4) not null,                              -- return_pct - benchmark_return_pct
  target_hit boolean not null default false, stop_hit boolean not null default false,
  first_touch text not null default 'none' check (first_touch in ('target','stop','none')),
  computed_at timestamptz not null default now(),
  unique (subject_kind, subject_id, horizon_days)
);
create index on public.desk_scorecard (agent_name, horizon_days);

create table if not exists public.desk_risk_events (                       -- append-only
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('check_passed','check_failed','kill_switch_tripped',
    'kill_switch_reset','daily_limit_hit','owner_claimed','trigger_block','mode_resolved')),
  proposed_order_id uuid references public.desk_proposed_orders(id),
  actor text not null,                                      -- 'owner' | 'system:<fn>'
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.desk_risk_events (created_at desc);

-- numeric accepts 'NaN' and NaN > 0 is true in Postgres, so reject it explicitly on money-bearing columns
alter table public.desk_proposed_orders add constraint desk_po_finite check (
  qty <> 'NaN' and stop_price <> 'NaN' and (limit_price is null or limit_price <> 'NaN') and (target_price is null or target_price <> 'NaN'));
alter table public.desk_orders add constraint desk_ord_finite check (qty <> 'NaN' and stop_price <> 'NaN');
alter table public.desk_theses add constraint desk_th_horizon check (horizon_days <= 60);

-- =====================================================================
-- Row level security: enabled AND forced on every desk_ table (default deny)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array['desk_owner','desk_state','desk_instruments','desk_agent_runs','desk_signals',
    'desk_theses','desk_proposed_orders','desk_approvals','desk_orders','desk_positions','desk_journal',
    'desk_scorecard','desk_risk_events'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;

-- ---------- ownership ----------
create or replace function public.is_desk_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.desk_owner where user_id = (select auth.uid()));
$$;
revoke all on function public.is_desk_owner() from public, anon;
grant execute on function public.is_desk_owner() to authenticated;

-- ---------- policies (all to authenticated, all wrapped in is_desk_owner) ----------
do $$
declare t text;
begin
  foreach t in array array['desk_owner','desk_state','desk_instruments','desk_agent_runs','desk_signals',
    'desk_theses','desk_proposed_orders','desk_approvals','desk_orders','desk_positions','desk_journal',
    'desk_scorecard','desk_risk_events'] loop
    execute format('create policy %I on public.%I for select to authenticated using ((select public.is_desk_owner()))',
      t || '_owner_select', t);
  end loop;
end $$;

-- owner may edit a pending proposal (qty/limit/stop/target) or reject it; trigger limits the columns
grant update (qty, limit_price, stop_price, target_price, status) on public.desk_proposed_orders to authenticated;
create policy desk_proposed_orders_owner_update on public.desk_proposed_orders for update to authenticated
  using ((select public.is_desk_owner()) and status = 'pending')
  with check ((select public.is_desk_owner()) and status in ('pending','rejected'));

-- approvals: owner insert only, as themselves (no update/delete policy; trigger also raises)
grant insert on public.desk_approvals to authenticated;
create policy desk_approvals_owner_insert on public.desk_approvals for insert to authenticated
  with check ((select public.is_desk_owner()) and decided_by = (select auth.uid()));

-- instruments: owner may toggle the watchlist flag only (column-level grant)
grant update (on_watchlist) on public.desk_instruments to authenticated;
create policy desk_instruments_owner_update on public.desk_instruments for update to authenticated
  using ((select public.is_desk_owner())) with check ((select public.is_desk_owner()));

-- journal: owner writes own notes
grant insert, update on public.desk_journal to authenticated;
create policy desk_journal_owner_insert on public.desk_journal for insert to authenticated
  with check ((select public.is_desk_owner()) and author = 'owner');
create policy desk_journal_owner_update on public.desk_journal for update to authenticated
  using ((select public.is_desk_owner()) and author = 'owner')
  with check ((select public.is_desk_owner()) and author = 'owner');

-- =====================================================================
-- Guards (DB-level; fire for service role too)
-- =====================================================================

-- Internal bypass: a transaction-local GUC is honoured only from a nested trigger (depth > 1),
-- so a caller setting it from top-level SQL gains nothing.
create or replace function public.desk_internal() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(current_setting('desk.internal', true), '') = '1' and pg_trigger_depth() > 1;
$$;
revoke all on function public.desk_internal() from public, anon, authenticated;

-- proposed orders: status machine + column limits
create or replace function public.desk_proposed_orders_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  owner_cols text[] := array['qty','limit_price','stop_price','target_price','status'];
begin
  if tg_op = 'DELETE' then raise exception 'proposed orders are never deleted'; end if;
  if tg_op = 'INSERT' then
    if new.status <> 'pending' then raise exception 'proposals must be created pending'; end if;
    if new.intent = 'close' and not exists (
         select 1 from public.desk_positions p
          where p.id = new.position_id and p.status = 'open'
            and p.instrument_id = new.instrument_id and p.structure = new.structure
            and new.qty <= p.qty
            and new.side = case when p.structure in ('credit_spread','iron_condor','iron_butterfly') then 'buy' else 'sell' end) then
      raise exception 'close must match an open position: same instrument and structure, opposite side, quantity within the position';
    end if;
    return new;
  end if;
  -- UPDATE
  if public.desk_internal() then
    if (to_jsonb(new) - 'status') <> (to_jsonb(old) - 'status') then
      raise exception 'internal status update may only change status'; end if;
    return new;
  end if;
  if uid is not null then
    if not public.is_desk_owner() then raise exception 'owner only'; end if;
    if old.status <> 'pending' then raise exception 'only pending proposals can be edited'; end if;
    if new.status not in ('pending','rejected') then
      raise exception 'owner may only keep pending or reject'; end if;
    if (to_jsonb(new) - owner_cols) <> (to_jsonb(old) - owner_cols) then
      raise exception 'owner may only change qty, limit, stop, target or reject'; end if;
    return new;
  end if;
  -- service role / system: status transitions only, never economics
  if (to_jsonb(new) - 'status') <> (to_jsonb(old) - 'status') then
    raise exception 'proposal economics are immutable'; end if;
  if not ((old.status = 'pending' and new.status in ('pending','expired'))
       or (old.status = 'approved' and new.status in ('approved','executed','failed','expired'))
       or old.status = new.status) then
    raise exception 'illegal proposal status transition % -> %', old.status, new.status; end if;
  return new;
end $$;
revoke all on function public.desk_proposed_orders_guard() from public, anon, authenticated;
create trigger trg_desk_proposed_orders_guard before insert or update or delete on public.desk_proposed_orders
  for each row execute function public.desk_proposed_orders_guard();

-- approvals: only the owner's own session may write; immutable afterwards (except one-shot consume)
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
  perform set_config('desk.internal', '1', true);
  update public.desk_proposed_orders
     set status = case when new.decision = 'approved' and new.risk_passed then 'approved' else 'rejected' end
   where id = po.id;
  perform set_config('desk.internal', '', true);
  return new;
end $$;
revoke all on function public.desk_approvals_guard() from public, anon, authenticated;
create trigger trg_desk_approvals_guard before insert or update or delete on public.desk_approvals
  for each row execute function public.desk_approvals_guard();

-- orders: need a matching, fresh, unconsumed approval; economics immutable afterwards
create or replace function public.desk_orders_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare a public.desk_approvals; po public.desk_proposed_orders; st public.desk_state;
begin
  if tg_op = 'DELETE' then raise exception 'orders are never deleted'; end if;
  if tg_op = 'UPDATE' then
    if (new.approval_id, new.proposed_order_id, new.instrument_id, new.intent, new.structure, new.side, new.qty,
        new.order_type, new.limit_price, new.legs, new.stop_price, new.mode, new.client_order_id)
       is distinct from
       (old.approval_id, old.proposed_order_id, old.instrument_id, old.intent, old.structure, old.side, old.qty,
        old.order_type, old.limit_price, old.legs, old.stop_price, old.mode, old.client_order_id)
    then raise exception 'order economics immutable'; end if;
    new.updated_at := now();
    return new;
  end if;
  if new.client_order_id is distinct from new.approval_id::text then
    raise exception 'client_order_id must equal the approval id'; end if;
  select * into a from public.desk_approvals where id = new.approval_id for update;
  if not found or a.decision <> 'approved' or a.risk_passed is not true
     or a.proposed_order_id <> new.proposed_order_id or a.consumed_at is not null
     or a.decided_at < now() - interval '5 minutes' or a.mode <> new.mode
     or (new.mode = 'live' and not a.live_confirmed) then
    raise exception 'order rejected: no valid approval';
  end if;
  select * into po from public.desk_proposed_orders where id = new.proposed_order_id;
  if po.status <> 'approved'
     or (po.side, po.qty, po.stop_price, po.structure, po.instrument_id, po.intent, po.legs,
         po.order_type, po.limit_price, po.target_price)
        is distinct from
        (new.side, new.qty, new.stop_price, new.structure, new.instrument_id, new.intent, new.legs,
         new.order_type, new.limit_price, new.target_price)
     or new.stop_price is null then
    raise exception 'order does not match approved proposal';
  end if;
  select * into st from public.desk_state;
  if st.halted and new.intent = 'open' then raise exception 'kill switch engaged'; end if;
  perform set_config('desk.internal', '1', true);
  update public.desk_approvals set consumed_at = now() where id = a.id;
  perform set_config('desk.internal', '', true);
  return new;
end $$;
revoke all on function public.desk_orders_guard() from public, anon, authenticated;
create trigger trg_desk_orders_guard before insert or update or delete on public.desk_orders
  for each row execute function public.desk_orders_guard();

-- kill switch store. Invoker-rights on purpose: current_user is the real caller, so the reset
-- bypass only works from inside desk_reset_kill_switch() (definer), never from an API role.
create or replace function public.desk_state_guard() returns trigger
language plpgsql set search_path = '' as $$
declare via_reset boolean := coalesce(current_setting('desk.reset', true), '') = '1'
  and current_user not in ('anon','authenticated','service_role','authenticator');
begin
  if tg_op = 'DELETE' then raise exception 'desk_state is permanent'; end if;
  if old.halted and not new.halted and not via_reset then
    raise exception 'kill switch can only be reset by desk_reset_kill_switch()'; end if;
  if new.high_water_mark < old.high_water_mark and not via_reset then
    raise exception 'high-water mark cannot decrease'; end if;
  new.updated_at := now();
  return new;
end $$;
revoke all on function public.desk_state_guard() from public, anon, authenticated;
create trigger trg_desk_state_guard before update or delete on public.desk_state
  for each row execute function public.desk_state_guard();

create or replace function public.desk_reset_kill_switch(p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_desk_owner() then raise exception 'owner only'; end if;
  perform set_config('desk.reset', '1', true);
  update public.desk_state set halted = false, halted_reason = null, reset_at = now(),
         reset_by = (select auth.uid()), high_water_mark = last_equity;
  perform set_config('desk.reset', '', true);
  insert into public.desk_risk_events(event_type, actor, details)
    values ('kill_switch_reset', 'owner',
            jsonb_build_object('note', p_note, 'rebased_hwm', (select last_equity from public.desk_state)));
end $$;
revoke all on function public.desk_reset_kill_switch(text) from public, anon;
grant execute on function public.desk_reset_kill_switch(text) to authenticated;

-- append-only audit
create or replace function public.desk_append_only_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;
revoke all on function public.desk_append_only_guard() from public, anon, authenticated;
create trigger trg_desk_risk_events_append_only before update or delete on public.desk_risk_events
  for each row execute function public.desk_append_only_guard();
create trigger trg_desk_scorecard_immutable before update or delete on public.desk_scorecard
  for each row execute function public.desk_append_only_guard();

-- =====================================================================
-- Scorecard roll-up (invoker rights: underlying RLS applies to the caller)
-- =====================================================================
create or replace view public.desk_scorecard_by_agent with (security_invoker = true) as
select agent_name, subject_kind, horizon_days,
       count(*)::int as n,
       avg((return_pct > 0)::int)::numeric(9,4) as hit_rate,
       avg(return_pct)::numeric(9,4) as mean_return_pct,
       avg(alpha_pct)::numeric(9,4) as mean_alpha_pct,
       (percentile_cont(0.5) within group (order by alpha_pct))::numeric(9,4) as median_alpha_pct
  from public.desk_scorecard
 group by agent_name, subject_kind, horizon_days;
revoke all on public.desk_scorecard_by_agent from anon, authenticated;
grant select on public.desk_scorecard_by_agent to authenticated;

-- =====================================================================
-- TRUNCATE protection. Row-level DELETE triggers do not fire for TRUNCATE, so block it explicitly
-- (the audit log, kill-switch state, approvals and orders must never be wiped).
-- =====================================================================
create or replace function public.desk_no_truncate() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception '% cannot be truncated', tg_table_name;
end $$;
revoke all on function public.desk_no_truncate() from public, anon, authenticated;
do $$
declare t text;
begin
  foreach t in array array['desk_owner','desk_state','desk_instruments','desk_agent_runs','desk_signals',
    'desk_theses','desk_proposed_orders','desk_approvals','desk_orders','desk_positions','desk_journal',
    'desk_scorecard','desk_risk_events'] loop
    execute format('create trigger %I before truncate on public.%I for each statement execute function public.desk_no_truncate()', 'trg_' || t || '_no_truncate', t);
    execute format('revoke truncate on public.%I from public, anon, authenticated', t);
  end loop;
end $$;
