# Desk runbook

Internal single-user trading desk at `/desk`. Phase 0 is paper only. Every trade needs the owner's click. Design: [ARCHITECTURE.md](ARCHITECTURE.md).

## What stops a bad trade

| Layer | Rule |
|---|---|
| Agents | Receive an `AgentRepo` facade: no order, approval or position methods. No broker import (static test). |
| Database | `desk_orders` insert needs a matching, unconsumed approval under 5 minutes old. `desk_approvals` insert needs the owner's session (service role has no `auth.uid()`). Stop price is `NOT NULL` and `> 0` on proposals and orders. Kill switch clears only through `desk_reset_kill_switch()`. |
| Risk engine | 1.5% risk per trade, 25% per position, 3 options positions, defined-risk options only, mandatory stop, 3% daily loss (also projected), 10% drawdown kill switch. Recomputed on the server at approval from broker equity and a server quote. |
| Mode | Live only if `TRADING_MODE=live` AND `LIVE_TRADING_ENABLED=true`, plus a typed phrase `LIVE <SYMBOL> <SIDE> <QTY>` per order. Anything else resolves to paper. |

## Secrets (edge function secrets only; names only here)

Existing: `OPENAI_API_KEY` (research agent), `POLYGON_KEY`, `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

New: `DESK_OWNER_EMAIL`, `DESK_CRON_SECRET`. Optional: `DESK_MODEL` (default `gpt-4o`), `PAPER_STARTING_EQUITY` (default 100000), `PAPER_VENUE=alpaca` (route paper orders to Alpaca's paper endpoint), `ALPACA_KEY_ID`, `ALPACA_SECRET`, `SEC_USER_AGENT`, `TRADING_MODE` (leave unset), `LIVE_TRADING_ENABLED` (leave unset).

## First-time setup

1. Apply `supabase/migrations/20261107000000_desk_core.sql`.
2. Set the secrets above. Deploy the seven functions: `desk-claim-owner`, `desk-approve-order`, `desk-reset-kill-switch`, `desk-account`, `desk-run-agent`, `desk-mark-positions`, `desk-scorecard`.
3. Sign in to the app as the owner (email must equal `DESK_OWNER_EMAIL` and be confirmed), open `/desk`, press "Claim desk". Until then nobody can read any desk table.
4. Mark watchlist symbols (`desk_instruments.on_watchlist`). With none set, scanners use a default list of 16 liquid names.
5. Schedule the jobs (below).

## Schedule (pg_cron + pg_net; run once in the SQL editor)

Store the cron secret in Vault first (`select vault.create_secret('<value of DESK_CRON_SECRET>', 'desk_cron_secret');`), then:

```sql
-- weekdays, UTC. 21:30 is after the US close in both daylight and standard time.
select cron.schedule('desk-scan-gaps',     '30 21 * * 1-5', $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-run-agent', '{"agent":"scan-gaps-drawdowns"}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
-- repeat for: scan-ipos, scan-sec-filings, scan-sector-momentum, scan-crypto-volatility, scan-commodity-trends (stagger by a minute)
select cron.schedule('desk-research',      '45 21 * * 1-5', $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-run-agent', '{"agent":"research-new"}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
select cron.schedule('desk-mark',          '0 22 * * 1-5',  $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-mark-positions', '{}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
select cron.schedule('desk-scorecard',     '15 22 * * 1-5', $$select net.http_post('https://magpawmyuqyzgczewxsl.supabase.co/functions/v1/desk-scorecard', '{}'::jsonb, headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='desk_cron_secret')))$$);
```

## Phase 0 limits (known, deliberate)

- Long only for stocks, ETFs and crypto. Short theses are recorded and scored but no order is proposed.
- Agents propose stock, ETF and crypto orders only. The risk engine and brokers accept defined-risk options; Alpaca supports single-leg long options, multi-leg is refused.
- Quotes are the latest daily close (Polygon). Real-time quotes are required before live trading is ever enabled.
- Neutral ("watch") signals are listed but not scored; they make no directional claim.
- Alpaca cannot attach a stop to crypto or option entries, so the stop goes as a second order; if that is refused the function reports it and the position must be closed manually.
- The desk shares the WealthOS Supabase project. A dedicated project is recommended before any live use (creating one is a billing action, so it is left to the owner).
