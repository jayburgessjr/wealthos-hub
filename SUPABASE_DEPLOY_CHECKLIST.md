# Supabase Deploy Checklist — AJE
> Project ID: `magpawmyuqyzgczewxsl`
> Last updated: 2026-05-13

---

## Prerequisites

Reconnect the Supabase MCP to the account that owns `magpawmyuqyzgczewxsl`:
1. Go to [supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens) — logged in to the **AJE account**
2. Generate a new personal access token
3. Update `~/.claude.json` → `mcpServers.supabase` with the new token, or re-authenticate via OAuth
4. Restart Claude Code

---

## 1. Pending Migrations

Apply in this exact order:

| # | File | Creates |
|---|---|---|
| 1 | `20260511120000_create_legal_acceptances.sql` | `legal_acceptances` table |
| 2 | `20260514000001_create_alerts.sql` | `alerts` table (Alert Engine page) |
| 3 | `20260514000002_create_screener_presets.sql` | `screener_presets` table (Asset Screener) |
| 4 | `20260514000003_create_community.sql` | `trade_ideas`, `idea_likes`, `idea_comments`, `trader_follows` (Community) |
| 5 | `20260514000004_create_bots.sql` | `bots`, `bot_executions` (Trading Bots) |

All files are in `supabase/migrations/`.

---

## 2. Edge Functions to Deploy

All 11 functions need to be deployed. New functions were added and existing ones may be stale.

| Function | Used By | Key Secrets |
|---|---|---|
| `generate-signals` | Signals page | `POLYGON_KEY`, `OPENAI_API_KEY`, `FRED_KEY` |
| `ai-advisor` | AI Advisor page | `OPENAI_API_KEY` |
| `check-alerts` | Alert Engine | Supabase auto-inject only |
| `get-congress-trades` | Insider Activity page | `QUIVER_KEY`, `POLYGON_KEY` |
| `get-market-data` | Markets / Forex & Commodities | `POLYGON_KEY`, `FRED_KEY` |
| `get-price-data` | Chart page, ticker lookups | `POLYGON_KEY` |
| `get-ticker-context` | 1-2-3 Strategy, Decision Hub | `POLYGON_KEY` |
| `screen-assets` | Asset Screener | `POLYGON_KEY` |
| `weekly-briefing` | Weekly Briefing page | `OPENAI_API_KEY` |
| `stripe-checkout` | Subscription billing | `STRIPE_SECRET_KEY`, `STRIPE_PRO_PRICE_ID` |
| `stripe-webhook` | Subscription billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` |

---

## 3. Secrets to Set

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are **auto-injected** — do not set them manually.

| Secret | Priority | Used By |
|---|---|---|
| `POLYGON_KEY` | 🔴 Critical | Signals, Charts, Screener, Market Data, Ticker Context, Insider Activity |
| `OPENAI_API_KEY` | 🔴 Critical | Signal sentiment scoring, AI Advisor, Weekly Briefing |
| `FRED_KEY` | 🟡 Optional | Yield curve + macro data in Signals and Markets (degrades gracefully without it) |
| `QUIVER_KEY` | 🟡 Optional | Live Congressional trading data (falls back to sample data without it) |
| `STRIPE_SECRET_KEY` | 🟠 Billing only | Stripe checkout + webhook |
| `STRIPE_PRO_PRICE_ID` | 🟠 Billing only | Stripe checkout |
| `STRIPE_WEBHOOK_SECRET` | 🟠 Billing only | Stripe webhook validation |

---

## Claude Code CLI Prompt

Once the MCP is connected to the right account, paste this into Claude Code:

```
Using the Supabase MCP for project magpawmyuqyzgczewxsl:

1. Apply these migrations in order:
   - supabase/migrations/20260511120000_create_legal_acceptances.sql
   - supabase/migrations/20260514000001_create_alerts.sql
   - supabase/migrations/20260514000002_create_screener_presets.sql
   - supabase/migrations/20260514000003_create_community.sql
   - supabase/migrations/20260514000004_create_bots.sql

2. Deploy all 11 edge functions from supabase/functions/:
   ai-advisor, check-alerts, generate-signals, get-congress-trades,
   get-market-data, get-price-data, get-ticker-context, screen-assets,
   weekly-briefing, stripe-checkout, stripe-webhook

3. Set these secrets (I will provide the values):
   POLYGON_KEY, OPENAI_API_KEY, FRED_KEY, QUIVER_KEY,
   STRIPE_SECRET_KEY, STRIPE_PRO_PRICE_ID, STRIPE_WEBHOOK_SECRET
```

---

## Status Tracker

- [ ] MCP reconnected to correct Supabase account
- [ ] Migration 1 applied — `legal_acceptances`
- [ ] Migration 2 applied — `alerts`
- [ ] Migration 3 applied — `screener_presets`
- [ ] Migration 4 applied — `trade_ideas` / community tables
- [ ] Migration 5 applied — `bots` / `bot_executions`
- [ ] All 11 edge functions deployed
- [ ] `POLYGON_KEY` set
- [ ] `OPENAI_API_KEY` set
- [ ] `FRED_KEY` set
- [ ] `QUIVER_KEY` set
- [ ] Stripe secrets set (if using billing)
- [ ] Signals page tested — click Refresh, signals generate
- [ ] AI Advisor tested — chat responds
- [ ] Alert Engine tested — create an alert
- [ ] Community page tested — post a trade idea
