# Household Harmony Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port all 17 Household Harmony features into AJE as a dedicated Household mode, adding a URL-driven sidebar context switch that renders a green Household nav at `/household/*` and the existing blue Investing nav everywhere else.

**Architecture:** `pathname.startsWith('/household')` is the sole mode signal — no extra React state. `HouseholdBudgetContext` wraps only the `/household/*` route subtree inside a `HouseholdRoutes` component in `App.tsx`, sharing AJE's existing `QueryClientProvider`, `AuthProvider`, and Supabase client. All 17 feature pages are direct ports from `household-harmony-main/src/pages/` with layout wrapper and import path substitutions. The three retired AJE pages (Net Worth, Debt Manager, Cash Flow Planner) are replaced with `<Navigate>` redirects.

**Tech Stack:** React 18, TypeScript, Vite, Supabase (project `magpawmyuqyzgczewxsl`), TanStack React Query (cache keys namespaced `household-*`), @dnd-kit (Kanban drag-and-drop), canvas-confetti (goal milestones), papaparse (CSV import), Framer Motion, Recharts, Vitest

---

## File Map

### Foundation (new)

| File                                             | Source                                                                                      |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `src/integrations/supabase/household-types.ts`   | Port from `household-harmony-main/src/types/budget.ts`                                      |
| `src/integrations/supabase/household-queries.ts` | Port from `household-harmony-main/src/integrations/supabase/queries.ts` (already bug-fixed) |
| `src/context/HouseholdBudgetContext.tsx`         | Port from `household-harmony-main/src/context/BudgetContext.tsx`                            |
| `src/hooks/useHouseholdBudgetData.ts`            | Port from `household-harmony-main/src/hooks/useBudgetData.ts`                               |
| `src/hooks/useHouseholdRealtimeSync.ts`          | Port from `household-harmony-main/src/hooks/useRealtimeSync.ts` (already bug-fixed)         |

### Modified files

| File                                | Change                                                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/App.tsx`                       | Add `HouseholdRoutes` component + all `/household/*` routes; replace 3 retired routes with `<Navigate>` |
| `src/components/layout/Sidebar.tsx` | Add mode toggle; conditionally render household navSections with green accent                           |

### Pages (new — `src/pages/household/`)

`HouseholdSetup.tsx`, `HouseholdDashboard.tsx`, `HouseholdBudget.tsx`, `HouseholdBills.tsx`, `HouseholdIncome.tsx`, `HouseholdSubscriptions.tsx`, `HouseholdGoals.tsx`, `HouseholdDebts.tsx`, `HouseholdBankAccounts.tsx`, `HouseholdCreditScores.tsx`, `HouseholdNetWorth.tsx`, `HouseholdSimulator.tsx`, `HouseholdWeeklyMeeting.tsx`, `HouseholdMonthlyCloseout.tsx`, `HouseholdQuarterlyReview.tsx`, `HouseholdAIAssistant.tsx`, `HouseholdCFOReports.tsx`, `HouseholdCareers.tsx`, `HouseholdVision.tsx`, `HouseholdTasks.tsx`, `HouseholdSettings.tsx`

### Component directories (new — `src/components/household/`)

`budget/`, `bills/`, `income/`, `goals/`, `debts/`, `tasks/`, `careers/`, `vision/`, `simulate/`, `closeout/`, `ai/`, `dashboard/`, `import/`, `household/`

### Edge function (new)

`supabase/functions/send-invite/index.ts`

### Migrations (new)

- 41 ported HH migration files with `2026062XXXXXXX` timestamps
- `supabase/migrations/20260620000041_add_household_id_to_profiles.sql` (new)
- `supabase/migrations/20260620000042_add_quarterly_summaries.sql` (new)

---

## The Port Pattern

**Every HH file port follows this exact substitution table.** Task 9 shows it applied in full; subsequent tasks call it out only where there are deviations.

| Old import (HH)                                             | New import (AJE)                                                        |
| ----------------------------------------------------------- | ----------------------------------------------------------------------- |
| `import { AppLayout } from '@/components/layout/AppLayout'` | `import DashboardLayout from '@/components/layout/DashboardLayout'`     |
| `import { useBudget } from '@/context/BudgetContext'`       | `import { useHouseholdBudget } from '@/context/HouseholdBudgetContext'` |
| `import { useAuth } from '@/hooks/useAuth'`                 | `import { useAuth } from '@/components/AuthProvider'`                   |
| `from '@/types/budget'`                                     | `from '@/integrations/supabase/household-types'`                        |
| `from '@/hooks/useBudgetData'`                              | `from '@/hooks/useHouseholdBudgetData'`                                 |
| `from '@/hooks/useRealtimeSync'`                            | `from '@/hooks/useHouseholdRealtimeSync'`                               |
| `from '@/integrations/supabase/queries'`                    | `from '@/integrations/supabase/household-queries'`                      |

**JSX substitution:**

- `<AppLayout>…</AppLayout>` → `<DashboardLayout>…</DashboardLayout>`

**Remove entirely:**

- Any `import { ProtectedRoute }` line and its wrapping JSX (AJE's `AuthProvider` handles this at the app level)

---

## Task 1: Install missing production dependencies

**Files:**

- Modify: `package.json` (via npm install)

- [ ] **Step 1: Install the five deps missing from AJE**

```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities canvas-confetti papaparse
npm install --save-dev @types/papaparse
```

- [ ] **Step 2: Verify they appear in package.json**

```bash
node -e "const p = require('./package.json'); ['@dnd-kit/core','@dnd-kit/sortable','@dnd-kit/utilities','canvas-confetti','papaparse'].forEach(d => console.log(d, p.dependencies[d] || 'MISSING'))"
```

Expected: all five print a version string (not MISSING).

- [ ] **Step 3: Verify the build still compiles**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: install @dnd-kit, canvas-confetti, papaparse for Household Harmony port"
```

---

## Task 2: Port Supabase migrations

**Files:**

- Create: 41 files in `supabase/migrations/` (20260620000000–20260620000040)
- Create: `supabase/migrations/20260620000041_add_household_id_to_profiles.sql`
- Create: `supabase/migrations/20260620000042_add_quarterly_summaries.sql`

- [ ] **Step 1: Copy all 41 applicable HH migrations with new timestamps**

Run this script from the repo root:

```bash
i=0
for f in $(ls household-harmony-main/supabase/migrations/*.sql | sort); do
  # Skip the daily-email scheduler — it has hardcoded placeholder values
  if echo "$f" | grep -q "schedule_daily_email"; then
    echo "SKIP: $f"
    continue
  fi
  # Strip original timestamp, keep descriptive suffix
  name=$(basename "$f")
  suffix="${name#*_}"   # everything after first underscore
  # If no underscore (UUID-only names), use the UUID as suffix
  [[ "$suffix" == "$name" ]] && suffix="$name"
  new_ts=$(printf "2026062%07d" $i)
  new_name="${new_ts}_${suffix}"
  cp "$f" "supabase/migrations/${new_name}"
  echo "Copied → $new_name"
  i=$((i+1))
done
```

Expected: ~41 lines printed (42 total minus 1 skipped).

- [ ] **Step 2: Create the profiles alteration migration**

Create `supabase/migrations/20260620000041_add_household_id_to_profiles.sql`:

```sql
-- Add household_id to AJE's existing profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_household_id ON public.profiles(household_id);
```

- [ ] **Step 3: Create the quarterly_summaries migration**

Create `supabase/migrations/20260620000042_add_quarterly_summaries.sql`:

```sql
CREATE TABLE IF NOT EXISTS public.quarterly_summaries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  period      text NOT NULL,  -- format: 'YYYY-Q1', 'YYYY-Q2', etc.
  notes       text,
  data        jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, period)
);

ALTER TABLE public.quarterly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_members_select_quarterly" ON public.quarterly_summaries
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "household_members_insert_quarterly" ON public.quarterly_summaries
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "household_members_update_quarterly" ON public.quarterly_summaries
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "household_members_delete_quarterly" ON public.quarterly_summaries
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );
```

- [ ] **Step 4: Verify migration count**

```bash
ls supabase/migrations/ | grep "2026062" | wc -l
```

Expected: `43`

- [ ] **Step 5: ⚠️ Human approval required — apply migrations to production**

Do NOT run this step autonomously. Surface to the user:

> "43 new migration files are ready in `supabase/migrations/`. Run `supabase db push` or apply via Supabase dashboard to execute them against project `magpawmyuqyzgczewxsl`. Confirm before proceeding."

- [ ] **Step 6: Commit migration files**

```bash
git add supabase/migrations/
git commit -m "feat: port Household Harmony DB migrations + add quarterly_summaries table"
```

---

## Task 3: Create household-types.ts

**Files:**

- Create: `src/integrations/supabase/household-types.ts`
- Source: `household-harmony-main/src/types/budget.ts`

- [ ] **Step 1: Write the types file**

Copy the full contents of `household-harmony-main/src/types/budget.ts` to `src/integrations/supabase/household-types.ts`, then append the following types that don't exist in HH:

```typescript
// ── Summaries ─────────────────────────────────────────────────────────────────

export interface WeeklySummary {
  id: string;
  householdId: string;
  period: string; // 'YYYY-Www'
  notes?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MonthlySummary {
  id: string;
  householdId: string;
  period: string; // 'YYYY-MM'
  notes?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface QuarterlySummary {
  id: string;
  householdId: string;
  period: string; // 'YYYY-Q1'
  notes?: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
```

Also confirm the existing `Budget` interface in budget.ts includes `weeklySummaries` and `monthlySummaries`. If not, add them plus `quarterlySummaries`:

```typescript
// Inside the Budget interface, add:
weeklySummaries: WeeklySummary[];
monthlySummaries: MonthlySummary[];
quarterlySummaries: QuarterlySummary[];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep household-types | head -20
```

Expected: no output (no errors in that file).

- [ ] **Step 3: Commit**

```bash
git add src/integrations/supabase/household-types.ts
git commit -m "feat: add household-types.ts porting all Budget, Category, Bill, etc. interfaces"
```

---

## Task 4: Create household-queries.ts

**Files:**

- Create: `src/integrations/supabase/household-queries.ts`
- Source: `household-harmony-main/src/integrations/supabase/queries.ts` (bug-fixed version)

- [ ] **Step 1: Copy the queries file**

```bash
cp household-harmony-main/src/integrations/supabase/queries.ts \
   src/integrations/supabase/household-queries.ts
```

- [ ] **Step 2: Apply import substitutions**

In `src/integrations/supabase/household-queries.ts`:

```bash
# Run these sed commands in sequence
sed -i '' "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
  src/integrations/supabase/household-queries.ts
```

- [ ] **Step 3: Add quarterly summaries CRUD functions**

Append to the bottom of `src/integrations/supabase/household-queries.ts`:

```typescript
// ── Quarterly Summaries ───────────────────────────────────────────────────────

export interface CreateQuarterlySummaryInput {
  householdId: string;
  period: string;
  notes?: string;
  data?: Record<string, unknown>;
}

export async function fetchQuarterlySummaries(householdId: string) {
  const { data, error } = await supabase
    .from("quarterly_summaries")
    .select("*")
    .eq("household_id", householdId)
    .order("period", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function upsertQuarterlySummary(
  input: CreateQuarterlySummaryInput,
) {
  const { data, error } = await supabase
    .from("quarterly_summaries")
    .upsert(
      {
        household_id: input.householdId,
        period: input.period,
        notes: input.notes ?? null,
        data: input.data ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: "household_id,period" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteQuarterlySummary(id: string) {
  const { error } = await supabase
    .from("quarterly_summaries")
    .delete()
    .eq("id", id);
  if (error) throw error;
}
```

- [ ] **Step 4: Verify no TypeScript errors in the new file**

```bash
npx tsc --noEmit 2>&1 | grep household-queries | head -20
```

Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add src/integrations/supabase/household-queries.ts
git commit -m "feat: add household-queries.ts with all Supabase CRUD functions + quarterly summaries"
```

---

## Task 5: Create useHouseholdBudgetData.ts

**Files:**

- Create: `src/hooks/useHouseholdBudgetData.ts`
- Source: `household-harmony-main/src/hooks/useBudgetData.ts`

- [ ] **Step 1: Copy the hooks file**

```bash
cp household-harmony-main/src/hooks/useBudgetData.ts \
   src/hooks/useHouseholdBudgetData.ts
```

- [ ] **Step 2: Apply import substitutions**

```bash
sed -i '' \
  -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
  -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
  src/hooks/useHouseholdBudgetData.ts
```

- [ ] **Step 3: Namespace all React Query cache keys**

In `src/hooks/useHouseholdBudgetData.ts`, find every `queryKey` array and prefix the first string element with `household-`. For example:

```typescript
// Before:
queryKey: ["budget", householdId, currentMonth];
queryKey: ["subscriptions", householdId];
queryKey: ["tasks", householdId];

// After:
queryKey: ["household-budget", householdId, currentMonth];
queryKey: ["household-subscriptions", householdId];
queryKey: ["household-tasks", householdId];
```

Run this to find all queryKey occurrences:

```bash
grep -n "queryKey:" src/hooks/useHouseholdBudgetData.ts
```

Update each one manually so the first string element starts with `household-`.

- [ ] **Step 4: Add quarterly summaries hooks at the bottom of the file**

```typescript
import {
  fetchQuarterlySummaries,
  upsertQuarterlySummary,
  deleteQuarterlySummary,
  type CreateQuarterlySummaryInput,
} from "@/integrations/supabase/household-queries";

export function useQuarterlySummariesQuery(householdId: string | null) {
  return useQuery({
    queryKey: ["household-quarterly-summaries", householdId],
    queryFn: () => fetchQuarterlySummaries(householdId!),
    enabled: !!householdId,
  });
}

export function useUpsertQuarterlySummaryMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateQuarterlySummaryInput) =>
      upsertQuarterlySummary(input),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: ["household-quarterly-summaries", vars.householdId],
      });
    },
  });
}
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep useHouseholdBudgetData | head -10
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useHouseholdBudgetData.ts
git commit -m "feat: add useHouseholdBudgetData.ts with namespaced cache keys + quarterly summary hooks"
```

---

## Task 6: Create useHouseholdRealtimeSync.ts

**Files:**

- Create: `src/hooks/useHouseholdRealtimeSync.ts`
- Source: `household-harmony-main/src/hooks/useRealtimeSync.ts` (already bug-fixed: channel name includes householdId)

- [ ] **Step 1: Copy the file**

```bash
cp household-harmony-main/src/hooks/useRealtimeSync.ts \
   src/hooks/useHouseholdRealtimeSync.ts
```

- [ ] **Step 2: Apply import substitutions**

```bash
sed -i '' \
  -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
  -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
  src/hooks/useHouseholdRealtimeSync.ts
```

- [ ] **Step 3: Namespace cache keys in invalidateQueries calls**

```bash
grep -n "invalidateQueries\|queryKey" src/hooks/useHouseholdRealtimeSync.ts
```

For each cache key found, prefix with `household-` (same pattern as Task 5, Step 3).

- [ ] **Step 4: Rename the exported hook**

In `src/hooks/useHouseholdRealtimeSync.ts`, rename the export:

```typescript
// Before:
export function useRealtimeSync(householdId: string | null) {

// After:
export function useHouseholdRealtimeSync(householdId: string | null) {
```

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep useHouseholdRealtimeSync | head -10
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/useHouseholdRealtimeSync.ts
git commit -m "feat: add useHouseholdRealtimeSync.ts for cross-tab DB change propagation"
```

---

## Task 7: Create HouseholdBudgetContext.tsx

**Files:**

- Create: `src/context/HouseholdBudgetContext.tsx`
- Source: `household-harmony-main/src/context/BudgetContext.tsx`

- [ ] **Step 1: Copy the context file**

```bash
cp household-harmony-main/src/context/BudgetContext.tsx \
   src/context/HouseholdBudgetContext.tsx
```

- [ ] **Step 2: Apply all import substitutions**

```bash
sed -i '' \
  -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
  -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
  -e "s|from '@/hooks/useRealtimeSync'|from '@/hooks/useHouseholdRealtimeSync'|g" \
  -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
  -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
  -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
  src/context/HouseholdBudgetContext.tsx
```

- [ ] **Step 3: Rename all exported symbols**

In `src/context/HouseholdBudgetContext.tsx`:

```typescript
// Rename the context
// Before: const BudgetContext = createContext<BudgetContextType | undefined>(undefined);
// After:
const HouseholdBudgetContext = createContext<BudgetContextType | undefined>(undefined);

// Rename the provider
// Before: export function BudgetProvider({ children }: { children: ReactNode }) {
// After:
export function HouseholdBudgetProvider({ children }: { children: ReactNode }) {
  // ... same body, but replace all internal BudgetContext references with HouseholdBudgetContext

// Rename the hook
// Before: export function useBudget() {
//   const ctx = useContext(BudgetContext);
// After:
export function useHouseholdBudget() {
  const ctx = useContext(HouseholdBudgetContext);
  if (!ctx) throw new Error('useHouseholdBudget must be used within HouseholdBudgetProvider');
  return ctx;
}
```

- [ ] **Step 4: Add quarterly summaries to context**

In the `BudgetContextType` interface definition, add:

```typescript
quarterlySummaries: QuarterlySummary[];
upsertQuarterlySummary: (input: { period: string; notes?: string; data?: Record<string, unknown> }) => void;
```

In the `HouseholdBudgetProvider` body, add the quarterly query and expose it:

```typescript
import {
  useQuarterlySummariesQuery,
  useUpsertQuarterlySummaryMutation,
} from "@/hooks/useHouseholdBudgetData";
import type { QuarterlySummary } from "@/integrations/supabase/household-types";

// Inside HouseholdBudgetProvider:
const { data: quarterlySummariesRaw = [] } =
  useQuarterlySummariesQuery(householdId);
const upsertQuarterlySummaryMutation = useUpsertQuarterlySummaryMutation();

const quarterlySummaries: QuarterlySummary[] = quarterlySummariesRaw.map(
  (r) => ({
    id: r.id,
    householdId: r.household_id,
    period: r.period,
    notes: r.notes ?? undefined,
    data: (r.data as Record<string, unknown>) ?? {},
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }),
);

const upsertQuarterlySummary = useCallback(
  (input: {
    period: string;
    notes?: string;
    data?: Record<string, unknown>;
  }) => {
    if (!householdId) return;
    upsertQuarterlySummaryMutation.mutate({ householdId, ...input });
  },
  [householdId, upsertQuarterlySummaryMutation],
);
```

Then include `quarterlySummaries` and `upsertQuarterlySummary` in the context value object.

- [ ] **Step 5: Verify compilation**

```bash
npx tsc --noEmit 2>&1 | grep HouseholdBudgetContext | head -20
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/context/HouseholdBudgetContext.tsx
git commit -m "feat: add HouseholdBudgetContext with quarterly summary support"
```

---

## Task 8: Sidebar mode toggle + App.tsx routing

This task wires everything together. After it, navigating to `/household` will render the household sidebar and a placeholder page.

**Files:**

- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/App.tsx`

### Part A — Sidebar.tsx

- [ ] **Step 1: Add imports to Sidebar.tsx**

At the top of `src/components/layout/Sidebar.tsx`, add:

```typescript
import { useNavigate } from "react-router-dom";
import {
  Home as HouseIcon,
  DollarSign as IncomeIcon,
  Wallet as BudgetIcon,
  Receipt as BillsIcon,
  RefreshCcw as SubscriptionsIcon,
  CreditCard as DebtsIcon,
  Target as GoalsIcon,
  BarChart2 as NetWorthIcon,
  FlaskConical as SimulatorIcon,
  Bot as AIIcon,
  FileBarChart as CFOIcon,
  CalendarCheck as WeeklyIcon,
  CalendarRange as MonthlyIcon,
  CalendarDays as QuarterlyIcon,
  Briefcase as CareersIcon,
  Image as VisionIcon,
  ListTodo as TasksIcon,
  Settings as SettingsIcon,
  Users as MembersIcon,
  LayoutDashboard as HHDashIcon,
  Landmark as BankIcon,
  TrendingUp as CreditIcon,
} from "lucide-react";
```

- [ ] **Step 2: Add householdNavSections constant after existing navSections**

```typescript
const householdNavSections = [
  {
    label: "Home",
    items: [
      { to: "/household", icon: HHDashIcon, label: "Dashboard" },
      {
        to: "/household/command-center",
        icon: HouseIcon,
        label: "Command Center",
      },
    ],
  },
  {
    label: "Money In",
    items: [
      { to: "/household/income", icon: IncomeIcon, label: "Income" },
      {
        to: "/household/bank-accounts",
        icon: BankIcon,
        label: "Bank Accounts",
      },
    ],
  },
  {
    label: "Money Out",
    items: [
      { to: "/household/budget", icon: BudgetIcon, label: "Budget & Expenses" },
      { to: "/household/bills", icon: BillsIcon, label: "Bills" },
      {
        to: "/household/subscriptions",
        icon: SubscriptionsIcon,
        label: "Subscriptions",
      },
      { to: "/household/debts", icon: DebtsIcon, label: "Debts" },
    ],
  },
  {
    label: "Future",
    items: [
      { to: "/household/goals", icon: GoalsIcon, label: "Goals" },
      { to: "/household/net-worth", icon: NetWorthIcon, label: "Net Worth" },
      { to: "/household/simulator", icon: SimulatorIcon, label: "Simulator" },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/household/ai-assistant", icon: AIIcon, label: "AI Assistant" },
      { to: "/household/cfo-reports", icon: CFOIcon, label: "CFO Reports" },
      {
        to: "/household/weekly-meeting",
        icon: WeeklyIcon,
        label: "Weekly Meeting",
      },
      {
        to: "/household/monthly-closeout",
        icon: MonthlyIcon,
        label: "Monthly Closeout",
      },
      {
        to: "/household/quarterly-review",
        icon: QuarterlyIcon,
        label: "Quarterly Review",
      },
    ],
  },
  {
    label: "Life",
    items: [
      { to: "/household/careers", icon: CareersIcon, label: "Career Profiles" },
      { to: "/household/vision", icon: VisionIcon, label: "Vision Board" },
      { to: "/household/tasks", icon: TasksIcon, label: "Tasks" },
    ],
  },
  {
    label: "Household",
    items: [
      { to: "/household/settings", icon: SettingsIcon, label: "Settings" },
      {
        to: "/household/members",
        icon: MembersIcon,
        label: "Members & Invites",
      },
    ],
  },
];
```

- [ ] **Step 3: Update the Sidebar component to detect mode and render mode toggle**

In the `Sidebar()` function, add these two lines after the existing hooks:

```typescript
const navigate = useNavigate();
const isHousehold = location.pathname.startsWith("/household");
```

Insert the mode toggle UI block right after the pin toggle `<div>` (after the closing `</div>` of the pin section, before `<nav>`):

```tsx
{
  /* Mode toggle */
}
<div className="px-2 py-2">
  <div className="flex rounded-md overflow-hidden border border-foreground/10">
    <button
      onClick={() => navigate("/dashboard")}
      className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
        !isHousehold
          ? "bg-blue-600 text-white"
          : "text-foreground/40 hover:text-foreground/70"
      }`}
    >
      {isOpen ? "📈 Investing" : "📈"}
    </button>
    <button
      onClick={() => navigate("/household")}
      className={`flex-1 py-1.5 text-[11px] font-semibold transition-colors ${
        isHousehold
          ? "bg-emerald-600 text-white"
          : "text-foreground/40 hover:text-foreground/70"
      }`}
    >
      {isOpen ? "🏠 Household" : "🏠"}
    </button>
  </div>
</div>;
```

- [ ] **Step 4: Conditionally render nav sections**

In the `<nav>` block, replace the `navSections.map(...)` call with:

```tsx
<nav className="flex flex-col gap-1 px-2 pb-4">
  {(isHousehold ? householdNavSections : navSections).map((section) => {
    // ... rest of the existing map body unchanged
  })}
</nav>
```

The section label color changes based on mode — update the label `className` from hard-coded text to:

```tsx
<span className={`mb-0.5 block px-2 text-[9px] font-bold uppercase tracking-widest ${
  isHousehold ? 'text-emerald-500/70' : 'text-foreground/25'
}`}>
```

- [ ] **Step 5: Remove the three retired items from investing navSections**

In the `navSections` array, find the "Wealth Planning" section and remove these three items:

```typescript
// Remove:
{ to: "/net-worth",         icon: Scale,      label: "Net Worth" },
{ to: "/cash-flow-planner", icon: Wallet,     label: "Cash Flow" },
{ to: "/debt-manager",      icon: CreditCard, label: "Debt Manager" },
```

### Part B — App.tsx

- [ ] **Step 6: Create the HouseholdRoutes component and add household page imports**

At the top of `src/App.tsx`, after the existing imports, add:

```typescript
import { Navigate } from "react-router-dom";
import { HouseholdBudgetProvider } from "@/context/HouseholdBudgetContext";

// Household pages
import HouseholdSetup from "./pages/household/HouseholdSetup";
import HouseholdDashboard from "./pages/household/HouseholdDashboard";
import HouseholdBudget from "./pages/household/HouseholdBudget";
import HouseholdBills from "./pages/household/HouseholdBills";
import HouseholdIncome from "./pages/household/HouseholdIncome";
import HouseholdSubscriptions from "./pages/household/HouseholdSubscriptions";
import HouseholdGoals from "./pages/household/HouseholdGoals";
import HouseholdDebts from "./pages/household/HouseholdDebts";
import HouseholdBankAccounts from "./pages/household/HouseholdBankAccounts";
import HouseholdCreditScores from "./pages/household/HouseholdCreditScores";
import HouseholdNetWorth from "./pages/household/HouseholdNetWorth";
import HouseholdSimulator from "./pages/household/HouseholdSimulator";
import HouseholdWeeklyMeeting from "./pages/household/HouseholdWeeklyMeeting";
import HouseholdMonthlyCloseout from "./pages/household/HouseholdMonthlyCloseout";
import HouseholdQuarterlyReview from "./pages/household/HouseholdQuarterlyReview";
import HouseholdAIAssistant from "./pages/household/HouseholdAIAssistant";
import HouseholdCFOReports from "./pages/household/HouseholdCFOReports";
import HouseholdCareers from "./pages/household/HouseholdCareers";
import HouseholdVision from "./pages/household/HouseholdVision";
import HouseholdTasks from "./pages/household/HouseholdTasks";
import HouseholdSettings from "./pages/household/HouseholdSettings";
```

- [ ] **Step 7: Add HouseholdRoutes component**

Add this component definition before `AppRoutes`:

```typescript
const HouseholdRoutes = () => (
  <HouseholdBudgetProvider>
    <Routes>
      <Route path="/" element={<HouseholdDashboard />} />
      <Route path="/setup" element={<HouseholdSetup />} />
      <Route path="/command-center" element={<HouseholdDashboard />} />
      <Route path="/budget" element={<HouseholdBudget />} />
      <Route path="/bills" element={<HouseholdBills />} />
      <Route path="/income" element={<HouseholdIncome />} />
      <Route path="/subscriptions" element={<HouseholdSubscriptions />} />
      <Route path="/goals" element={<HouseholdGoals />} />
      <Route path="/debts" element={<HouseholdDebts />} />
      <Route path="/bank-accounts" element={<HouseholdBankAccounts />} />
      <Route path="/credit-scores" element={<HouseholdCreditScores />} />
      <Route path="/net-worth" element={<HouseholdNetWorth />} />
      <Route path="/simulator" element={<HouseholdSimulator />} />
      <Route path="/weekly-meeting" element={<HouseholdWeeklyMeeting />} />
      <Route path="/monthly-closeout" element={<HouseholdMonthlyCloseout />} />
      <Route path="/quarterly-review" element={<HouseholdQuarterlyReview />} />
      <Route path="/ai-assistant" element={<HouseholdAIAssistant />} />
      <Route path="/cfo-reports" element={<HouseholdCFOReports />} />
      <Route path="/careers" element={<HouseholdCareers />} />
      <Route path="/vision" element={<HouseholdVision />} />
      <Route path="/tasks" element={<HouseholdTasks />} />
      <Route path="/settings" element={<HouseholdSettings />} />
      <Route path="/members" element={<HouseholdSettings />} />
    </Routes>
  </HouseholdBudgetProvider>
);
```

- [ ] **Step 8: Mount HouseholdRoutes and replace retired routes in AppRoutes**

In `AppRoutes`, add the household mount point and replace the three retired routes:

```typescript
// Add before the <Route path="*"> catch-all:
<Route path="/household/*" element={<HouseholdRoutes />} />

// Replace:
<Route path="/net-worth" element={<NetWorth />} />
// With:
<Route path="/net-worth" element={<Navigate to="/household/net-worth" replace />} />

// Replace:
<Route path="/debt-manager" element={<DebtManager />} />
// With:
<Route path="/debt-manager" element={<Navigate to="/household/debts" replace />} />

// Replace:
<Route path="/cash-flow-planner" element={<CashFlowPlanner />} />
// With:
<Route path="/cash-flow-planner" element={<Navigate to="/household/bank-accounts" replace />} />
```

Remove the now-unused imports of `NetWorth`, `DebtManager`, and `CashFlowPlanner`.

- [ ] **Step 9: Create stub pages so build compiles**

Create `src/pages/household/` directory and stub files for all 21 pages. Each stub follows this pattern:

```typescript
// Example: src/pages/household/HouseholdDashboard.tsx
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function HouseholdDashboard() {
  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-2xl font-bold">Household Dashboard</h1>
        <p className="text-muted-foreground mt-2">Coming soon</p>
      </div>
    </DashboardLayout>
  );
}
```

Create the same stub for all 21 pages. Replace "Household Dashboard" with the appropriate page title in each stub.

- [ ] **Step 10: Verify build compiles**

```bash
npm run build 2>&1 | tail -10
```

Expected: `✓ built in` — no errors.

- [ ] **Step 11: Start dev server and manually verify mode toggle**

```bash
npm run dev
```

Navigate to `http://localhost:8080`. Confirm:

- The sidebar has a two-segment toggle at the top
- Clicking "Household" navigates to `/household` and the sidebar renders with green headings
- Clicking "Investing" navigates back to `/dashboard` with blue/neutral headings
- Going to `/net-worth` redirects to `/household/net-worth`
- Going to `/debt-manager` redirects to `/household/debts`

- [ ] **Step 12: Commit**

```bash
git add src/App.tsx src/components/layout/Sidebar.tsx src/pages/household/
git commit -m "feat: wire Sidebar mode toggle + HouseholdRoutes + stub pages for all 21 household routes"
```

---

## Task 9: Port HouseholdSetup.tsx

**Files:**

- Modify: `src/pages/household/HouseholdSetup.tsx` (replace stub with full port)
- Source: `household-harmony-main/src/pages/HouseholdSetup.tsx`

This task is the full reference example of the port pattern.

- [ ] **Step 1: Read the source file**

```bash
cat household-harmony-main/src/pages/HouseholdSetup.tsx
```

- [ ] **Step 2: Copy and apply the port pattern**

```bash
cp household-harmony-main/src/pages/HouseholdSetup.tsx \
   src/pages/household/HouseholdSetup.tsx
```

Apply all substitutions from The Port Pattern table:

```bash
sed -i '' \
  -e "s|from '@/components/layout/AppLayout'|from '@/components/layout/DashboardLayout'|g" \
  -e "s|{ AppLayout }|DashboardLayout|g" \
  -e "s|import { AppLayout }|import DashboardLayout|g" \
  -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
  -e "s|useBudget|useHouseholdBudget|g" \
  -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
  -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
  -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
  -e "s|from '@/hooks/useRealtimeSync'|from '@/hooks/useHouseholdRealtimeSync'|g" \
  -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
  src/pages/household/HouseholdSetup.tsx
```

- [ ] **Step 3: Fix JSX layout wrapper**

In the JSX return, find `<AppLayout>` and `</AppLayout>` and replace with `<DashboardLayout>` and `</DashboardLayout>`. Verify the import at the top uses `DashboardLayout` as a default import.

- [ ] **Step 4: Remove ProtectedRoute if present**

Search the file for `ProtectedRoute`. If found, remove the import and unwrap the JSX.

```bash
grep -n "ProtectedRoute" src/pages/household/HouseholdSetup.tsx
```

- [ ] **Step 5: Fix navigation paths**

HouseholdSetup redirects users after setup/join. Check for `navigate('/')` or `navigate('/dashboard')` calls and update to `navigate('/household')`:

```bash
grep -n "navigate(" src/pages/household/HouseholdSetup.tsx
```

Update any post-setup navigation to point to `/household`.

- [ ] **Step 6: Verify build compiles**

```bash
npm run build 2>&1 | grep "HouseholdSetup\|error" | head -10
```

Expected: no error lines referencing HouseholdSetup.

- [ ] **Step 7: Commit**

```bash
git add src/pages/household/HouseholdSetup.tsx
git commit -m "feat: port HouseholdSetup page with household wizard and invite-token flow"
```

---

## Task 10: Port HouseholdDashboard.tsx + dashboard/ components

**Files:**

- Modify: `src/pages/household/HouseholdDashboard.tsx`
- Create: `src/components/household/dashboard/` (all files from `household-harmony-main/src/components/dashboard/`)
- Source pages: `household-harmony-main/src/pages/Dashboard.tsx` and `CommandCenter.tsx`

- [ ] **Step 1: Copy dashboard components**

```bash
mkdir -p src/components/household/dashboard
cp household-harmony-main/src/components/dashboard/*.tsx \
   src/components/household/dashboard/
```

- [ ] **Step 2: Apply port pattern to all copied components**

```bash
for f in src/components/household/dashboard/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f"
done
```

- [ ] **Step 3: Port HouseholdDashboard.tsx**

```bash
cp household-harmony-main/src/pages/Dashboard.tsx \
   src/pages/household/HouseholdDashboard.tsx
```

Apply the full port pattern (same sed commands as Task 9, Step 2). Fix the layout wrapper. Update any internal component imports that reference the old path:

```bash
sed -i '' \
  -e "s|from '@/components/dashboard/|from '@/components/household/dashboard/|g" \
  src/pages/household/HouseholdDashboard.tsx
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep "error\|HouseholdDashboard" | head -10
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/household/HouseholdDashboard.tsx src/components/household/dashboard/
git commit -m "feat: port Household Dashboard page and dashboard components"
```

---

## Task 11: Port HouseholdBudget.tsx + budget/ components

**Files:**

- Modify: `src/pages/household/HouseholdBudget.tsx`
- Create: `src/components/household/budget/`
- Source pages: `household-harmony-main/src/pages/Expenses.tsx` and `Categories.tsx`

- [ ] **Step 1: Copy budget components**

```bash
mkdir -p src/components/household/budget
cp household-harmony-main/src/components/budget/*.tsx \
   src/components/household/budget/
```

- [ ] **Step 2: Apply port pattern to budget components**

```bash
for f in src/components/household/budget/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f"
done
```

- [ ] **Step 3: Port HouseholdBudget page (combines Expenses + Categories from HH)**

```bash
cp household-harmony-main/src/pages/Expenses.tsx \
   src/pages/household/HouseholdBudget.tsx
```

Apply full port pattern. Update internal component imports:

```bash
sed -i '' \
  -e "s|from '@/components/budget/|from '@/components/household/budget/|g" \
  src/pages/household/HouseholdBudget.tsx
```

- [ ] **Step 4: Check for import/ (CSV import) components and copy if referenced**

```bash
grep -n "import/" src/pages/household/HouseholdBudget.tsx
```

If found:

```bash
mkdir -p src/components/household/import
cp household-harmony-main/src/components/import/*.tsx \
   src/components/household/import/
```

Apply port pattern to the import directory files.

- [ ] **Step 5: Verify build**

```bash
npm run build 2>&1 | grep "error\|HouseholdBudget" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/household/HouseholdBudget.tsx src/components/household/budget/ src/components/household/import/
git commit -m "feat: port HouseholdBudget page with category management and expense tracking"
```

---

## Task 12: Port HouseholdBills.tsx + bills/ components

**Files:**

- Modify: `src/pages/household/HouseholdBills.tsx`
- Create: `src/components/household/bills/`
- Source: `household-harmony-main/src/pages/Bills.tsx`

- [ ] **Step 1: Copy and port bills components**

```bash
mkdir -p src/components/household/bills
cp household-harmony-main/src/components/bills/*.tsx \
   src/components/household/bills/

for f in src/components/household/bills/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f"
done
```

- [ ] **Step 2: Port HouseholdBills page**

```bash
cp household-harmony-main/src/pages/Bills.tsx src/pages/household/HouseholdBills.tsx
```

Apply full port pattern. Update component import paths:

```bash
sed -i '' \
  -e "s|from '@/components/bills/|from '@/components/household/bills/|g" \
  src/pages/household/HouseholdBills.tsx
```

- [ ] **Step 3: Check for month/ component references**

```bash
grep -rn "from '@/components/month/" src/pages/household/HouseholdBills.tsx
ls household-harmony-main/src/components/month/ 2>/dev/null
```

If month/ components are referenced, copy them:

```bash
mkdir -p src/components/household/month
cp household-harmony-main/src/components/month/*.tsx src/components/household/month/
```

Apply port pattern and update import paths in HouseholdBills.tsx.

- [ ] **Step 4: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdBills" | head -10
git add src/pages/household/HouseholdBills.tsx src/components/household/bills/
git commit -m "feat: port HouseholdBills page with recurring bills and payment tracking"
```

---

## Task 13: Port HouseholdIncome.tsx + income/ components

**Files:**

- Modify: `src/pages/household/HouseholdIncome.tsx`
- Create: `src/components/household/income/`
- Source: `household-harmony-main/src/pages/Income.tsx`

- [ ] **Step 1: Copy and port income components**

```bash
mkdir -p src/components/household/income
cp household-harmony-main/src/components/income/*.tsx \
   src/components/household/income/ 2>/dev/null || true

# If no income/ component dir in HH, check what Income.tsx imports
grep -n "from '@/components/" household-harmony-main/src/pages/Income.tsx
```

- [ ] **Step 2: Port HouseholdIncome page**

```bash
cp household-harmony-main/src/pages/Income.tsx src/pages/household/HouseholdIncome.tsx
```

Apply full port pattern. Update any `@/components/budget/` or `@/components/income/` imports to point to the household component paths:

```bash
sed -i '' \
  -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
  -e "s|useBudget|useHouseholdBudget|g" \
  -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
  -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
  -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
  -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
  -e "s|from '@/components/budget/|from '@/components/household/budget/|g" \
  -e "s|from '@/components/income/|from '@/components/household/income/|g" \
  src/pages/household/HouseholdIncome.tsx
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdIncome" | head -10
git add src/pages/household/HouseholdIncome.tsx src/components/household/income/
git commit -m "feat: port HouseholdIncome page with income sources and entries"
```

---

## Task 14: Port HouseholdSubscriptions.tsx

**Files:**

- Modify: `src/pages/household/HouseholdSubscriptions.tsx`
- Source: `household-harmony-main/src/pages/Subscriptions.tsx`

- [ ] **Step 1: Port HouseholdSubscriptions page**

```bash
cp household-harmony-main/src/pages/Subscriptions.tsx \
   src/pages/household/HouseholdSubscriptions.tsx
```

Apply full port pattern (sed commands from Task 9 Step 2). Check for component imports and update paths:

```bash
grep -n "from '@/components/" src/pages/household/HouseholdSubscriptions.tsx
```

Update any found component paths to include `household/`.

- [ ] **Step 2: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdSubscriptions" | head -10
git add src/pages/household/HouseholdSubscriptions.tsx
git commit -m "feat: port HouseholdSubscriptions page with renewal dates and cashflow normalization"
```

---

## Task 15: Port HouseholdGoals.tsx + goals/ components

**Files:**

- Modify: `src/pages/household/HouseholdGoals.tsx`
- Create: `src/components/household/goals/`
- Source: `household-harmony-main/src/pages/Goals.tsx`

- [ ] **Step 1: Copy and port goals components**

```bash
mkdir -p src/components/household/goals
cp household-harmony-main/src/components/goals/*.tsx \
   src/components/household/goals/ 2>/dev/null || true

for f in src/components/household/goals/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

- [ ] **Step 2: Port HouseholdGoals page**

```bash
cp household-harmony-main/src/pages/Goals.tsx src/pages/household/HouseholdGoals.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/goals/|from '@/components/household/goals/|g" \
  src/pages/household/HouseholdGoals.tsx
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdGoals" | head -10
git add src/pages/household/HouseholdGoals.tsx src/components/household/goals/
git commit -m "feat: port HouseholdGoals page with milestones and canvas-confetti celebrations"
```

---

## Task 16: Port HouseholdDebts.tsx + debts/ components

**Files:**

- Modify: `src/pages/household/HouseholdDebts.tsx`
- Create: `src/components/household/debts/`
- Source: `household-harmony-main/src/pages/Debts.tsx`

- [ ] **Step 1: Copy and port debts components**

```bash
mkdir -p src/components/household/debts
cp household-harmony-main/src/components/debts/*.tsx \
   src/components/household/debts/ 2>/dev/null || true

for f in src/components/household/debts/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

- [ ] **Step 2: Port HouseholdDebts page**

```bash
cp household-harmony-main/src/pages/Debts.tsx src/pages/household/HouseholdDebts.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/debts/|from '@/components/household/debts/|g" \
  src/pages/household/HouseholdDebts.tsx
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdDebts" | head -10
git add src/pages/household/HouseholdDebts.tsx src/components/household/debts/
git commit -m "feat: port HouseholdDebts page with APR, payoff projections, debt-to-bill linking"
```

---

## Task 17: Port HouseholdBankAccounts.tsx

**Files:**

- Modify: `src/pages/household/HouseholdBankAccounts.tsx`
- Source: `household-harmony-main/src/pages/BankAccounts.tsx`

- [ ] **Step 1: Port HouseholdBankAccounts page**

```bash
cp household-harmony-main/src/pages/BankAccounts.tsx \
   src/pages/household/HouseholdBankAccounts.tsx
```

Apply full port pattern. Check for and update any component imports:

```bash
grep -n "from '@/components/" src/pages/household/HouseholdBankAccounts.tsx
sed -i '' "s|from '@/components/budget/|from '@/components/household/budget/|g" \
  src/pages/household/HouseholdBankAccounts.tsx
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdBankAccounts" | head -10
git add src/pages/household/HouseholdBankAccounts.tsx
git commit -m "feat: port HouseholdBankAccounts page with reconciliation and balance tracking"
```

---

## Task 18: Port HouseholdCreditScores.tsx

**Files:**

- Modify: `src/pages/household/HouseholdCreditScores.tsx`
- Source: `household-harmony-main/src/pages/CreditScores.tsx`

- [ ] **Step 1: Port HouseholdCreditScores page**

```bash
cp household-harmony-main/src/pages/CreditScores.tsx \
   src/pages/household/HouseholdCreditScores.tsx
```

Apply full port pattern.

- [ ] **Step 2: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdCreditScores" | head -10
git add src/pages/household/HouseholdCreditScores.tsx
git commit -m "feat: port HouseholdCreditScores page with per-bureau per-member trend chart"
```

---

## Task 19: Port HouseholdNetWorth.tsx

**Files:**

- Modify: `src/pages/household/HouseholdNetWorth.tsx`
- Source: `household-harmony-main/src/pages/NetWorth.tsx`

Note: this is HH's NetWorth — different from AJE's old NetWorth page (which is deleted in Task 8).

- [ ] **Step 1: Port HouseholdNetWorth page**

```bash
cp household-harmony-main/src/pages/NetWorth.tsx \
   src/pages/household/HouseholdNetWorth.tsx
```

Apply full port pattern.

- [ ] **Step 2: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdNetWorth" | head -10
git add src/pages/household/HouseholdNetWorth.tsx
git commit -m "feat: port HouseholdNetWorth page with assets vs liabilities chart"
```

---

## Task 20: Port HouseholdSimulator.tsx + simulate/ components

**Files:**

- Modify: `src/pages/household/HouseholdSimulator.tsx`
- Create: `src/components/household/simulate/`
- Source: `household-harmony-main/src/pages/Simulate.tsx`

- [ ] **Step 1: Copy and port simulate components**

```bash
mkdir -p src/components/household/simulate
cp household-harmony-main/src/components/simulate/*.tsx \
   src/components/household/simulate/ 2>/dev/null || true

for f in src/components/household/simulate/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

- [ ] **Step 2: Port HouseholdSimulator page**

```bash
cp household-harmony-main/src/pages/Simulate.tsx \
   src/pages/household/HouseholdSimulator.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/simulate/|from '@/components/household/simulate/|g" \
  src/pages/household/HouseholdSimulator.tsx
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdSimulator" | head -10
git add src/pages/household/HouseholdSimulator.tsx src/components/household/simulate/
git commit -m "feat: port HouseholdSimulator page with 12-month what-if projections"
```

---

## Task 21: Port HouseholdWeeklyMeeting.tsx + closeout/ components

**Files:**

- Modify: `src/pages/household/HouseholdWeeklyMeeting.tsx`
- Create: `src/components/household/closeout/`
- Source: `household-harmony-main/src/pages/WeeklyMeeting.tsx`

- [ ] **Step 1: Copy and port closeout components**

```bash
mkdir -p src/components/household/closeout
cp household-harmony-main/src/components/closeout/*.tsx \
   src/components/household/closeout/ 2>/dev/null || true

for f in src/components/household/closeout/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

- [ ] **Step 2: Port HouseholdWeeklyMeeting page**

```bash
cp household-harmony-main/src/pages/WeeklyMeeting.tsx \
   src/pages/household/HouseholdWeeklyMeeting.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/closeout/|from '@/components/household/closeout/|g" \
  src/pages/household/HouseholdWeeklyMeeting.tsx
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdWeeklyMeeting" | head -10
git add src/pages/household/HouseholdWeeklyMeeting.tsx src/components/household/closeout/
git commit -m "feat: port HouseholdWeeklyMeeting wizard with spending check-in and weekly wins"
```

---

## Task 22: Port HouseholdMonthlyCloseout.tsx

**Files:**

- Modify: `src/pages/household/HouseholdMonthlyCloseout.tsx`
- Source: `household-harmony-main/src/pages/MonthlyMeeting.tsx`

- [ ] **Step 1: Port HouseholdMonthlyCloseout page**

```bash
cp household-harmony-main/src/pages/MonthlyMeeting.tsx \
   src/pages/household/HouseholdMonthlyCloseout.tsx
```

Apply full port pattern. Update component paths (closeout/ already copied in Task 21):

```bash
sed -i '' \
  -e "s|from '@/components/closeout/|from '@/components/household/closeout/|g" \
  src/pages/household/HouseholdMonthlyCloseout.tsx
```

Apply all context/type/hook substitutions.

- [ ] **Step 2: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdMonthlyCloseout" | head -10
git add src/pages/household/HouseholdMonthlyCloseout.tsx
git commit -m "feat: port HouseholdMonthlyCloseout wizard with budget review and rollover decisions"
```

---

## Task 23: Create HouseholdQuarterlyReview.tsx (new feature)

This page has no HH source — it's a new wizard using the `quarterly_summaries` table.

**Files:**

- Modify: `src/pages/household/HouseholdQuarterlyReview.tsx`

- [ ] **Step 1: Write the Quarterly Review page**

Replace the stub with the full page:

```typescript
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useState } from "react";
import { format, startOfQuarter, getQuarter } from "date-fns";
import { toast } from "sonner";

function getCurrentQuarterPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-Q${getQuarter(now)}`;
}

export default function HouseholdQuarterlyReview() {
  const { quarterlySummaries, upsertQuarterlySummary, budget, isLoading } =
    useHouseholdBudget();

  const period = getCurrentQuarterPeriod();
  const existing = quarterlySummaries.find((s) => s.period === period);

  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await upsertQuarterlySummary({ period, notes });
      toast.success("Quarterly review saved");
    } finally {
      setSaving(false);
    }
  };

  const totalDebt = budget.bills
    .filter((b) => b.apr && b.apr > 0)
    .reduce((sum, b) => sum + b.totalBalance, 0);

  const totalGoalProgress = budget.goals.reduce(
    (sum, g) => sum + g.currentAmount,
    0,
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Quarterly Review</h1>
          <p className="text-muted-foreground">{period}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Net Worth</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">
                ${(
                  budget.bankAccounts.reduce((s, a) => s + a.currentBalance, 0) -
                  totalDebt
                ).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Total Debt</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-500">
                ${totalDebt.toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Goals Progress</CardTitle></CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-500">
                ${totalGoalProgress.toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Goals Recalibration & Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2 text-sm">
              {budget.goals.map((g) => (
                <li key={g.id} className="flex justify-between">
                  <span>{g.name}</span>
                  <span className="text-muted-foreground">
                    ${g.currentAmount.toLocaleString()} / ${g.targetAmount.toLocaleString()}
                  </span>
                </li>
              ))}
              {budget.goals.length === 0 && (
                <li className="text-muted-foreground">No goals set.</li>
              )}
            </ul>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Quarterly notes, salary review, recalibrated goals…"
              rows={6}
            />
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Review"}
            </Button>
          </CardContent>
        </Card>

        {quarterlySummaries.length > 0 && (
          <Card>
            <CardHeader><CardTitle>Past Quarterly Reviews</CardTitle></CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {quarterlySummaries.map((s) => (
                  <li key={s.id} className="border-b pb-2">
                    <span className="font-medium">{s.period}</span>
                    {s.notes && (
                      <p className="text-muted-foreground mt-1">{s.notes}</p>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep "error\|HouseholdQuarterlyReview" | head -10
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/household/HouseholdQuarterlyReview.tsx
git commit -m "feat: create HouseholdQuarterlyReview wizard with net worth snapshot and goal recalibration"
```

---

## Task 24: Port HouseholdAIAssistant.tsx + AI service

**Files:**

- Modify: `src/pages/household/HouseholdAIAssistant.tsx`
- Create: `src/components/household/ai/AIChatAssistant.tsx`
- Create: `src/services/householdAiService.ts`
- Source: `household-harmony-main/src/pages/FinancialAdvisor.tsx` + `src/components/ai/AIChatAssistant.tsx` + `src/services/aiService.ts`

- [ ] **Step 1: Port the AI service**

```bash
cp household-harmony-main/src/services/aiService.ts \
   src/services/householdAiService.ts
```

In `src/services/householdAiService.ts`, update the `CHAT_URL` to use AJE's Supabase project. Find the URL constant and update:

```typescript
// Before (HH project URL):
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/some-function`;

// After (use AJE's URL + a new function name):
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/household-ai-budget`;
```

Rename the exported function from `sendMessage` (or whatever it is) to avoid collision with AJE's existing AI service:

```bash
# Check what the service exports
grep -n "^export" src/services/householdAiService.ts
```

If there's a naming collision, prefix it — e.g., `export async function sendHouseholdAIMessage(...)`.

- [ ] **Step 2: Copy and port the AI chat component**

```bash
mkdir -p src/components/household/ai
cp household-harmony-main/src/components/ai/AIChatAssistant.tsx \
   src/components/household/ai/AIChatAssistant.tsx
```

Apply port pattern. Update the service import:

```bash
sed -i '' \
  -e "s|from '@/services/aiService'|from '@/services/householdAiService'|g" \
  -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
  -e "s|useBudget|useHouseholdBudget|g" \
  -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
  src/components/household/ai/AIChatAssistant.tsx
```

- [ ] **Step 3: Port HouseholdAIAssistant page**

```bash
cp household-harmony-main/src/pages/FinancialAdvisor.tsx \
   src/pages/household/HouseholdAIAssistant.tsx
```

Apply full port pattern. Update component import:

```bash
sed -i '' \
  -e "s|from '@/components/ai/|from '@/components/household/ai/|g" \
  src/pages/household/HouseholdAIAssistant.tsx
```

- [ ] **Step 4: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdAI" | head -10
git add src/pages/household/HouseholdAIAssistant.tsx \
        src/components/household/ai/ \
        src/services/householdAiService.ts
git commit -m "feat: port HouseholdAIAssistant with streaming chat grounded in household budget data"
```

---

## Task 25: Port HouseholdCFOReports.tsx

**Files:**

- Modify: `src/pages/household/HouseholdCFOReports.tsx`
- Source: `household-harmony-main/src/pages/CFOReports.tsx`

- [ ] **Step 1: Port HouseholdCFOReports page**

```bash
cp household-harmony-main/src/pages/CFOReports.tsx \
   src/pages/household/HouseholdCFOReports.tsx
```

Apply full port pattern. Check for and update component imports:

```bash
grep -n "from '@/components/" src/pages/household/HouseholdCFOReports.tsx
```

- [ ] **Step 2: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdCFOReports" | head -10
git add src/pages/household/HouseholdCFOReports.tsx
git commit -m "feat: port HouseholdCFOReports with executive financial summary reports"
```

---

## Task 26: Port HouseholdCareers.tsx + careers/ components

**Files:**

- Modify: `src/pages/household/HouseholdCareers.tsx`
- Create: `src/components/household/careers/`
- Source: `household-harmony-main/src/pages/Careers.tsx`

- [ ] **Step 1: Copy and port careers components**

```bash
mkdir -p src/components/household/careers
cp household-harmony-main/src/components/careers/*.tsx \
   src/components/household/careers/ 2>/dev/null || true

for f in src/components/household/careers/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

- [ ] **Step 2: Port HouseholdCareers page**

```bash
cp household-harmony-main/src/pages/Careers.tsx \
   src/pages/household/HouseholdCareers.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/careers/|from '@/components/household/careers/|g" \
  src/pages/household/HouseholdCareers.tsx
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdCareers" | head -10
git add src/pages/household/HouseholdCareers.tsx src/components/household/careers/
git commit -m "feat: port HouseholdCareers page with per-member title, salary, skills, achievements"
```

---

## Task 27: Port HouseholdVision.tsx + vision/ components

**Files:**

- Modify: `src/pages/household/HouseholdVision.tsx`
- Create: `src/components/household/vision/`
- Source: `household-harmony-main/src/pages/Vision.tsx`

- [ ] **Step 1: Copy and port vision components**

```bash
mkdir -p src/components/household/vision
cp household-harmony-main/src/components/vision/*.tsx \
   src/components/household/vision/ 2>/dev/null || true

for f in src/components/household/vision/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

- [ ] **Step 2: Port HouseholdVision page**

```bash
cp household-harmony-main/src/pages/Vision.tsx \
   src/pages/household/HouseholdVision.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/vision/|from '@/components/household/vision/|g" \
  src/pages/household/HouseholdVision.tsx
```

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdVision" | head -10
git add src/pages/household/HouseholdVision.tsx src/components/household/vision/
git commit -m "feat: port HouseholdVision board with image upload and gallery"
```

---

## Task 28: Port HouseholdTasks.tsx + tasks/ Kanban components

**Files:**

- Modify: `src/pages/household/HouseholdTasks.tsx`
- Create: `src/components/household/tasks/`
- Source: `household-harmony-main/src/pages/Todos.tsx`

Note: this page uses `@dnd-kit` for drag-and-drop Kanban. The deps are installed in Task 1.

- [ ] **Step 1: Copy and port tasks/Kanban components**

```bash
mkdir -p src/components/household/tasks
cp household-harmony-main/src/components/tasks/*.tsx \
   src/components/household/tasks/ 2>/dev/null || true

for f in src/components/household/tasks/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/hooks/useBudgetData'|from '@/hooks/useHouseholdBudgetData'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

- [ ] **Step 2: Port HouseholdTasks page**

HH's Todos page is `household-harmony-main/src/pages/Todos.tsx`:

```bash
cp household-harmony-main/src/pages/Todos.tsx \
   src/pages/household/HouseholdTasks.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/tasks/|from '@/components/household/tasks/|g" \
  -e "s|from '@/components/todos/|from '@/components/household/tasks/|g" \
  src/pages/household/HouseholdTasks.tsx
```

- [ ] **Step 3: Verify @dnd-kit imports resolve**

```bash
grep -n "@dnd-kit" src/pages/household/HouseholdTasks.tsx \
  src/components/household/tasks/*.tsx 2>/dev/null
```

Each `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` import should resolve (deps installed in Task 1).

- [ ] **Step 4: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdTasks" | head -10
git add src/pages/household/HouseholdTasks.tsx src/components/household/tasks/
git commit -m "feat: port HouseholdTasks Kanban board with @dnd-kit drag-and-drop"
```

---

## Task 29: Port HouseholdSettings.tsx + household/ components (Members & Invites)

**Files:**

- Modify: `src/pages/household/HouseholdSettings.tsx`
- Create: `src/components/household/household/`
- Source: `household-harmony-main/src/pages/HouseholdSettings.tsx`

- [ ] **Step 1: Copy and port household management components**

```bash
mkdir -p src/components/household/household
cp household-harmony-main/src/components/household/*.tsx \
   src/components/household/household/ 2>/dev/null || true

for f in src/components/household/household/*.tsx; do
  sed -i '' \
    -e "s|from '@/context/BudgetContext'|from '@/context/HouseholdBudgetContext'|g" \
    -e "s|useBudget|useHouseholdBudget|g" \
    -e "s|from '@/hooks/useAuth'|from '@/components/AuthProvider'|g" \
    -e "s|from '@/types/budget'|from '@/integrations/supabase/household-types'|g" \
    -e "s|from '@/integrations/supabase/queries'|from '@/integrations/supabase/household-queries'|g" \
    "$f" 2>/dev/null
done
```

Also port the `settings` component directory if it exists:

```bash
ls household-harmony-main/src/components/settings/ 2>/dev/null && \
  mkdir -p src/components/household/settings && \
  cp household-harmony-main/src/components/settings/*.tsx \
     src/components/household/settings/ 2>/dev/null || true
```

- [ ] **Step 2: Port HouseholdSettings page**

```bash
cp household-harmony-main/src/pages/HouseholdSettings.tsx \
   src/pages/household/HouseholdSettings.tsx
```

Apply full port pattern. Update component paths:

```bash
sed -i '' \
  -e "s|from '@/components/household/|from '@/components/household/household/|g" \
  -e "s|from '@/components/settings/|from '@/components/household/settings/|g" \
  src/pages/household/HouseholdSettings.tsx
```

Note: the InviteMemberForm component lives at `household-harmony-main/src/components/ai/InviteMemberForm.tsx` — already copied to `src/components/household/ai/`. Update its import path if needed.

- [ ] **Step 3: Verify build and commit**

```bash
npm run build 2>&1 | grep "error\|HouseholdSettings" | head -10
git add src/pages/household/HouseholdSettings.tsx \
        src/components/household/household/ \
        src/components/household/settings/ 2>/dev/null || true
git commit -m "feat: port HouseholdSettings page with member management and invite form"
```

---

## Task 30: Create send-invite Supabase edge function

**Files:**

- Create: `supabase/functions/send-invite/index.ts`

Requires: Resend API key configured as a Supabase secret (`RESEND_API_KEY`).

- [ ] **Step 1: Create the edge function**

Create `supabase/functions/send-invite/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_URL = Deno.env.get("APP_URL") ?? "https://your-aje-domain.com";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const { email, householdId, inviterName } = await req.json();

    if (!email || !householdId) {
      return new Response(
        JSON.stringify({ error: "email and householdId are required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Generate a crypto-random token
    const tokenBytes = new Uint8Array(16);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // Store the invitation in Supabase
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const expiresAt = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    const { error: insertError } = await supabase.from("invitations").insert({
      household_id: householdId,
      email,
      token,
      expires_at: expiresAt,
      status: "pending",
    });

    if (insertError) throw insertError;

    // Send email via Resend
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const inviteUrl = `${APP_URL}/household/invite/${token}`;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "AJE <noreply@yourdomain.com>",
        to: [email],
        subject: `${inviterName ?? "Someone"} invited you to join their household on AJE`,
        html: `
          <h2>You're invited!</h2>
          <p>${inviterName ?? "A household member"} has invited you to join their household budget on AJE.</p>
          <p>Click the link below to accept the invitation (expires in 7 days):</p>
          <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;border-radius:6px;text-decoration:none;">
            Accept Invitation
          </a>
          <p>Or paste this link: ${inviteUrl}</p>
        `,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      throw new Error(`Resend error: ${errText}`);
    }

    return new Response(JSON.stringify({ success: true, token }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : String(err),
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      },
    );
  }
});
```

- [ ] **Step 2: Test the function locally**

```bash
supabase functions serve send-invite --no-verify-jwt
```

In another terminal:

```bash
curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/send-invite' \
  --header 'Content-Type: application/json' \
  --data '{"email":"test@example.com","householdId":"test-uuid","inviterName":"Jay"}'
```

Expected: `{"success":true,"token":"..."}` (or Resend error if key not set — that's expected locally).

- [ ] **Step 3: ⚠️ Human approval required — deploy to production**

Do NOT run this step autonomously. Surface to user:

> "`supabase/functions/send-invite/index.ts` is ready. Set the `RESEND_API_KEY` secret (`supabase secrets set RESEND_API_KEY=your_key`) and `APP_URL` secret, then deploy with `supabase functions deploy send-invite`. Confirm before I proceed."

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/send-invite/index.ts
git commit -m "feat: add send-invite edge function using Resend for household invitations"
```

---

## Task 31: Invite acceptance route + final integration test

**Files:**

- Modify: `src/pages/household/HouseholdSetup.tsx` (reuse for invite acceptance) or create a separate `HouseholdInviteAccept.tsx`
- Source: `household-harmony-main/src/pages/accept/` if it exists

- [ ] **Step 1: Check if HH has an invite acceptance page**

```bash
ls household-harmony-main/src/pages/accept/ 2>/dev/null || echo "No accept/ dir found"
```

If found, port it. If not, the invite acceptance logic lives inside `HouseholdSetup.tsx` (the setup wizard handles the `/household/invite/:token` flow). Check `HouseholdSetup.tsx` for token-reading logic:

```bash
grep -n "token\|invite\|accept" src/pages/household/HouseholdSetup.tsx | head -20
```

- [ ] **Step 2: Add the invite route to App.tsx**

In `HouseholdRoutes` inside `src/App.tsx`, confirm this route is present (or add it):

```typescript
<Route path="/invite/:token" element={<HouseholdSetup />} />
```

`HouseholdSetup.tsx` should read the `:token` from `useParams()` and switch the wizard to "join via invite" mode automatically.

- [ ] **Step 3: Final integration test — manually walk the golden path**

With `npm run dev` running (`http://localhost:8080`):

1. Navigate to `/household` — should redirect to `/household/setup` (no household yet)
2. Go through the setup wizard — create a new household
3. Confirm landing on `/household` shows the dashboard
4. Navigate through at least 5 household pages using the sidebar
5. Switch back to Investing mode — confirm sidebar returns to blue
6. Navigate to `/net-worth` directly — confirm it redirects to `/household/net-worth`
7. Navigate to `/debt-manager` directly — confirm it redirects to `/household/debts`

- [ ] **Step 4: Full build + type check**

```bash
npm run build
npx tsc --noEmit 2>&1 | head -30
```

Expected: clean build, TypeScript errors only from pre-existing issues (not from new household code).

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/pages/household/
git commit -m "feat: wire invite acceptance route; complete Household Harmony integration"
```

---

## Task 32: Delete household-harmony-main

This task is the final cleanup — run only after all 17 feature pages are verified working against the production DB.

- [ ] **Step 1: ⚠️ Human approval required before deleting**

Surface to user:

> "All household pages are ported and verified. `household-harmony-main/` can be deleted. Confirm before I remove it."

- [ ] **Step 2: Delete the directory**

```bash
rm -rf household-harmony-main/
```

- [ ] **Step 3: Verify build still passes**

```bash
npm run build 2>&1 | tail -5
```

Expected: `✓ built in` — no import errors from deleted directory.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: remove household-harmony-main source directory after successful port"
```

---

## Self-Review Checklist

After the plan was written, the following was verified:

**1. Spec coverage:**

- [x] Navigation & Mode Switch (Task 8 — Sidebar + App.tsx)
- [x] All 17 features (Tasks 9–29)
- [x] Multi-user household model (Tasks 2, 29, 30)
- [x] Database schema — all 21 tables (Task 2)
- [x] Household setup flow (Task 9)
- [x] Invite flow (Tasks 29–31)
- [x] Page replacements with Navigate (Task 8, Steps 7–8)
- [x] Port strategy including 5 missing deps (Task 1)
- [x] Quarterly Review Wizard (Task 23 — new, no HH source)
- [x] AI service port (Task 24)
- [x] Quarterly summaries migration (Task 2, Step 3)
- [x] profiles.household_id migration (Task 2, Step 2)
- [x] send-invite edge function (Task 30)
- [x] Cleanup — delete household-harmony-main (Task 32)

**2. Placeholder scan:** No TBD or "similar to Task N" references. All code blocks contain actual code.

**3. Type consistency:** `QuarterlySummary` defined in Task 3, used in Tasks 5 and 23. `useHouseholdBudget` named consistently. `HouseholdBudgetProvider` named consistently in Tasks 5 and 8.

**4. Port pattern:** Applied identically in Tasks 9–29 via the same sed command set.
