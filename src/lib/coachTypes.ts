// Hand-written row types for the AI coach tables. src/integrations/supabase/types.ts is generated and must not be
// hand-edited; delete this file and coachDb.ts once `supabase gen types` includes the 20261112 migration.

export const PLAN_SECTIONS = ["wealth", "invest", "opportunity", "gap", "income"] as const;
export type PlanSection = (typeof PLAN_SECTIONS)[number];
export const ACTION_TRACKS = ["general", "save", "debt", "invest", "earn", "protect"] as const;
export type ActionTrack = (typeof ACTION_TRACKS)[number];

export interface ItemProposal {
  title: string;
  body: string;
  metrics?: Record<string, string | number>;
  impact?: number | null;
}
export interface ActionProposal {
  title: string;
  detail: string;
  priority: number;
  due_hint?: string | null;
  track: ActionTrack;
}

export interface StrategyRow {
  id: string;
  user_id: string;
  status: "interviewing" | "active";
  primary_goal: string | null;
  time_horizon_years: number | null;
  risk_tolerance: "conservative" | "moderate" | "aggressive" | null;
  profile: Record<string, string | number>;
  profile_locked: string[];
  summary: string | null;
  summary_edited: boolean;
  summary_proposal: string | null;
  version: number;
  last_ai_update_at: string | null;
  onboarding_hints_used: boolean;
  created_at: string;
  updated_at: string;
}

export interface StrategyItemRow {
  id: string;
  user_id: string;
  section: PlanSection;
  ai_key: string | null;
  title: string;
  body: string;
  metrics: Record<string, string | number>;
  impact: number | null;
  position: number;
  source: "ai" | "user";
  edited_by_user: boolean;
  pending_ai_proposal: ItemProposal | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyActionRow {
  id: string;
  user_id: string;
  ai_key: string | null;
  title: string;
  detail: string;
  priority: number;
  track: ActionTrack;
  status: "todo" | "done" | "dismissed";
  due_hint: string | null;
  linked_item_id: string | null;
  source: "ai" | "user";
  edited_by_user: boolean;
  pending_ai_proposal: ActionProposal | null;
  archived_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StrategyMessageRow {
  id: string;
  user_id: string;
  role: "user" | "assistant";
  content: string;
  client_msg_id: string | null;
  created_at: string;
}

/** Plan data as the UI consumes it (live rows only, actions sorted by priority then created_at). */
export interface CoachPlan {
  strategy: StrategyRow | null;
  items: StrategyItemRow[];
  actions: StrategyActionRow[];
}
