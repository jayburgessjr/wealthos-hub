# Desk runbook

Internal trading desk at `/desk` for up to two owners (emails on the `DESK_OWNER_EMAIL` allowlist). Phase 0 is paper only. Every trade needs the owner's click. Design: [ARCHITECTURE.md](ARCHITECTURE.md).

## What stops a bad trade

| Layer | Rule |
|---|---|
| Agents | Receive an `AgentRepo` facade: no order, approval or position methods. No broker import (static test). |
| Database | `desk_orders` insert needs a matching, unconsumed approval under 5 minutes old. `desk_approvals` insert needs the owner's session (service role has no `auth.uid()`). Stop price is `NOT NULL` and `> 0` on proposals and orders. Kill switch clears only through `desk_reset_kill_switch()`. |
| Risk engine | 1.5% risk per trade, 25% per position, 3 options positions, defined-risk options only, mandatory stop, 3% daily loss (also projected), 10% drawdown kill switch. Recomputed on the server at approval from broker equity and a server quote. |
| Mode | Live only if `TRADING_MODE=live` AND `LIVE_TRADING_ENABLED=true`, plus a typed phrase `LIVE <SYMBOL> <SIDE> <QTY>` per order. Anything else resolves to paper. |

## Secrets (edge function secrets only; names only here)

Existing: `OPENAI_API_KEY` (research agent; this is the key the code reads), `POLYGON_KEY`, `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

New: `DESK_OWNER_EMAIL` (comma-separated allowlist, at most two owners; re-checked on EVERY owner call, so removing an email stops that account's desk functions at once; an empty value locks everyone out; callers only see a generic "not eligible" answer, the specific cause is in the function logs), `DESK_CRON_SECRET`. Optional: `ALPACA_EXECUTION_ENABLED` (leave unset; see Alpaca below), `DESK_MODEL` (default `gpt-4o`), `PAPER_STARTING_EQUITY` (default 100000), `PAPER_VENUE=alpaca` (route paper orders to Alpaca's paper endpoint), `ALPACA_KEY_ID`, `ALPACA_SECRET`, `SEC_USER_AGENT`, `TRADING_MODE` (leave unset), `LIVE_TRADING_ENABLED` (leave unset).

## First-time setup

1. Apply, in order: `20261107000000_desk_core.sql`, `20261108000000_desk_multi_owner.sql`, `20261110000000_desk_hardening.sql` (approval risk marker, kill-switch reset rules, journal author columns, new risk event types).
2. Set the secrets above. Deploy the eight functions: `desk-claim-owner`, `desk-approve-order`, `desk-reset-kill-switch`, `desk-account`, `desk-run-agent`, `desk-mark-positions`, `desk-scorecard`, `desk-reconcile-orders`. Deploy the functions only after the hardening migration is applied (the approve function writes the new `check_passed` marker fields and event types the migration allows).
3. Sign in to the app as the owner (email must equal `DESK_OWNER_EMAIL` and be confirmed), open `/desk`, press "Claim desk". Until then nobody can read any desk table.
4. Mark watchlist symbols (`desk_instruments.on_watchlist`). With none set, scanners use a default list of 16 liquid names.
5. Schedule the jobs (below).

## Schedule (pg_cron + pg_net; run once in the SQL editor)

Store the cron secret in Vault first (`select vault.create_secret('<value of DESK_CRON_SECRET>', 'desk_cron_secret');`), then:

```sql
-- weekdays, UTC. 21:30 is after the US close in both daylight and standard time.
select cron.schedule('desk-scan-gaps',     '30 21 * * 1-5', $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-run-agent', '{"agent":"scan-gaps-drawdowns"}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
select cron.schedule('desk-reconcile',     '*/10 * * * *',  $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-reconcile-orders', '{}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
-- repeat for: scan-ipos, scan-sec-filings, scan-sector-momentum, scan-crypto-volatility, scan-commodity-trends (stagger by a minute)
select cron.schedule('desk-research',      '45 21 * * 1-5', $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-run-agent', '{"agent":"research-new"}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
select cron.schedule('desk-mark',          '0 22 * * 1-5',  $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-mark-positions', '{}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
select cron.schedule('desk-scorecard',     '15 22 * * 1-5', $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-scorecard', '{}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
```

## Phase 0 limits (known, deliberate)

- Long only for stocks, ETFs and crypto. Short theses are recorded and scored but no order is proposed.
- Agents propose stock, ETF and crypto orders only. The risk engine and brokers accept defined-risk options; Alpaca supports single-leg long options, multi-leg is refused.
- Quotes are the latest daily close (Polygon) and carry their bar date. Opening orders are refused when the bar is older than 4 calendar days (2 for crypto), undated, or in the future; closes pass with a warning. Real-time quotes are required before live trading is ever enabled.
- Neutral ("watch") signals are listed but not scored; they make no directional claim.
- Alpaca cannot attach a stop to crypto or option entries, so the stop goes as a second order; if that is refused the function reports it and the position must be closed manually.
- The desk shares the WealthOS Supabase project. A dedicated project is recommended before any live use (creating one is a billing action, so it is left to the owner).
- Alpaca execution is OFF. Setting `PAPER_VENUE=alpaca` or live mode requires `ALPACA_EXECUTION_ENABLED=true` on `desk-approve-order`, plus `ALPACA_KEY_ID` and `ALPACA_SECRET`; without it the function refuses to build the broker. Do not enable it until `desk-reconcile-orders` has been scheduled and observed settling orders. A proposal is marked `executed` only on a real fill; otherwise it stays `approved` and the order stays `submitted`.
- Option positions are marked daily from Polygon option bars (needs an options-enabled Polygon plan). A premium-stop breach creates a pending close proposal for the owner to approve; nothing closes itself. Options with no fresh price are reported as `unmarkedOptions` in the job response.
- Allowlist removal revokes the edge functions only. The removed owner's `desk_owner` row (and so read access under RLS) remains until deleted by hand in the SQL editor: `delete from public.desk_owner where user_id = '<uuid>';`. They still cannot approve anything, because approvals need the server risk marker.
- Two owners share one desk. Journal entries and kill-switch resets record the acting user id, but there is no four-eyes rule: either owner can reset the kill switch (it needs a note and only works while halted).
- `src/components/layout/Navbar.tsx` has an owner-gated Desk link added by the original build, outside the stated Desk-only file scope. It is intentional and unchanged here.

## Stuck orders and proposals
- Proposal stuck in `approved` with no order: click Approve again within about 4 minutes (same approval, same client order id, no double order). After that it is released to `failed` and audited (`proposal_released`); ask the agent for a fresh proposal.
- Order stuck in `submitting` or `submitted`: `desk-reconcile-orders` settles it every 10 minutes. A `submitting` order with no broker record after 10 minutes is marked `failed`.
