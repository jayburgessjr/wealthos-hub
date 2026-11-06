# Desk: Architecture (draft for implementation)

Status: proposed. Scope: single-user internal trading desk, paper only in phase 0. Additive only; no existing table, policy, function or edge function is modified.

## 0. Context and two flags

Existing: `paper_trades` (WealthOS simulations, `user_id` + `auth.uid() = user_id`), edge fns on Deno, `POLYGON_KEY` secret, no `_shared/` dir.

Flag A (name collision): `journal`, `positions`, `signals` already exist in `public`. All Desk tables are therefore prefixed `desk_` (`desk_signals`, `desk_journal`, ...). Spec names map 1:1.

Flag B (backend sharing): this repo's Supabase project is WealthOS's. Desk is a different product handling broker credentials and order state. Policy says one Supabase project per product. Recommendation: provision a dedicated Desk project and point the Desk edge functions/UI client at it. Everything below is project-agnostic (own migration file, `desk_` namespace, no FK into WealthOS tables beyond `auth.users`). Until the owner decides, phase 0 ships on the WealthOS project with the same isolation (owner-only RLS). Creating a project is a billing/credential action: Hard Stop, owner decision. Not blocking for paper phase 0 on the current project.

## 1. Module / file layout

```
supabase/migrations/20261107000000_desk_core.sql        # tables, RLS, triggers, fns (additive)
supabase/functions/_shared/desk/                        # pure TS, explicit .ts imports, no Deno APIs
  types.ts            # Signal, Thesis, ProposedOrder, Structure, OptionLeg
  risk/limits.ts      # RISK_LIMITS constants (single source of truth)
  risk/options.ts     # defined-risk test, payoff, maxLoss
  risk/sizing.ts      # stop-distance sizing
  risk/engine.ts      # evaluateRisk(RiskInput): RiskDecision  (pure, no I/O, no Date.now)
  broker/port.ts      # BrokerReadPort, BrokerTradePort, BrokerPort
  broker/paper.ts     # PaperBroker (takes a PaperStore interface; DB impl injected by fn)
  broker/alpaca.ts    # AlpacaBroker (takes fetch + creds injected; no Deno.env inside)
  broker/factory.ts   # resolveMode(env) + makeBroker(mode, deps)
  scorecard.ts        # pure scorecard math
  hash.ts             # canonical JSON + sha256 hex via crypto.subtle (global in Deno and Node 20)
supabase/functions/desk-claim-owner/        desk-approve-order/   desk-reset-kill-switch/
supabase/functions/desk-account/            desk-run-agent/       desk-mark-positions/   desk-scorecard/
supabase/functions/_shared/desk-auth.ts     # JWT + is_desk_owner guard, cron-secret guard, CORS
src/lib/desk/*.test.ts                      # Vitest imports ../../../supabase/functions/_shared/desk/*.ts
src/pages/desk/*  src/components/desk/*     # terminal UI at /desk (React Query, owner-gated route)
```

Import boundary (enforced by a Vitest test that greps the tree): `_shared/desk/broker/*` may be imported only by `desk-approve-order`, `desk-account` (read port), `desk-mark-positions` (read port). `desk-run-agent` and every agent module import neither. Vitest config `include` is `src/**`; tests live in `src/lib/desk/` and import across the boundary (needs no config change; verify `tsconfig.app.json` allows it, else add path include).

## 2. Data model (draft DDL)

All tables: `alter table ... enable row level security; ... force row level security;`. All keys uuid, `gen_random_uuid()`. Timestamps `timestamptz default now()`.

```sql
-- ---------- ownership + state ----------
create table public.desk_owner (
  id boolean primary key default true check (id),            -- single-row enforcement
  user_id uuid not null unique references auth.users(id) on delete restrict,
  claimed_at timestamptz not null default now()
);

create table public.desk_state (
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
create table public.desk_instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,                                      -- equity/ETF ticker or OCC symbol for options
  asset_class text not null check (asset_class in ('equity','etf','index','option')),
  name text, exchange text,
  underlying_id uuid references public.desk_instruments(id),
  option_right text check (option_right in ('call','put')),
  strike numeric(18,4), expiry date, multiplier int not null default 1 check (multiplier > 0),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (symbol),
  check ((asset_class = 'option') = (underlying_id is not null and option_right is not null
         and strike is not null and expiry is not null))
);

create table public.desk_agent_runs (
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

create table public.desk_signals (
  id uuid primary key default gen_random_uuid(),
  instrument_id uuid not null references public.desk_instruments(id),
  agent_name text not null, agent_run_id uuid references public.desk_agent_runs(id),
  kind text not null,                                        -- 'momentum','earnings','flow','news',...
  direction text not null check (direction in ('long','short','neutral')),
  strength numeric(4,3) not null check (strength between 0 and 1),
  summary text not null,
  source_links jsonb not null default '[]' check (jsonb_typeof(source_links) = 'array'), -- [{url,title,published_at}]
  raw jsonb, expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.desk_signals (instrument_id, created_at desc);
create index on public.desk_signals (agent_name, created_at desc);

create table public.desk_theses (
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
create table public.desk_proposed_orders (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid references public.desk_theses(id),
  instrument_id uuid not null references public.desk_instruments(id),   -- underlying for option structures
  agent_name text not null, agent_run_id uuid references public.desk_agent_runs(id),
  intent text not null default 'open' check (intent in ('open','close')),
  position_id uuid,                                                      -- required when intent='close' (FK added after positions)
  structure text not null default 'stock' check (structure in
    ('stock','long_call','long_put','debit_spread','credit_spread','iron_condor','iron_butterfly')),
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
  check (structure = 'stock' or legs is not null),
  check (intent <> 'close' or position_id is not null)
);
create index on public.desk_proposed_orders (status, created_at desc);

create table public.desk_approvals (
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

create table public.desk_orders (
  id uuid primary key default gen_random_uuid(),
  approval_id uuid not null unique references public.desk_approvals(id),  -- one order per approval
  proposed_order_id uuid not null references public.desk_proposed_orders(id),
  instrument_id uuid not null references public.desk_instruments(id),
  mode text not null check (mode in ('paper','live')),
  broker text not null check (broker in ('paper','alpaca','ibkr')),
  client_order_id text not null unique,   -- = approval_id::text; broker-side dedupe
  broker_order_id text,
  intent text not null, structure text not null,
  side text not null, qty numeric(18,4) not null check (qty > 0),
  order_type text not null, limit_price numeric(18,4),
  legs jsonb,
  stop_price numeric(18,4) not null,                                       -- MANDATORY (closes inherit the position stop)
  target_price numeric(18,4),
  status text not null default 'submitting' check (status in
    ('submitting','submitted','partially_filled','filled','canceled','rejected','failed')),
  filled_qty numeric(18,4) not null default 0, avg_fill_price numeric(18,4),
  error text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.desk_positions (
  id uuid primary key default gen_random_uuid(),
  position_group uuid not null default gen_random_uuid(),   -- a spread/condor = ONE group = ONE "options position"
  instrument_id uuid not null references public.desk_instruments(id),  -- underlying
  thesis_id uuid references public.desk_theses(id), agent_name text,
  mode text not null check (mode in ('paper','live')),
  structure text not null, legs jsonb, qty numeric(18,4) not null check (qty > 0),
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

create table public.desk_journal (
  id uuid primary key default gen_random_uuid(),
  author text not null,                                     -- 'owner' or agent name
  entry_type text not null check (entry_type in ('note','entry','exit','review','postmortem')),
  thesis_id uuid references public.desk_theses(id), position_id uuid references public.desk_positions(id),
  order_id uuid references public.desk_orders(id),
  body text not null, tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table public.desk_scorecard (
  id uuid primary key default gen_random_uuid(),
  thesis_id uuid not null references public.desk_theses(id) on delete cascade,
  agent_name text not null,
  horizon_days int not null check (horizon_days in (1,5,20)),   -- trading days
  t0_date date not null, t0_price numeric(18,4) not null,
  tn_date date not null, tn_price numeric(18,4) not null,
  return_pct numeric(9,4) not null,                             -- direction-signed
  benchmark_symbol text not null default 'SPY',
  benchmark_return_pct numeric(9,4) not null,                   -- direction-signed
  alpha_pct numeric(9,4) not null,                              -- return_pct - benchmark_return_pct
  target_hit boolean not null, stop_hit boolean not null, first_touch text check (first_touch in ('target','stop','none')),
  computed_at timestamptz not null default now(),
  unique (thesis_id, horizon_days)
);
create index on public.desk_scorecard (agent_name, horizon_days);

create table public.desk_risk_events (                       -- append-only
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in ('check_passed','check_failed','kill_switch_tripped',
    'kill_switch_reset','daily_limit_hit','owner_claimed','trigger_block','mode_resolved')),
  proposed_order_id uuid references public.desk_proposed_orders(id),
  actor text not null,                                      -- 'owner' | 'system:<fn>'
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.desk_risk_events (created_at desc);
```

### 2.1 Ownership + RLS

```sql
create function public.is_desk_owner() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.desk_owner where user_id = (select auth.uid()));
$$;
revoke all on function public.is_desk_owner() from public, anon;
grant execute on function public.is_desk_owner() to authenticated;
```

Claim: `desk-claim-owner` (user JWT) loads the user via `auth.getUser(jwt)`, requires `email_confirmed_at` and `lower(email) = lower(DESK_OWNER_EMAIL)`, then service-role `insert into desk_owner ... on conflict do nothing`. Idempotent; a second claimant with a different uid is rejected by the single-row PK. Logs `owner_claimed`. The email lives only in the edge secret (no PII in repo). After claim the secret is no longer consulted for authorization (only for re-claim attempts that fail). Until claimed, `is_desk_owner()` is false for everyone: default deny.

Policies (`to authenticated`, all wrap `(select public.is_desk_owner())`):

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| desk_owner, desk_state, desk_orders, desk_positions, desk_scorecard, desk_risk_events, desk_agent_runs, desk_signals, desk_theses, desk_instruments | owner | none | none | none |
| desk_proposed_orders | owner | none | owner, only `status` pending->rejected (trigger-enforced) | none |
| desk_approvals | owner | owner, `decided_by = auth.uid()` (the approve fn uses a user-scoped client) | none (immutable; trigger raises) | none |
| desk_journal | owner | owner, `author='owner'` | owner own rows | none |

No policy exists for `anon`; `revoke all on all desk_* from anon, authenticated` then grant only the minimum (`select`, plus the writes above). Service role bypasses RLS, so the guarantees that matter are triggers (2.2), not policies.

### 2.2 Order-requires-approval trigger (DB-level, applies to service role too)

```sql
-- approvals may only be written by the owner's own JWT (service role has auth.uid() = null)
create function public.desk_approvals_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare po public.desk_proposed_orders; st public.desk_state;
begin
  if tg_op <> 'INSERT' then raise exception 'desk_approvals is immutable'; end if;
  if (select auth.uid()) is null or not public.is_desk_owner() or new.decided_by <> (select auth.uid()) then
    raise exception 'approvals require the owner session'; end if;
  select * into po from public.desk_proposed_orders where id = new.proposed_order_id for update;
  if po.status <> 'pending' or po.expires_at < now() then raise exception 'proposal not pending'; end if;
  select * into st from public.desk_state;
  if new.decision = 'approved' and new.risk_passed and st.halted and po.intent = 'open' then
    raise exception 'kill switch engaged'; end if;
  update public.desk_proposed_orders set status = case when new.decision='approved' and new.risk_passed
    then 'approved' else 'rejected' end where id = po.id;   -- status change by definer fn, not RLS
  return new;
end $$;
create trigger trg_desk_approvals_guard before insert or update or delete on public.desk_approvals
  for each row execute function public.desk_approvals_guard();

create function public.desk_orders_guard() returns trigger language plpgsql security definer set search_path = '' as $$
declare a public.desk_approvals; po public.desk_proposed_orders; st public.desk_state;
begin
  if tg_op = 'DELETE' then raise exception 'orders are never deleted'; end if;
  if tg_op = 'UPDATE' then   -- immutable economics; only status/fill/broker fields may change
    if (new.approval_id, new.proposed_order_id, new.side, new.qty, new.stop_price, new.mode, new.client_order_id)
       is distinct from (old.approval_id, old.proposed_order_id, old.side, old.qty, old.stop_price, old.mode, old.client_order_id)
    then raise exception 'order economics immutable'; end if;
    new.updated_at := now(); return new;
  end if;
  select * into a from public.desk_approvals where id = new.approval_id for update;
  if not found or a.decision <> 'approved' or a.risk_passed is not true
     or a.proposed_order_id <> new.proposed_order_id or a.consumed_at is not null
     or a.decided_at < now() - interval '5 minutes' or a.mode <> new.mode
     or (new.mode = 'live' and not a.live_confirmed) then
    insert into public.desk_risk_events(event_type, proposed_order_id, actor, details)
      values ('trigger_block', new.proposed_order_id, 'system:db', jsonb_build_object('approval_id', new.approval_id));
    raise exception 'order rejected: no valid approval';
  end if;
  select * into po from public.desk_proposed_orders where id = new.proposed_order_id;
  if (po.side, po.qty, po.stop_price, po.structure, po.instrument_id, po.intent, po.legs)
     is distinct from (new.side, new.qty, new.stop_price, new.structure, new.instrument_id, new.intent, new.legs)
     or new.stop_price is null then raise exception 'order does not match approved proposal'; end if;
  select * into st from public.desk_state;
  if st.halted and new.intent = 'open' then raise exception 'kill switch engaged'; end if;
  update public.desk_approvals set consumed_at = now() where id = a.id;   -- one-shot (via definer)
  return new;
end $$;
create trigger trg_desk_orders_guard before insert or update or delete on public.desk_orders
  for each row execute function public.desk_orders_guard();
```
(The `consumed_at` update bypasses the immutability trigger by using a dedicated `desk.internal` GUC check; implementation detail for the builder, to be covered by a test.)

Kill-switch store protection:
```sql
create function public.desk_state_guard() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.halted and not new.halted and coalesce(current_setting('desk.reset', true),'') <> '1' then
    raise exception 'kill switch can only be reset by desk_reset_kill_switch()'; end if;
  if new.high_water_mark < old.high_water_mark and coalesce(current_setting('desk.reset', true),'') <> '1' then
    raise exception 'high-water mark cannot decrease'; end if;
  new.updated_at := now(); return new;
end $$;
create function public.desk_reset_kill_switch(p_note text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_desk_owner() then raise exception 'owner only'; end if;
  perform set_config('desk.reset','1', true);
  update public.desk_state set halted=false, halted_reason=null, reset_at=now(), reset_by=(select auth.uid()),
         high_water_mark = last_equity;              -- rebase: avoid instant re-trip
  insert into public.desk_risk_events(event_type, actor, details)
    values ('kill_switch_reset','owner', jsonb_build_object('note', p_note, 'rebased_hwm', (select last_equity from public.desk_state)));
end $$;
revoke all on function public.desk_reset_kill_switch(text) from public, anon; grant execute to authenticated;
```
`desk_risk_events` and `desk_approvals` have update/delete-raising triggers. Trip is by service role (`update desk_state set halted=true`), always allowed.

Migration is additive only. No destructive statements. No Hard Stop in the migration itself.

## 3. Contracts (pure TS, `_shared/desk/`)

```ts
// types.ts
export type Direction = 'long' | 'short';
export type Structure = 'stock' | 'long_call' | 'long_put' | 'debit_spread' | 'credit_spread' | 'iron_condor' | 'iron_butterfly';
export interface OptionLeg { right: 'call' | 'put'; action: 'buy' | 'sell'; strike: number; expiry: string; ratio: number; price: number } // price = premium/share
export interface Signal { id?: string; instrumentId: string; agentName: string; kind: string; direction: Direction | 'neutral';
  strength: number; summary: string; sourceLinks: { url: string; title?: string; publishedAt?: string }[]; raw?: unknown; expiresAt?: string }
export interface Thesis { id?: string; instrumentId: string; agentName: string; signalIds: string[]; direction: Direction;
  bullCase: string; bearCase: string; catalysts: { event: string; date?: string }[]; entryPrice: number; stopPrice: number;
  targetPrice: number; sizeRiskPct?: number; sizeQty?: number; confidence: number; invalidation: string; horizonDays: number }
export interface ProposedOrder { id?: string; thesisId?: string; instrumentId: string; symbol: string; agentName: string;
  intent: 'open' | 'close'; positionId?: string; structure: Structure; side: 'buy' | 'sell'; qty: number;
  orderType: 'market' | 'limit'; limitPrice?: number; legs?: OptionLeg[]; stopPrice: number;
  stopBasis: 'price' | 'underlying' | 'premium'; targetPrice?: number }

// risk/engine.ts
export interface OpenPositionSnapshot { positionGroup: string; symbol: string; underlying: string; structure: Structure; exposure: number; maxLoss: number }
export interface RiskInput {
  order: ProposedOrder;
  refPrice: number;                  // server-fetched quote of the traded instrument (stock price or option net premium/share); never client supplied
  equity: number;                    // broker.getAccount().equity at approval time
  dayStartEquity: number;            // desk_state.day_start_equity
  highWaterMark: number;             // desk_state.high_water_mark
  halted: boolean;                   // desk_state.halted
  openPositions: OpenPositionSnapshot[];
  slippageBps?: number;              // default 10
  limits?: Partial<typeof RISK_LIMITS>;   // tests only; production passes undefined
}
export interface RiskCheck { rule: string; passed: boolean; value: number | string; limit: number | string; message: string }
export interface RiskDecision {
  approved: boolean; reasons: string[]; checks: RiskCheck[];
  sized: { maxQty: number; riskAmount: number; exposure: number; maxLoss: number };  // for the order as proposed
  effects: { tripKillSwitch: boolean; newHighWaterMark: number; dailyLimitHit: boolean };
  engineVersion: string;
}
export declare function evaluateRisk(input: RiskInput): RiskDecision;   // pure, deterministic, throws never (invalid input => approved:false)

// broker/port.ts
export interface BrokerAccount { equity: number; cash: number; buyingPower: number; asOf: string }
export interface BrokerPosition { symbol: string; qty: number; avgPrice: number; marketValue: number }
export interface BrokerFill { brokerOrderId: string; status: 'submitted'|'partially_filled'|'filled'|'rejected'|'canceled';
  filledQty: number; avgFillPrice?: number; raw?: unknown }
export interface BrokerReadPort { readonly name: 'paper'|'alpaca'|'ibkr'; readonly mode: 'paper'|'live';
  getAccount(): Promise<BrokerAccount>; getPositions(): Promise<BrokerPosition[]>; getOrder(clientOrderId: string): Promise<BrokerFill | null> }
export interface BrokerTradePort { submitOrder(o: { clientOrderId: string; order: ProposedOrder; symbol: string }): Promise<BrokerFill>;
  cancelOrder(clientOrderId: string): Promise<void> }
export interface BrokerPort extends BrokerReadPort, BrokerTradePort {}
```
`submitOrder` is idempotent on `clientOrderId` (Alpaca dedupes natively, 422 duplicate -> `getOrder`; PaperBroker unique key). `resolveMode(env)`: returns `'live'` only if `TRADING_MODE==='live' && LIVE_TRADING_ENABLED==='true'`; any other value (unset, typo, partial) returns `'paper'`. AlpacaBroker picks `paper-api.alpaca.markets` for paper and `api.alpaca.markets` for live from the resolved mode, never from input. Stock orders submit as Alpaca bracket (`order_class: bracket`, stop_loss + take_profit). Options: multi-leg (`order_class: mleg`); Alpaca does not attach stops to option orders, so option stops are monitored by `desk-mark-positions`, which creates a proposed close order (still human-approved).

### 3.1 Limits (limits.ts, constants)
```
MAX_RISK_PER_TRADE=0.015, MAX_POSITION_PCT=0.25, MAX_OPEN_OPTIONS_POSITIONS=3,
DAILY_LOSS_LIMIT=0.03, DRAWDOWN_KILL=0.10, DEFAULT_SLIPPAGE_BPS=10, OPTION_MULTIPLIER=100
```

### 3.2 Inputs to the formulas
- `equity` = broker account equity (cash + marked positions, realized and unrealized) fetched server-side in `desk-approve-order` at decision time. Never from the client.
- `dayStartEquity` = `desk_state.day_start_equity`, rolled by `desk-mark-positions` at the first mark of each America/New_York trading date (= prior-session close equity).
- `dayPnl = equity - dayStartEquity`; `dayPnlPct = dayPnl / dayStartEquity`.
- `highWaterMark` = `max(prior HWM, equity)`, persisted on every mark and every approval evaluation (`effects.newHighWaterMark`). Never decreases except in `desk_reset_kill_switch` (rebased to `last_equity`).
- `drawdown = (HWM - equity) / HWM`. If `HWM <= 0` or `equity <= 0` -> reject (fail closed).

### 3.3 Rules (all evaluated; all must pass for `intent='open'`)
1. `kill_switch`: reject if `halted`. Also reject (and `tripKillSwitch=true`) if `drawdown >= 0.10`. Caller persists `halted=true`, logs `kill_switch_tripped`.
2. `daily_loss`: reject if `dayPnlPct <= -0.03`; and reject if projected `(dayPnl - maxLoss) / dayStartEquity < -0.03` (a trade that could breach the limit is blocked). On breach `dailyLimitHit=true`, logged. Not a latch; clears next trading date.
3. `mandatory_stop`: `stopPrice` finite, > 0, on the loss side of entry. Long stock/long premium: `stop < entryRef`; short: `stop > entryRef`. Missing/zero/wrong side -> reject.
4. Stock sizing (long only in phase 0; short selling rejected):
   `entry = limit ? max(limit, refPrice) : refPrice; effEntry = entry * (1 + bps/10000)`
   `riskPerShare = effEntry - stop; riskBudget = 0.015 * equity`
   `maxQtyRisk = floor(riskBudget / riskPerShare); maxQtyPos = floor(0.25 * equity / effEntry)`
   `maxQty = min(maxQtyRisk, maxQtyPos)`; reject if `qty > maxQty` or `maxQty < 1`. `riskAmount = qty * riskPerShare`.
5. Options defined-risk definition. Allowed structures: long_call, long_put, debit_spread, credit_spread, iron_condor, iron_butterfly. A leg set is defined-risk iff: all legs share one expiry and underlying; ratios are positive integers; `sum(ratio of long calls) >= sum(ratio of short calls)` and `sum(long puts) >= sum(short puts)`; and no leg is a naked short. Naked short calls/puts, cash-secured puts, short straddles/strangles, ratio writes and calendars are rejected in phase 0.
   Payoff per share at expiry: `P(S) = sum_i sign_i * ratio_i * (intrinsic_i(S) - price_i)`, sign +1 buy / -1 sell, intrinsic call `max(S-K,0)`, put `max(K-S,0)`. `P` is piecewise linear; evaluate at `S in {0} U strikes U {2*maxStrike}`. `maxLossPerContract = max(0, -min P(S)) * 100`. `maxLoss = maxLossPerContract * contracts`. `riskAmount = maxLoss` (full premium for long options, i.e. entire premium is at risk even if a stop exists, because gaps/illiquidity can defeat premium stops). `maxContracts = floor(0.015*equity / maxLossPerContract)`; reject if `contracts > maxContracts` or `maxLoss > riskBudget`.
6. `position_cap`: `exposure = stock ? qty*effEntry : maxLoss` (options exposure = capital at risk). Aggregate by underlying: `sum(openPositions.exposure for same underlying) + exposure <= 0.25 * equity`.
7. `options_count`: count distinct `positionGroup` of open option structures; reject new option open if `count >= 3`. A spread/condor is one position. Adding to an existing group (same `positionGroup`) does not increase the count.
8. `intent='close'`: kill switch, daily-loss and sizing are skipped (exits must never be blocked); still requires: `positionId` matches an open position, `qty <= open qty`, stop present (inherited from the position). Order direction must be opposite to the position (checked by caller, asserted by the DB trigger economics match).
Every check is returned in `checks[]`; `approved = all passed`. Engine has no clock, randomness or I/O; the caller passes everything. Invalid or NaN input -> `approved:false` with reason `invalid_input`.

## 4. Edge functions and auth

| Function | Caller | Auth | Does |
|---|---|---|---|
| desk-claim-owner | UI once | user JWT + email == `DESK_OWNER_EMAIL` | Inserts `desk_owner` (service role) |
| desk-approve-order | UI | user JWT + `is_desk_owner()` rpc; `verify_jwt=true` | Loads proposal, builds RiskInput from DB+broker, `evaluateRisk`, writes `desk_approvals` with the owner-scoped client, then (approved+passed) inserts `desk_orders` (service role; trigger gates), calls broker, updates order/positions/events. Accepts `{proposed_order_id, decision, live_confirmation?}` only; never qty/price/company ids from client |
| desk-reset-kill-switch | UI | user JWT + owner | Calls `desk_reset_kill_switch(note)` with user client |
| desk-account | UI | user JWT + owner | Read port: account, positions, quotes for terminal panels |
| desk-run-agent | cron / owner manual | `x-cron-secret: DESK_CRON_SECRET` (service role inside) or owner JWT | Runs one named agent (scanner or thesis/research). Writes `desk_agent_runs`, `desk_signals`, `desk_theses`, `desk_proposed_orders` (status pending). No broker import |
| desk-mark-positions | cron | cron secret | Read port only: marks positions, snapshots `last_equity`, rolls `day_start_equity`, updates HWM, trips kill switch, proposes stop-exit close orders for options |
| desk-scorecard | cron (after close) | cron secret | Section 5 |

Cron-secret functions set `verify_jwt=false` in `supabase/config.toml` and compare the header in constant time; the secret name `DESK_CRON_SECRET` is added to the names list. UI functions use `verify_jwt=true` plus an in-code owner check; `Access-Control-Allow-Origin` restricted to the app origin for Desk functions (not `*`). Secrets (names only): `POLYGON_KEY` (exists), `ANTHROPIC_API_KEY`, `ALPACA_KEY_ID`, `ALPACA_SECRET`, `TRADING_MODE`, `LIVE_TRADING_ENABLED`, `DESK_OWNER_EMAIL`, `DESK_CRON_SECRET`. No new secret values are created by this build.

Failure handling (EP 6):
- Broker call: timeout 10s via `AbortController`; retry only the idempotent path (`getOrder(clientOrderId)` / re-`submitOrder` with the same `client_order_id`), 3 attempts, backoff 0.5s/1.5s/4s with jitter. 4xx other than 422-duplicate/429 never retried.
- Order row is inserted BEFORE the broker call with `status='submitting'` (trigger consumes the approval). A crash leaves a `submitting` row; reconciliation in `desk-mark-positions` calls `getOrder(client_order_id)` and settles it. Double-click or retry cannot create a second order (`approval_id` and `client_order_id` unique; `consumed_at`).
- Approval has a 5 minute validity (trigger) and proposal expiry (default 24h).
- Agents: idempotent per `(agent_name, idempotency_key)`; Anthropic/Polygon calls use timeout 30s, 2 retries on 429/5xx with backoff; run recorded `error` on failure, partial outputs kept.
- Fail closed: any missing equity/quote/state -> reject, never approve.

## 5. Scorecard computation

Runs daily after the US close (`desk-scorecard`), idempotent, immutable once written (`unique(thesis_id, horizon_days)`, upsert `do nothing`).
- Subject: each `desk_theses` row (agent attribution via `agent_name`). Options theses are scored on the underlying's direction in phase 0.
- `t0` = first trading day on or after `created_at` (America/New_York); `t0_price` = that day's adjusted close from Polygon daily aggs (`adjusted=true`). Rationale: score the idea, not whether the owner traded it. Realized P&L lives in `desk_positions`.
- For `h in {1,5,20}`: `tn` = the h-th trading day after `t0`. Write a row only when `tn <= last completed session`; otherwise skip and retry next run. `tn_price` = adjusted close at `tn`.
- `raw = tn_price / t0_price - 1`; `return_pct = (direction=='long' ? 1 : -1) * raw * 100`.
- Benchmark: `spy_raw = SPY_tn / SPY_t0 - 1` over the same dates; `benchmark_return_pct = sign * spy_raw * 100` (same sign convention, i.e. short theses are compared against being short SPY).
- `alpha_pct = return_pct - benchmark_return_pct`.
- Path flags over daily highs/lows in `(t0, tn]`: long: `target_hit = max(high) >= target`, `stop_hit = min(low) <= stop`; short mirrored. `first_touch`: earliest session touching either; if both on the same day, `stop` (conservative).
- Roll-up view `desk_scorecard_by_agent` (read-only, `security_invoker=true`): per `agent_name, horizon_days`: n, hit rate (`return_pct > 0`), mean/median alpha, mean return. Pure math lives in `_shared/desk/scorecard.ts` so Vitest covers it with fixture bars.

## 6. ADRs

**ADR-1 Owner identity via single-row `desk_owner` + claim fn.** Upside: no uid or email in repo, immutable after claim, RLS is one cheap predicate. Downside: first-claim race for the allowed email only; needs `DESK_OWNER_EMAIL` set once. Alternatives: hard-coded uid (PII/ops coupling, rejected); `user_id` per row (this is multi-user, rejected); app_metadata role claim (editable by service role/agents, weaker, rejected). Best when: exactly one human.

**ADR-2 Approval gate enforced in Postgres, approvals require the owner's session.** Because agents run with service role (RLS bypass), RLS cannot stop them; triggers can. Approvals are only insertable when `auth.uid()` is the owner (service role has null uid), orders require a matching one-shot approval, so an agent cannot forge an approval and cannot insert an order. Residual: code in `desk-approve-order` is trusted to compute `risk_passed` honestly; mitigated by `risk_input_hash`, the stored full `risk_decision`, tests, and the import-boundary test. Alternatives: app-layer check only (insufficient); separate Postgres role for agents (not available to edge functions on Supabase).

**ADR-3 BrokerPort split into Read and Trade ports; Trade is imported by one function.** Agents and the marker cannot even type-reference `submitOrder`. IBKR is a third adapter implementing `BrokerPort`; no caller changes.

**ADR-4 Risk engine is pure shared TS with constants in one file.** Upside: deterministic, unit-testable from Vitest, same code in UI preview (`risk_preview`) and in the authoritative server run. Downside: UI preview is advisory only; the server recomputes with server-side equity and quote. Alternative: SQL/PL-pgSQL engine (hard to test, duplicated).

**ADR-5 Kill switch is persisted state with guarded reset.** Latch in `desk_state`, tripped by service role, cleared only by `desk_reset_kill_switch` (owner JWT, GUC-gated trigger, logged). Reset rebases HWM to current equity so it does not re-trip immediately; this is a deliberate choice (alternative: keep HWM, forcing a manual HWM edit, rejected as unsafe-by-friction). Halts new opens only; closes always permitted.

**ADR-6 Mode resolution.** `live` requires `TRADING_MODE=live` AND `LIVE_TRADING_ENABLED=true`; otherwise paper, silently safe. A live approval additionally carries a typed `live_confirmation` (`LIVE <SYMBOL> <SIDE> <QTY>`), checked by the function and persisted (`live_confirmed`), required by the DB check and orders trigger. Phase 0 ships with `LIVE_TRADING_ENABLED` unset and the Alpaca live base URL unreachable by construction.

**ADR-7 Options: defined-risk by payoff test, exposure = max loss, spread = one position.** Conservative on sizing, simple to explain and verify with property tests; naked/CSP/calendars deferred. Alternative: margin-based sizing from the broker (opaque, broker-dependent).

**ADR-8 `desk_` namespace on the existing project for phase 0; separate project recommended.** See Flag B.

## 7. Threat notes

| Attacker / failure | What stops it |
|---|---|
| Agent (service role) inserts an order | `desk_orders_guard` requires a matching one-shot owner approval; none exists |
| Agent forges an approval row | `desk_approvals_guard` requires `auth.uid()` = owner; service role has null uid; table immutable |
| Agent edits an approved proposal after approval | Order economics must equal the proposal at insert; proposal status leaves `pending` on decision; approval valid 5 min and one-shot |
| Agent calls broker directly | Broker adapters imported only by 3 functions (grep test); keys exist only as edge secrets; agent functions have no broker code path |
| Prompt-injected agent proposes no-stop / oversized order | `stop_price not null` check, risk engine recheck with server equity and quote at approval, owner still must click |
| Non-owner authenticated WealthOS user | RLS default deny on every `desk_*` table; every UI function checks `is_desk_owner()`; claim needs matching confirmed email |
| Non-owner claims ownership | Email must equal `DESK_OWNER_EMAIL` and be confirmed; single-row PK blocks a second claim |
| Client tampers qty/price/mode/company id | Approve endpoint takes only proposal id + decision + confirmation; everything else is read server-side; no client `company_id`/`user_id` trusted |
| Accidental live trading | Two env flags plus typed confirmation plus DB check; default paper |
| Kill switch bypass or silent reset | Guard trigger; reset logged; HWM non-decreasing otherwise |
| Double submit / retry | Unique `approval_id`, `client_order_id`, `consumed_at`; broker-side dedupe |
| Replay of an old approval | 5 minute window and one-shot consumption |
| Compromised owner session | Out of scope for DB; mitigations: live disabled, per-trade confirmation, caps; recommend dedicated Desk project and MFA |
| Service-role key leak | Total compromise of DB-level protections is possible with direct SQL; mitigated by keeping broker keys only as edge secrets and live disabled; rotate on suspicion (Hard Stop action for owner) |

## 8. Blast radius and what must not change

- Untouched: all existing tables/policies/functions, `paper_trades`, WealthOS auth, `generate-signals`, `get-price-data` (Desk reads Polygon via its own server-side helper).
- Contracts that must not change without an ADR: the orders/approvals triggers, `BrokerReadPort`/`BrokerTradePort` split, `RISK_LIMITS` single source, `evaluateRisk` purity.
- If requirements change: new broker (IBKR) touches only `broker/`; new structure touches `risk/options.ts` + `structure` check constraint; new agent touches `desk-run-agent` registry only; UI is isolated under `src/pages/desk`.

## 9. Test plan hooks (for the builder)
Unit per rule incl. boundary values (1.5%, 25%, 3 options, 3% day, 10% DD exact); property test that any allowed options structure has finite `maxLoss` and naked shorts are rejected; trigger tests with a service-role client proving order insert fails without approval and approval insert fails without owner JWT; kill-switch reset only via the rpc; import-boundary grep test; scorecard fixture test; paper broker idempotency test.
