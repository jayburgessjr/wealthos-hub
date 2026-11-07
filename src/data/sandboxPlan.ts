// Fixed sample plan for demo visitors. Never saved anywhere; hooks return this without touching the database.
import type { CoachPlan, StrategyActionRow, StrategyItemRow } from "@/lib/coachTypes";

const T = "2026-01-01T00:00:00.000Z";
const item = (o: Partial<StrategyItemRow> & Pick<StrategyItemRow, "id" | "section" | "title">): StrategyItemRow => ({
  user_id: "demo",
  ai_key: o.id,
  body: "",
  metrics: {},
  impact: null,
  position: 0,
  source: "ai",
  edited_by_user: false,
  pending_ai_proposal: null,
  archived_at: null,
  created_at: T,
  updated_at: T,
  ...o,
});
const action = (o: Partial<StrategyActionRow> & Pick<StrategyActionRow, "id" | "title" | "priority">): StrategyActionRow => ({
  user_id: "demo",
  ai_key: o.id,
  detail: "",
  track: "general",
  status: "todo",
  due_hint: null,
  linked_item_id: null,
  source: "ai",
  edited_by_user: false,
  pending_ai_proposal: null,
  archived_at: null,
  completed_at: null,
  created_at: T,
  updated_at: T,
  ...o,
});

export const sandboxPlan: CoachPlan = {
  strategy: {
    id: "demo-strategy",
    user_id: "demo",
    status: "active",
    primary_goal: "Build a starter fund and pay off a credit card",
    time_horizon_years: 5,
    risk_tolerance: "conservative",
    profile: { monthly_income: 2400 },
    profile_locked: [],
    summary: "Sample plan: start small, clear the expensive debt, then build steady habits.",
    summary_edited: false,
    summary_proposal: null,
    version: 1,
    last_ai_update_at: T,
    onboarding_hints_used: true,
    created_at: T,
    updated_at: T,
  },
  items: [
    item({ id: "starter", section: "wealth", title: "Build a $500 starter fund", body: "A small cushion keeps surprises off your credit card." }),
    item({ id: "index", section: "invest", title: "Low-cost broad index fund, later", body: "Once the card is paid off, a broad index fund is a simple place to begin." }),
    item({ id: "side-work", section: "income", title: "Weekend side work", body: "First step: list one skill someone nearby would pay for.", metrics: { monthly_gain_estimate: 150 }, impact: 3 }),
    item({ id: "card", section: "gap", title: "Credit card interest", body: "High interest eats progress.", impact: 5 }),
  ],
  actions: [
    action({ id: "a2", title: "Set up an automatic $25 transfer", priority: 2, track: "save", created_at: "2026-01-01T00:00:02.000Z" }),
    action({ id: "a1", title: "List your debts with their rates", priority: 1, track: "debt", created_at: "2026-01-01T00:00:01.000Z" }),
    action({ id: "a3", title: "List one skill you could offer", priority: 3, track: "earn", linked_item_id: "side-work", created_at: "2026-01-01T00:00:03.000Z" }),
  ],
};
