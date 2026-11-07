// React Query hooks for the coach plan. Reads and writes go through the typed wrapper (RLS scopes every row to the
// caller). Demo mode never touches the database: reads return the sandbox plan and writes are no-ops with a toast.
import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPlan } from "@/data/sandboxPlan";
import { coachDb } from "@/lib/coachDb";
import type { NextMove } from "@/lib/wealthLadder";
import { computeEarnTrack, type EarnTrack } from "@/lib/earnTrack";
import type { ActionProposal, CoachPlan, ItemProposal, PlanSection, StrategyActionRow, StrategyItemRow, StrategyRow } from "@/lib/coachTypes";

export const DEMO_TOAST = "Demo mode: changes are not saved";

export function useCoachKey(kind: string, ...rest: unknown[]) {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  return { key: ["coach", kind, user?.id, isDemoMode ? "demo" : "live", ...rest] as unknown[], uid: user?.id, demo: isDemoMode };
}

export const sortActions = (a: StrategyActionRow[]): StrategyActionRow[] =>
  [...a].sort((x, y) => x.priority - y.priority || x.created_at.localeCompare(y.created_at));

export function useStrategy() {
  const { key, uid, demo } = useCoachKey("strategy");
  return useQuery<StrategyRow | null>({
    queryKey: key,
    enabled: demo || !!uid,
    queryFn: async () => {
      if (demo) return sandboxPlan.strategy;
      const { data, error } = await coachDb.from("user_strategy").select("*").maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** Live (not archived) items, optionally for one section. */
export function useStrategyItems(section?: PlanSection) {
  const { key, uid, demo } = useCoachKey("items");
  const q = useQuery<StrategyItemRow[]>({
    queryKey: key,
    enabled: demo || !!uid,
    queryFn: async () => {
      if (demo) return sandboxPlan.items;
      const { data, error } = await coachDb.from("strategy_items").select("*").limit(200);
      if (error) throw new Error(error.message);
      return (data ?? []).filter((r) => !r.archived_at).sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
    },
  });
  const data = useMemo(() => (section ? q.data?.filter((i) => i.section === section) : q.data), [q.data, section]);
  return { ...q, data };
}

/** Live actions sorted by priority (1 first), then created_at. */
export function useStrategyActions() {
  const { key, uid, demo } = useCoachKey("actions");
  const q = useQuery<StrategyActionRow[]>({
    queryKey: key,
    enabled: demo || !!uid,
    queryFn: async () => {
      if (demo) return sortActions(sandboxPlan.actions);
      const { data, error } = await coachDb.from("strategy_actions").select("*").limit(100);
      if (error) throw new Error(error.message);
      return sortActions((data ?? []).filter((r) => !r.archived_at));
    },
  });
  return q;
}

export interface PlanSummary {
  loading: boolean;
  active: boolean;
  plan: CoachPlan;
  openActions: StrategyActionRow[];
  topAction: StrategyActionRow | null;
  planMove: Pick<NextMove, "title" | "why"> | null;
  earn: EarnTrack;
}

export function summarizePlan(plan: CoachPlan): Omit<PlanSummary, "loading"> {
  const active = plan.strategy?.status === "active";
  const openActions = sortActions(plan.actions).filter((a) => a.status === "todo");
  const topAction = openActions[0] ?? null;
  const gainOf = (a: StrategyActionRow): number | undefined => {
    const m = plan.items.find((i) => i.id === a.linked_item_id)?.metrics?.monthly_gain_estimate;
    return typeof m === "number" ? m : undefined;
  };
  const earn = computeEarnTrack({
    planActive: active,
    incomeItems: plan.items
      .filter((i) => i.section === "income")
      .map((i) => ({
        title: i.title,
        body: i.body,
        effort: typeof i.metrics?.effort === "string" ? i.metrics.effort : undefined,
        monthlyGain: typeof i.metrics?.monthly_gain_estimate === "number" ? i.metrics.monthly_gain_estimate : undefined,
      })),
    earnActions: sortActions(plan.actions)
      .filter((a) => a.track === "earn")
      .map((a) => ({ title: a.title, status: a.status, monthlyGain: gainOf(a) })),
  });
  return {
    active,
    plan,
    openActions,
    topAction,
    planMove: active && topAction ? { title: topAction.title, why: topAction.detail || "It is the top step in your plan." } : null,
    earn,
  };
}

export function usePlanSummary(): PlanSummary {
  const s = useStrategy();
  const i = useStrategyItems();
  const a = useStrategyActions();
  return useMemo(
    () => ({ loading: s.isLoading || i.isLoading || a.isLoading, ...summarizePlan({ strategy: s.data ?? null, items: i.data ?? [], actions: a.data ?? [] }) }),
    [s.data, i.data, a.data, s.isLoading, i.isLoading, a.isLoading],
  );
}

function usePlanInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["coach"] });
}

type ItemPatch = Partial<Pick<StrategyItemRow, "title" | "body" | "impact" | "metrics">>;

export function useUpdateItem() {
  const { demo } = useCoachKey("m");
  const invalidate = usePlanInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; patch: ItemPatch }) => {
      if (demo) return void toast.info(DEMO_TOAST);
      const { error } = await coachDb.from("strategy_items").update(v.patch).eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useCreateItem() {
  const { demo, uid } = useCoachKey("m");
  const invalidate = usePlanInvalidate();
  return useMutation({
    mutationFn: async (v: { section: PlanSection; title: string; body?: string }) => {
      if (demo) return void toast.info(DEMO_TOAST);
      // user_id only satisfies the RLS WITH CHECK; the policy rejects any other value.
      const { error } = await coachDb.from("strategy_items").insert({ user_id: uid, section: v.section, title: v.title, body: v.body ?? "", source: "user" });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
}

/** AI rows are tombstoned (so a later revision cannot bring them back); user rows are deleted. */
export function useArchiveItem() {
  const { demo } = useCoachKey("m");
  const invalidate = usePlanInvalidate();
  return useMutation({
    mutationFn: async (item: Pick<StrategyItemRow, "id" | "source">) => {
      if (demo) return void toast.info(DEMO_TOAST);
      const r =
        item.source === "ai"
          ? await coachDb.from("strategy_items").update({ archived_at: new Date().toISOString() }).eq("id", item.id)
          : await coachDb.from("strategy_items").delete().eq("id", item.id);
      if (r.error) throw new Error(r.error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useToggleAction() {
  const { demo } = useCoachKey("m");
  const invalidate = usePlanInvalidate();
  return useMutation({
    mutationFn: async (v: { id: string; done: boolean }) => {
      if (demo) return void toast.info(DEMO_TOAST);
      const { error } = await coachDb
        .from("strategy_actions")
        .update({ status: v.done ? "done" : "todo", completed_at: v.done ? new Date().toISOString() : null })
        .eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useResolveProposal() {
  const { demo } = useCoachKey("m");
  const invalidate = usePlanInvalidate();
  return useMutation({
    mutationFn: async (v: { kind: "item" | "action" | "summary"; id: string; accept: boolean }) => {
      if (demo) return void toast.info(DEMO_TOAST);
      const { error } = await coachDb.rpc("resolve_strategy_proposal", { p_kind: v.kind, p_id: v.id, p_accept: v.accept });
      if (error) throw new Error(error.message);
    },
    onSuccess: invalidate,
    onError: (e: Error) => toast.error(e.message),
  });
}

export type { ActionProposal, ItemProposal };
