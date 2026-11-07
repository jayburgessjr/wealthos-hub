# Money engine: build context

Objective: give the app a "manage my money" brain that works on data it already holds. One page (`/money`) that combines Household and Invest into one net worth, ranks the next best moves, finds subscription waste, orders debt payoff, and checks the emergency fund.

Route: System Build, local only. User said: do not push or merge.

## In scope (no secrets, no spend, no schema change)
- `src/lib/money/engine.ts`: pure functions, no I/O.
- `src/hooks/useMoneySnapshot.ts`: reads existing tables under existing RLS (profiles, bank_accounts, debts, subscriptions, bills, income_sources, portfolios).
- `src/pages/Money.tsx`, route `/money`, nav entry.
- Tests under `src/test/money/`.

## Parked (Hard Stops, need Jay)
- Bank and broker read-only linking: needs a paid provider account and credentials.
- Alert/briefing delivery by email, SMS, push: needs a sending key and is an external communication.
- Live trading: financial execution, stays paper only.

## Parked (later, separate builds)
- Replace sample data on 12 Invest pages with real data.
- Tax harvesting on real lots; weekly briefing from real data.
- Income-side tracking beyond existing income_sources.

## Acceptance
- Engine is deterministic and unit tested, including edge cases (no data, zero rates, negative cash flow).
- Page shows an honest empty state when there is no household data.
- Output states it is not financial advice.
- No new `any` outside the existing untyped Supabase calls.
