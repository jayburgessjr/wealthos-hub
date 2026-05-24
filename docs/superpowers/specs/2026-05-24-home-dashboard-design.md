# Home Dashboard — Design Spec

**Date:** 2026-05-24  
**Route:** `/home`  
**Status:** Approved

---

## Overview

A unified landing page that aggregates live data from all three product sections — Invest, Wealth, and Household — into a single post-login view. Replaces `/invs/dashboard` as the default redirect after authentication. Serves as both a data snapshot and a launch pad for the user's most frequent actions.

---

## Layout

**Hero Bar + Asymmetric Grid (Layout B)**

```
┌─────────────────────────────────────────────┐
│  Good morning, Jay                          │
│  [Net Worth] [Portfolio] [Budget Left] [Bills Due] │
├──────────────────────────┬──────────────────┤
│  📈 INVEST               │  💎 WEALTH       │
│  (wide, 2/3 width)       │  (narrow, 1/3)   │
├──────────────────────────┤                  │
│  🏠 HOUSEHOLD            ├──────────────────┤
│  (wide, 2/3 width)       │  ⚡ QUICK ACTIONS│
└──────────────────────────┴──────────────────┘
```

- Left column (`2fr`): Invest card stacked above Household card
- Right column (`1fr`): Wealth card stacked above Quick Actions card
- Responsive: stacks to single column on mobile

---

## Sections

### Hero Bar

Personalized greeting ("Good morning / afternoon / evening, [first name]") + 4 KPI chips in a 4-column grid.

| Chip        | Data Source                                                                                   | Color                                    |
| ----------- | --------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Net Worth   | `bank_accounts.current_balance` sum + portfolio estimate − `debts.current_balance` sum        | `--bullish` green                        |
| Portfolio   | Placeholder (no live brokerage connection yet) — show `$—` with "Connect broker" link if null | neutral                                  |
| Budget Left | `household.monthly_income` − sum of variable expenses this month                              | amber if <20% remaining, green otherwise |
| Bills Due   | Count of `bills` where `payment_status = 'unpaid'` and `due_date` within next 7 days          | red if >0, neutral if 0                  |

Net Worth formula: `SUM(bank_accounts.current_balance) − SUM(debts.current_balance)`. Portfolio value added if available.

---

### Invest Panel (left, top)

Color accent: `#22c55e` (green). Links to `/invs/dashboard`.

**Content:**

- Section label + "→ Trading Desk" CTA button
- Two stat tiles side by side:
  - **Top Signal Today** — highest-scored ticker from `signals` table (name + score + direction). If no signals, show "No signals today".
  - **Open P&L** — placeholder `$—` until brokerage connected; shows position count if available
- Signal chip strip — up to 5 recent tickers from signals table, color-coded bullish/bearish. "+N more →" chip links to `/invs/discover`

**Data:** `signals` table via existing Supabase query. Reuses pattern from existing `/invs/dashboard`.

---

### Household Panel (left, bottom)

Color accent: `#f59e0b` (amber). Links to `/household/command-center`.

**Content:**

- Section label + "→ Command Center" CTA button
- Budget progress bar: `spent / monthly_income` for current month
- Three stat tiles:
  - **Bills Due** — count of unpaid bills in next 7 days (red badge if >0)
  - **Active Goals** — count of goals with `current_amount < target_amount`
  - **Monthly Net** — `income_entries` total − `expenses` total for current month (green if positive)

**Data:** `HouseholdBudgetContext` — all data already loaded. No additional queries needed.

---

### Wealth Panel (right, top)

Color accent: `#818cf8` (indigo). Links to `/real-estate` (primary), `/dividend-tracker`.

**Content:**

- Section label + "→ Hub" CTA button
- Three stat tiles stacked vertically:
  - **Real Estate** — static/manual value for now (no live data source); show `$—` if not set
  - **Dividends** — monthly total + days until next payout (from `dividend-tracker` if data exists, else `$—`)
  - **Tax Saved YTD** — from `tax-harvesting` if data exists, else `$—`

**Data:** Wealth section has no Supabase tables yet. All three tiles show `$—` with a "Set up →" link on first use. This is intentional — wealth features are not yet fully wired to live data.

---

### Quick Actions Panel (right, bottom)

No section color accent. Static list of action buttons.

| Action       | Icon        | Behavior                                                            |
| ------------ | ----------- | ------------------------------------------------------------------- |
| Log Expense  | `+` amber   | Navigates to `/household/budget`                                    |
| Add Trade    | `+` green   | Navigates to `/invs/review` (trading journal)                       |
| View Signals | `📊` green  | Navigates to `/invs/discover`                                       |
| Pay Bills    | `🏠` amber  | Navigates to `/household/bills` · red badge with count if bills due |
| View Tasks   | `📋` indigo | Navigates to `/household/tasks`                                     |

Actions are plain `Link` components — no modals or inline forms on the home page.

---

## Routing & Auth

- New route: `<Route path="/home" element={<HomeDashboard />} />` registered at the top level in `App.tsx` (outside `HouseholdRoutes` and `InvestRoutes`)
- Post-login redirect in `App.tsx` (or `AuthProvider`) changes from `/invs/dashboard` to `/home`
- The page wraps in `HouseholdBudgetProvider` (to access household data) and reads invest signals via a direct Supabase query — no new context needed
- `/invs/dashboard` route is **unchanged** — still exists, still works

---

## Data Loading

| Data                                       | How                                                                  |
| ------------------------------------------ | -------------------------------------------------------------------- |
| Household (budget, bills, goals, expenses) | `useHouseholdBudget()` hook — context already loaded                 |
| Top signal                                 | Direct `useQuery` to `signals` table, ordered by score desc, limit 1 |
| Recent signals                             | Same query, limit 5                                                  |
| Auth / user name                           | `useAuth()`                                                          |

No new Edge Functions. No new Supabase tables. Wealth tiles render `$—` placeholders where live data is unavailable.

---

## Component Structure

```
src/pages/HomeDashboard.tsx          # New page
src/components/home/
  HeroBar.tsx                        # 4 KPI chips + greeting
  InvestPanel.tsx                    # Invest card
  HouseholdPanel.tsx                 # Household card
  WealthPanel.tsx                    # Wealth card
  QuickActions.tsx                   # Action buttons
```

Each panel component receives only the props it needs — no component accesses context directly except `HomeDashboard.tsx` (the orchestrator).

---

## Design Tokens

Follows existing AJE design language:

- `font-display` for headings, `font-mono` for numbers
- `rounded-xl`, `border border-border bg-card` for cards
- `border-t-2` color accent per section (green / amber / indigo)
- Dark background: `bg-background` (`#0a0a0a`)

---

## Out of Scope

- Live portfolio value from a brokerage API
- Inline expense/trade entry forms on this page (Quick Actions navigate away)
- Notifications or activity feed
- Mobile-specific navigation changes
- Any changes to existing Invest or Household dashboard pages
