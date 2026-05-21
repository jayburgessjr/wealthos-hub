# Household Harmony Integration — Design Spec

**Date:** 2026-05-20  
**Status:** Approved  
**Scope:** Full port of Household Harmony into AJE as a dedicated household finance mode

---

## 1. Overview

Add a complete household budgeting and personal finance system to AJE, ported from the standalone Household Harmony app. The integration surfaces as a separate **Household mode** inside AJE's sidebar — a full context switch that replaces the investing nav with a dedicated household nav. All data lives in AJE's existing Supabase project. Three existing AJE pages (Debt Manager, Cash Flow Planner, Net Worth) are retired and replaced by their fuller Household Harmony equivalents.

---

## 2. Navigation & Mode Switch

### Approach

URL-driven mode detection. No extra React state needed — the URL is the mode.

- **Investing mode:** all existing AJE routes (`/dashboard`, `/positions`, `/signals`, etc.)
- **Household mode:** all new routes live under `/household/*`

### Sidebar behavior

`Sidebar.tsx` reads `useLocation()`. If `pathname.startsWith('/household')`, it renders the Household nav (green accent). Otherwise it renders the existing Investing nav (blue accent).

A two-segment toggle pinned to the top of the sidebar switches between modes:

- Clicking **Investing** → navigates to `/dashboard`
- Clicking **Household** → navigates to `/household`

Deep links, back/forward navigation, and page refresh all work correctly because mode is encoded in the URL.

### Household sidebar sections

| Section       | Links                                                                         |
| ------------- | ----------------------------------------------------------------------------- |
| **Home**      | Dashboard, Command Center                                                     |
| **Money In**  | Income, Bank Accounts                                                         |
| **Money Out** | Budget & Expenses, Bills, Subscriptions, Debts                                |
| **Future**    | Goals, Net Worth, Simulator                                                   |
| **Insights**  | AI Assistant, CFO Reports, Weekly Meeting, Monthly Closeout, Quarterly Review |
| **Life**      | Career Profiles, Vision Board, Tasks                                          |
| **Household** | Settings, Members & Invites                                                   |

---

## 3. Features (17 total: 13 core from HH + weekly meeting + monthly closeout split into separate features + quarterly review as new addition)

| #   | Feature                              | Notes                                                                              |
| --- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| 1   | Budget Categories & Expense Tracking | Fixed/variable/savings/debt types, monthly limits, daily average, 50/30/20 tracker |
| 2   | Bills Tracker                        | Recurring bills, payment status, auto-pay, monthly rollover, calendar view         |
| 3   | Income Tracking                      | Income sources + entries, gross/net/tax status, expected vs actual                 |
| 4   | Subscriptions Manager                | Monthly & annual, renewal dates, cashflow normalization                            |
| 5   | Financial Goals                      | Savings targets, monthly contributions, milestones, linked bills                   |
| 6   | Debt Tracker                         | Balances, APR, payoff projections, debt-to-bill linking                            |
| 7   | Bank Account Reconciliation          | Current vs calculated balance, multiple accounts, reconciliation dates             |
| 8   | Credit Score Tracking                | Per bureau, per household member, trend chart                                      |
| 9   | Net Worth Dashboard                  | Assets vs liabilities over time (replaces AJE's `/net-worth`)                      |
| 10  | Budget Simulator                     | What-if scenarios, income/expense changes, 12-month projections, risk assessment   |
| 11  | Weekly Meeting Wizard                | Spending check-in, upcoming bills, wins/losses, focus for next week                |
| 12  | Monthly Closeout Wizard              | Full budget review, category overages, goals progress, rollover decisions          |
| 13  | Quarterly Review Wizard              | Net worth snapshot, debt progress, goals recalibration, career/salary review       |
| 14  | AI Financial Assistant               | Streaming AI chat grounded in household data, budget insights, categorization      |
| 15  | Career Profiles                      | Title, salary, skills, achievements, career goals per household member             |
| 16  | Vision Board                         | Goal images, vision card gallery                                                   |
| 17  | Household Tasks / Kanban             | Shared todo/in-progress/done board, drag-and-drop, member assignment               |

---

## 4. Multi-User Household Model

Identical to Household Harmony's model:

- A **household** is the top-level unit; all data is scoped to it
- A user can belong to one household at a time
- **Roles:** `owner` (full access, can invite/remove) and `member` (read/write data, cannot manage members)
- **Invitation flow:** owner sends email invite → token generated → recipient clicks link → `/household/invite/:token` → accepted → user joined to household
- AJE's existing `profiles` table gets a `household_id` column added

---

## 5. Database Schema

All tables added to AJE's Supabase project (`magpawmyuqyzgczewxsl`) via new migrations. No existing AJE tables are modified except adding `household_id` to `profiles`.

### New tables

| Group         | Tables                                                         |
| ------------- | -------------------------------------------------------------- |
| Household     | `households`, `user_roles`, `invitations`                      |
| Budget        | `categories`, `expenses`                                       |
| Bills         | `bills`, `debts`                                               |
| Income        | `income_sources`, `income_entries`                             |
| Accounts      | `bank_accounts`, `credit_scores`                               |
| Goals         | `goals`                                                        |
| Subscriptions | `subscriptions`                                                |
| Tasks         | `tasks`                                                        |
| Careers       | `career_profiles`, `skills`, `achievements`, `career_goals`    |
| Summaries     | `weekly_summaries`, `monthly_summaries`, `quarterly_summaries` |
| Vision        | `vision_items`                                                 |

### RLS policy pattern

Every table is scoped by `household_id`. Members can only read/write rows where `household_id` matches their current household. The `create_household` RPC handles atomic household creation + owner role assignment.

### Summary tables schema

All three summary tables share the same shape:

```sql
id uuid primary key
household_id uuid references households
period text        -- 'YYYY-Www' / 'YYYY-MM' / 'YYYY-Q1'
notes text
data jsonb         -- flexible wizard output
created_at timestamptz
updated_at timestamptz
```

---

## 6. Code Organization

```
src/
├── pages/household/
│   ├── HouseholdDashboard.tsx
│   ├── HouseholdBills.tsx
│   ├── HouseholdBudget.tsx
│   ├── HouseholdIncome.tsx
│   ├── HouseholdSubscriptions.tsx
│   ├── HouseholdGoals.tsx
│   ├── HouseholdDebts.tsx
│   ├── HouseholdBankAccounts.tsx
│   ├── HouseholdCreditScores.tsx
│   ├── HouseholdNetWorth.tsx
│   ├── HouseholdSimulator.tsx
│   ├── HouseholdAIAssistant.tsx
│   ├── HouseholdCFOReports.tsx
│   ├── HouseholdWeeklyMeeting.tsx
│   ├── HouseholdMonthlyCloseout.tsx
│   ├── HouseholdQuarterlyReview.tsx
│   ├── HouseholdCareers.tsx
│   ├── HouseholdVision.tsx
│   ├── HouseholdTasks.tsx
│   ├── HouseholdSettings.tsx
│   └── HouseholdSetup.tsx
│
├── components/household/
│   ├── budget/            # BudgetOverview, CategoryCard, ExpenseForm, etc.
│   ├── bills/             # BillCalendarView, BillPaymentAllocation, etc.
│   ├── income/            # IncomeSourceForm, IncomeEntryList, etc.
│   ├── goals/             # GoalCard, GoalMilestoneProvider, etc.
│   ├── debts/             # AdvancedDebtDetails, DebtPayoffProjections, etc.
│   ├── tasks/             # KanbanBoard, KanbanColumn, TaskCard, etc.
│   ├── careers/           # CareerProfileCard, SkillsList, AchievementsList, etc.
│   ├── vision/            # VisionCard, VisionDrawer, VisionUpload, etc.
│   ├── simulate/          # ScenarioCard, TimelineProjection, RiskAssessment, etc.
│   ├── closeout/          # MonthlyCloseoutWizard, WeeklyMeetingWizard, QuarterlyReviewWizard
│   ├── ai/                # HouseholdAIChatAssistant
│   ├── dashboard/         # HouseholdDashboardOverview, StatCard, RecentActivity, etc.
│   ├── import/            # CsvImportDialog
│   ├── layout/            # HouseholdSidebar nav entries
│   └── household/         # InviteMemberForm, MemberList, HouseholdSetupWizard
│
├── context/
│   └── HouseholdBudgetContext.tsx
│
├── hooks/
│   ├── useHouseholdBudgetData.ts
│   └── useHouseholdRealtimeSync.ts
│
└── integrations/supabase/
    ├── household-queries.ts
    └── household-types.ts
```

---

## 7. Data Flow

```
Supabase Auth (shared with AJE — same client, same session)
       ↓
HouseholdBudgetContext  (wraps /household/* routes only)
  - resolves householdId from profiles.household_id
  - month switcher state (URL ?month=YYYY-MM)
  - dual-mode: local demo (no household) + DB-backed (household exists)
  - exposes all CRUD actions with optimistic updates
       ↓
useHouseholdBudgetData.ts  (React Query hooks)
  - one hook per entity: useBillsQuery, useGoalsQuery, useExpensesQuery, etc.
  - optimistic updates with rollback on error
  - cache keys namespaced under 'household-*' to avoid collisions with AJE cache
       ↓
household-queries.ts
  - all Supabase DB calls isolated here
  - RLS enforces household_id scoping automatically — no manual filtering needed
       ↓
useHouseholdRealtimeSync.ts
  - Supabase Realtime channel per householdId
  - invalidates relevant React Query caches on DB change
  - enables real-time sync across browser tabs and household members
```

**Context isolation:** `HouseholdBudgetContext` is added to `App.tsx` wrapping only the `/household/*` route subtree. AJE's existing context providers (`AuthProvider`, `QueryClientProvider`) are shared and untouched.

---

## 8. Existing AJE Page Replacements

| Retired page      | Route                | Replaced by                |
| ----------------- | -------------------- | -------------------------- |
| Debt Manager      | `/debt-manager`      | `/household/debts`         |
| Cash Flow Planner | `/cash-flow-planner` | `/household/bank-accounts` |
| Net Worth         | `/net-worth`         | `/household/net-worth`     |

The old route components are deleted. The routes in `App.tsx` are replaced with `<Navigate to="/household/debts" replace />` etc. so existing bookmarks redirect cleanly.

---

## 9. Household Setup Flow

First-time flow for a user with no household:

1. User visits `/household` → redirected to `/household/setup`
2. Setup wizard: create a new household (name + monthly income) OR enter an invite token
3. On create: `create_household` RPC runs atomically (creates household + assigns owner role + seeds default categories)
4. On join via invite: token validated → household joined → user redirected to `/household`
5. After setup, `/household` loads the full dashboard

Invite flow:

1. Owner goes to Household → Members → Invite Member → enters email
2. Invite token created in `invitations` table, email sent via a `send-invite` Supabase edge function using Resend
3. Recipient clicks link → `/household/invite/:token` → prompted to sign in/sign up → invitation accepted → joined

---

## 10. Port Strategy

Source: `household-harmony-main/` (currently sitting in the repo as an untracked directory)

- **Migrations:** port all SQL from `household-harmony-main/supabase/migrations/` into `supabase/migrations/` with new timestamps. Review each for conflicts with AJE's existing schema before applying.
- **Components:** copy from `household-harmony-main/src/components/` → `src/components/household/`. The `@/` path alias is identical in both projects — no import changes needed. Five production dependencies used by HH are not in AJE and must be installed: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` (drag-and-drop for Kanban), `canvas-confetti` (goal milestone celebrations), `papaparse` (CSV import).
- **Hooks & Context:** port and rename with `Household` prefix. Namespace React Query cache keys under `'household-*'`.
- **Pages:** port from `household-harmony-main/src/pages/` → `src/pages/household/`. Remove HH-specific layout wrappers (HH had its own `AppLayout`; AJE's `DashboardLayout` + `Sidebar` will wrap these instead).
- **Types:** port `household-harmony-main/src/types/budget.ts` → `src/integrations/supabase/household-types.ts`.
- **AI service:** port `aiService.ts` → `src/services/householdAiService.ts`. Update `CHAT_URL` to point to a new `household-ai-budget` Supabase edge function (or reuse AJE's existing AI edge function with a new action).
- **Cleanup:** once ported and verified, delete `household-harmony-main/` from the repo.

---

## 11. Out of Scope

- Connecting household bank accounts to AJE's investment portfolio data (net worth aggregation across both) — future enhancement
- Email notifications for bills/budget alerts — can be added post-launch via Supabase edge functions
- Mobile-specific optimizations beyond what HH already has — carried over as-is
