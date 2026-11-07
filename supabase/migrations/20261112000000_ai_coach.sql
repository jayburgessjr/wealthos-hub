-- AI coach: per-user plan tables, default-deny RLS (user_id = auth.uid()), invoker RPCs.
-- Additive only. All functions run with invoker rights (caller's privileges), so RLS stays the gate.
-- Depends on: public.update_updated_at_column(), auth.users, auth.uid().

-- ───────────────────────────── tables ─────────────────────────────

create table public.user_strategy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  status text not null default 'interviewing' check (status in ('interviewing', 'active')),
  primary_goal text check (char_length(primary_goal) <= 300),
  time_horizon_years int check (time_horizon_years between 1 and 60),
  risk_tolerance text check (risk_tolerance in ('conservative', 'moderate', 'aggressive')),
  profile jsonb not null default '{}'::jsonb check (jsonb_typeof(profile) = 'object' and pg_column_size(profile) <= 8192),
  profile_locked text[] not null default '{}',
  summary text check (char_length(summary) <= 1500),
  summary_edited boolean not null default false,
  summary_proposal text check (char_length(summary_proposal) <= 1500),
  version int not null default 0,
  last_ai_update_at timestamptz,
  onboarding_hints_used boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.strategy_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  section text not null check (section in ('wealth', 'invest', 'opportunity', 'gap', 'income')),
  ai_key text check (ai_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  title text not null check (char_length(title) between 1 and 160),
  body text not null default '' check (char_length(body) <= 1200),
  metrics jsonb not null default '{}'::jsonb check (jsonb_typeof(metrics) = 'object' and pg_column_size(metrics) <= 2048),
  impact smallint check (impact between 1 and 5),
  position int not null default 0,
  source text not null default 'user' check (source in ('ai', 'user')),
  edited_by_user boolean not null default false,
  pending_ai_proposal jsonb check (jsonb_typeof(pending_ai_proposal) = 'object' and pg_column_size(pending_ai_proposal) <= 4096),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_items_ai_needs_key check (source = 'user' or ai_key is not null),
  constraint strategy_items_id_user_key unique (id, user_id)
);
create unique index strategy_items_ai_key_uq on public.strategy_items (user_id, section, ai_key) where ai_key is not null;
create index strategy_items_live_idx on public.strategy_items (user_id, section, position) where archived_at is null;

create table public.strategy_actions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  ai_key text check (ai_key ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  title text not null check (char_length(title) between 1 and 160),
  detail text not null default '' check (char_length(detail) <= 800),
  priority smallint not null check (priority between 1 and 5),
  track text not null default 'general' check (track in ('general', 'save', 'debt', 'invest', 'earn', 'protect')),
  status text not null default 'todo' check (status in ('todo', 'done', 'dismissed')),
  due_hint text check (char_length(due_hint) <= 80),
  linked_item_id uuid,
  source text not null default 'user' check (source in ('ai', 'user')),
  edited_by_user boolean not null default false,
  pending_ai_proposal jsonb check (jsonb_typeof(pending_ai_proposal) = 'object' and pg_column_size(pending_ai_proposal) <= 4096),
  archived_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint strategy_actions_ai_needs_key check (source = 'user' or ai_key is not null),
  -- a link can never cross tenants
  constraint strategy_actions_item_fk foreign key (linked_item_id, user_id)
    references public.strategy_items (id, user_id) on delete set null (linked_item_id)
);
create unique index strategy_actions_ai_key_uq on public.strategy_actions (user_id, ai_key) where ai_key is not null;
create index strategy_actions_list_idx on public.strategy_actions (user_id, status, priority, created_at);

create table public.strategy_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  client_msg_id uuid,
  created_at timestamptz not null default now(),
  constraint strategy_messages_client_uq unique (user_id, client_msg_id)
);
create index strategy_messages_recent_idx on public.strategy_messages (user_id, created_at desc);

-- ───────────────────────────── RLS (default deny) ─────────────────────────────

alter table public.user_strategy enable row level security;
alter table public.strategy_items enable row level security;
alter table public.strategy_actions enable row level security;
alter table public.strategy_messages enable row level security;

revoke all on table public.user_strategy, public.strategy_items, public.strategy_actions, public.strategy_messages from public, anon, authenticated;
grant select, insert, update, delete on table public.user_strategy, public.strategy_items, public.strategy_actions to authenticated;
-- messages are immutable: no update or delete grant (account removal cascades through the foreign key)
grant select, insert on table public.strategy_messages to authenticated;

create policy user_strategy_select on public.user_strategy for select to authenticated using (user_id = (select auth.uid()));
create policy user_strategy_insert on public.user_strategy for insert to authenticated with check (user_id = (select auth.uid()));
create policy user_strategy_update on public.user_strategy for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy user_strategy_delete on public.user_strategy for delete to authenticated using (user_id = (select auth.uid()));

create policy strategy_items_select on public.strategy_items for select to authenticated using (user_id = (select auth.uid()));
create policy strategy_items_insert on public.strategy_items for insert to authenticated with check (user_id = (select auth.uid()));
create policy strategy_items_update on public.strategy_items for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy strategy_items_delete on public.strategy_items for delete to authenticated using (user_id = (select auth.uid()));

create policy strategy_actions_select on public.strategy_actions for select to authenticated using (user_id = (select auth.uid()));
create policy strategy_actions_insert on public.strategy_actions for insert to authenticated with check (user_id = (select auth.uid()));
create policy strategy_actions_update on public.strategy_actions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy strategy_actions_delete on public.strategy_actions for delete to authenticated using (user_id = (select auth.uid()));

create policy strategy_messages_select on public.strategy_messages for select to authenticated using (user_id = (select auth.uid()));
create policy strategy_messages_insert on public.strategy_messages for insert to authenticated with check (user_id = (select auth.uid()));

-- ───────────────────────────── triggers ─────────────────────────────

create trigger user_strategy_updated_at before update on public.user_strategy for each row execute function public.update_updated_at_column();
create trigger strategy_items_updated_at before update on public.strategy_items for each row execute function public.update_updated_at_column();
create trigger strategy_actions_updated_at before update on public.strategy_actions for each row execute function public.update_updated_at_column();

-- Marks user edits so later AI revisions become proposals instead of overwrites.
-- The AI RPCs set the transaction-local flag strategy.ai_apply = '1'; anything else is a user edit.
create function public.strategy_mark_edited() returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  k text;
begin
  if coalesce(current_setting('strategy.ai_apply', true), '') = '1' then
    return new;
  end if;

  if tg_table_name = 'strategy_items' then
    if new.title is distinct from old.title or new.body is distinct from old.body
       or new.metrics is distinct from old.metrics or new.impact is distinct from old.impact then
      new.edited_by_user := true;
    end if;
  elsif tg_table_name = 'strategy_actions' then
    -- status and completed_at are user state, not content: toggling them is not an edit
    if new.title is distinct from old.title or new.detail is distinct from old.detail
       or new.priority is distinct from old.priority or new.due_hint is distinct from old.due_hint
       or new.track is distinct from old.track then
      new.edited_by_user := true;
    end if;
  elsif tg_table_name = 'user_strategy' then
    if new.primary_goal is distinct from old.primary_goal and not ('primary_goal' = any (new.profile_locked)) then
      new.profile_locked := array_append(new.profile_locked, 'primary_goal');
    end if;
    if new.time_horizon_years is distinct from old.time_horizon_years and not ('time_horizon_years' = any (new.profile_locked)) then
      new.profile_locked := array_append(new.profile_locked, 'time_horizon_years');
    end if;
    if new.risk_tolerance is distinct from old.risk_tolerance and not ('risk_tolerance' = any (new.profile_locked)) then
      new.profile_locked := array_append(new.profile_locked, 'risk_tolerance');
    end if;
    for k in select jsonb_object_keys(coalesce(old.profile, '{}'::jsonb) || coalesce(new.profile, '{}'::jsonb)) loop
      if (old.profile -> k) is distinct from (new.profile -> k) and not (k = any (new.profile_locked)) then
        new.profile_locked := array_append(new.profile_locked, k);
      end if;
    end loop;
    if new.summary is distinct from old.summary then
      new.summary_edited := true;
    end if;
  end if;
  return new;
end;
$$;

create trigger user_strategy_mark_edited before update on public.user_strategy for each row execute function public.strategy_mark_edited();
create trigger strategy_items_mark_edited before update on public.strategy_items for each row execute function public.strategy_mark_edited();
create trigger strategy_actions_mark_edited before update on public.strategy_actions for each row execute function public.strategy_mark_edited();

-- ───────────────────────────── RPCs (security invoker) ─────────────────────────────

-- One transaction: per-minute cap, idempotency, persistence of the user's message.
create function public.coach_begin_turn(p_client_msg_id uuid, p_content text) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  existing_at timestamptz;
  recent int;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_client_msg_id is null then
    raise exception 'client_msg_id required' using errcode = '22023';
  end if;

  select created_at into existing_at from public.strategy_messages
   where user_id = uid and client_msg_id = p_client_msg_id and role = 'user';
  if found then
    if exists (select 1 from public.strategy_messages where user_id = uid and role = 'assistant' and created_at > existing_at) then
      return jsonb_build_object('status', 'replayed');
    end if;
    -- user message saved, no reply yet: regenerate (bounded by the shared daily cap)
    return jsonb_build_object('status', 'retry');
  end if;

  select count(*) into recent from public.strategy_messages
   where user_id = uid and role = 'user' and created_at > now() - interval '1 minute';
  if recent >= 8 then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  insert into public.strategy_messages (user_id, role, content, client_msg_id)
  values (uid, 'user', p_content, p_client_msg_id)
  on conflict (user_id, client_msg_id) do nothing;
  return jsonb_build_object('status', 'new');
end;
$$;

create function public.coach_save_reply(p_client_msg_id uuid, p_content text) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  user_at timestamptz;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  select created_at into user_at from public.strategy_messages
   where user_id = uid and client_msg_id = p_client_msg_id and role = 'user';
  if not found then
    raise exception 'unknown turn' using errcode = '22023';
  end if;
  if exists (select 1 from public.strategy_messages where user_id = uid and role = 'assistant' and created_at > user_at) then
    return;
  end if;
  insert into public.strategy_messages (user_id, role, content) values (uid, 'assistant', left(p_content, 8000));
end;
$$;

-- Applies one validated update_strategy payload atomically (any raise rolls everything back).
create function public.apply_strategy_update(p_update jsonb) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  s public.user_strategy%rowtype;
  prof jsonb;
  k text;
  it jsonb;
  ac jsonb;
  rk jsonb;
  ex_id uuid;
  ex_source text;
  ex_edited boolean;
  ex_archived timestamptz;
  link_id uuid;
  n int;
  ord int;
  applied int := 0;
  proposed int := 0;
  skipped int := 0;
  removed int := 0;
  new_goal text;
  new_horizon int;
  new_risk text;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  if p_update is null or jsonb_typeof(p_update) <> 'object' then
    raise exception 'invalid payload' using errcode = '22023';
  end if;

  perform set_config('strategy.ai_apply', '1', true);

  insert into public.user_strategy (user_id) values (uid) on conflict (user_id) do nothing;
  select * into s from public.user_strategy where user_id = uid for update;

  -- profile (locked fields are never overwritten)
  prof := coalesce(p_update -> 'profile', '{}'::jsonb);
  if jsonb_typeof(prof) = 'object' then
    if prof ? 'primary_goal' and not ('primary_goal' = any (s.profile_locked)) then
      s.primary_goal := left(prof ->> 'primary_goal', 300);
    end if;
    if prof ? 'time_horizon_years' and not ('time_horizon_years' = any (s.profile_locked)) then
      s.time_horizon_years := (prof ->> 'time_horizon_years')::int;
    end if;
    if prof ? 'risk_tolerance' and not ('risk_tolerance' = any (s.profile_locked)) then
      s.risk_tolerance := prof ->> 'risk_tolerance';
    end if;
    foreach k in array array['age', 'annual_income', 'monthly_savings', 'net_worth_estimate', 'notes',
                             'monthly_income', 'income_sources', 'emergency_fund_months', 'debts_summary', 'existing_accounts'] loop
      if prof ? k and not (k = any (s.profile_locked)) then
        s.profile := s.profile || jsonb_build_object(k, prof -> k);
      end if;
    end loop;
  end if;

  if p_update ? 'summary' then
    if s.summary_edited then
      s.summary_proposal := left(p_update ->> 'summary', 1500);
    else
      s.summary := left(p_update ->> 'summary', 1500);
    end if;
  end if;

  new_goal := s.primary_goal;
  new_horizon := s.time_horizon_years;
  new_risk := s.risk_tolerance;

  -- structured rows need a usable profile: goal plus at least one of horizon or risk
  if (jsonb_array_length(coalesce(p_update -> 'items', '[]'::jsonb)) > 0 or jsonb_array_length(coalesce(p_update -> 'actions', '[]'::jsonb)) > 0)
     and (new_goal is null or (new_horizon is null and new_risk is null)) then
    raise exception 'profile incomplete' using errcode = '22023';
  end if;

  -- items
  ord := 0;
  for it in select * from jsonb_array_elements(coalesce(p_update -> 'items', '[]'::jsonb)) loop
    ord := ord + 1;
    ex_id := null;
    select id, source, edited_by_user, archived_at into ex_id, ex_source, ex_edited, ex_archived
      from public.strategy_items
     where user_id = uid and section = it ->> 'section' and ai_key = it ->> 'key';
    if ex_id is null then
      select count(*) into n from public.strategy_items where user_id = uid and section = it ->> 'section' and archived_at is null;
      if n >= 25 then
        raise exception 'section cap reached: %', it ->> 'section' using errcode = '54000';
      end if;
      insert into public.strategy_items (user_id, section, ai_key, title, body, metrics, impact, position, source)
      values (uid, it ->> 'section', it ->> 'key', it ->> 'title', coalesce(it ->> 'body', ''),
              coalesce(it -> 'metrics', '{}'::jsonb), (it ->> 'impact')::smallint, ord, 'ai');
      applied := applied + 1;
    elsif ex_archived is not null then
      skipped := skipped + 1;
    elsif ex_source = 'ai' and not ex_edited then
      update public.strategy_items
         set title = it ->> 'title', body = coalesce(it ->> 'body', ''), metrics = coalesce(it -> 'metrics', '{}'::jsonb),
             impact = (it ->> 'impact')::smallint, position = ord
       where id = ex_id and user_id = uid;
      applied := applied + 1;
    else
      update public.strategy_items
         set pending_ai_proposal = jsonb_build_object('title', it ->> 'title', 'body', coalesce(it ->> 'body', ''),
                                                      'metrics', coalesce(it -> 'metrics', '{}'::jsonb), 'impact', it -> 'impact')
       where id = ex_id and user_id = uid;
      proposed := proposed + 1;
    end if;
  end loop;

  -- actions
  for ac in select * from jsonb_array_elements(coalesce(p_update -> 'actions', '[]'::jsonb)) loop
    link_id := null;
    if ac ? 'item_key' then
      select id into link_id from public.strategy_items
       where user_id = uid and ai_key = ac ->> 'item_key' and archived_at is null
       order by created_at limit 1;
    end if;
    ex_id := null;
    select id, source, edited_by_user, archived_at into ex_id, ex_source, ex_edited, ex_archived
      from public.strategy_actions where user_id = uid and ai_key = ac ->> 'key';
    if ex_id is null then
      select count(*) into n from public.strategy_actions where user_id = uid and archived_at is null;
      if n >= 40 then
        raise exception 'action cap reached' using errcode = '54000';
      end if;
      insert into public.strategy_actions (user_id, ai_key, title, detail, priority, track, due_hint, linked_item_id, source)
      values (uid, ac ->> 'key', ac ->> 'title', coalesce(ac ->> 'detail', ''), (ac ->> 'priority')::smallint,
              coalesce(ac ->> 'track', 'general'), ac ->> 'due_hint', link_id, 'ai');
      applied := applied + 1;
    elsif ex_archived is not null then
      skipped := skipped + 1;
    elsif ex_source = 'ai' and not ex_edited then
      -- status and completed_at are user state and are never written here
      update public.strategy_actions
         set title = ac ->> 'title', detail = coalesce(ac ->> 'detail', ''), priority = (ac ->> 'priority')::smallint,
             track = coalesce(ac ->> 'track', 'general'), due_hint = ac ->> 'due_hint', linked_item_id = coalesce(link_id, linked_item_id)
       where id = ex_id and user_id = uid;
      applied := applied + 1;
    else
      update public.strategy_actions
         set pending_ai_proposal = jsonb_build_object('title', ac ->> 'title', 'detail', coalesce(ac ->> 'detail', ''),
                                                      'priority', ac -> 'priority', 'due_hint', ac -> 'due_hint',
                                                      'track', coalesce(ac ->> 'track', 'general'))
       where id = ex_id and user_id = uid;
      proposed := proposed + 1;
    end if;
  end loop;

  -- removals: only unedited AI rows; anything else is left alone
  for rk in select * from jsonb_array_elements(coalesce(p_update -> 'remove_keys', '[]'::jsonb)) loop
    if rk ->> 'kind' = 'item' then
      ex_id := null;
      select id, source, edited_by_user into ex_id, ex_source, ex_edited
        from public.strategy_items where user_id = uid and section = rk ->> 'section' and ai_key = rk ->> 'key';
      if ex_id is not null and ex_source = 'ai' and not ex_edited then
        delete from public.strategy_items where id = ex_id and user_id = uid;
        removed := removed + 1;
      else
        skipped := skipped + 1;
      end if;
    elsif rk ->> 'kind' = 'action' then
      ex_id := null;
      select id, source, edited_by_user into ex_id, ex_source, ex_edited
        from public.strategy_actions where user_id = uid and ai_key = rk ->> 'key';
      if ex_id is not null and ex_source = 'ai' and not ex_edited then
        delete from public.strategy_actions where id = ex_id and user_id = uid;
        removed := removed + 1;
      else
        skipped := skipped + 1;
      end if;
    end if;
  end loop;

  -- status is derived here, never written by the model
  update public.user_strategy
     set primary_goal = s.primary_goal, time_horizon_years = s.time_horizon_years, risk_tolerance = s.risk_tolerance,
         profile = s.profile, summary = s.summary, summary_proposal = s.summary_proposal,
         version = version + 1, last_ai_update_at = now(),
         status = case when s.primary_goal is not null and (s.time_horizon_years is not null or s.risk_tolerance is not null)
                       then 'active' else status end
   where user_id = uid
   returning version into n;

  perform set_config('strategy.ai_apply', '', true);
  return jsonb_build_object('version', n, 'applied', applied, 'proposed', proposed, 'skipped', skipped, 'removed', removed);
end;
$$;

-- User accepts or dismisses an AI proposal on an edited row. RLS limits it to the caller's rows.
create function public.resolve_strategy_proposal(p_kind text, p_id uuid, p_accept boolean) returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  uid uuid := auth.uid();
  prop jsonb;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  perform set_config('strategy.ai_apply', '1', true);

  if p_kind = 'item' then
    select pending_ai_proposal into prop from public.strategy_items where id = p_id and user_id = uid;
    if prop is null then
      perform set_config('strategy.ai_apply', '', true);
      return;
    end if;
    if p_accept then
      update public.strategy_items
         set title = prop ->> 'title', body = coalesce(prop ->> 'body', ''), metrics = coalesce(prop -> 'metrics', '{}'::jsonb),
             impact = (prop ->> 'impact')::smallint, edited_by_user = false, pending_ai_proposal = null
       where id = p_id and user_id = uid;
    else
      update public.strategy_items set pending_ai_proposal = null where id = p_id and user_id = uid;
    end if;
  elsif p_kind = 'action' then
    select pending_ai_proposal into prop from public.strategy_actions where id = p_id and user_id = uid;
    if prop is null then
      perform set_config('strategy.ai_apply', '', true);
      return;
    end if;
    if p_accept then
      update public.strategy_actions
         set title = prop ->> 'title', detail = coalesce(prop ->> 'detail', ''), priority = (prop ->> 'priority')::smallint,
             due_hint = prop ->> 'due_hint', track = coalesce(prop ->> 'track', 'general'),
             edited_by_user = false, pending_ai_proposal = null
       where id = p_id and user_id = uid;
    else
      update public.strategy_actions set pending_ai_proposal = null where id = p_id and user_id = uid;
    end if;
  elsif p_kind = 'summary' then
    if p_accept then
      update public.user_strategy set summary = summary_proposal, summary_edited = false, summary_proposal = null
       where id = p_id and user_id = uid and summary_proposal is not null;
    else
      update public.user_strategy set summary_proposal = null where id = p_id and user_id = uid;
    end if;
  else
    perform set_config('strategy.ai_apply', '', true);
    raise exception 'unknown kind' using errcode = '22023';
  end if;

  perform set_config('strategy.ai_apply', '', true);
end;
$$;

revoke execute on function public.coach_begin_turn(uuid, text) from public, anon;
revoke execute on function public.coach_save_reply(uuid, text) from public, anon;
revoke execute on function public.apply_strategy_update(jsonb) from public, anon;
revoke execute on function public.resolve_strategy_proposal(text, uuid, boolean) from public, anon;
revoke execute on function public.strategy_mark_edited() from public, anon;
grant execute on function public.coach_begin_turn(uuid, text) to authenticated;
grant execute on function public.coach_save_reply(uuid, text) to authenticated;
grant execute on function public.apply_strategy_update(jsonb) to authenticated;
grant execute on function public.resolve_strategy_proposal(text, uuid, boolean) to authenticated;
