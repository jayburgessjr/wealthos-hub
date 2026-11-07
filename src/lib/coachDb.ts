// Typed wrapper for the coach tables and RPCs. The generated Database type does not know them yet, so this file holds
// the ONE cast (supabase as unknown as TypedCoachClient). It exposes only these tables and RPCs. Delete it when
// src/integrations/supabase/types.ts is regenerated from the 20261112 migration.
import { supabase } from "@/integrations/supabase/client";
import type { StrategyActionRow, StrategyItemRow, StrategyMessageRow, StrategyRow } from "@/lib/coachTypes";

export interface CoachTables {
  user_strategy: StrategyRow;
  strategy_items: StrategyItemRow;
  strategy_actions: StrategyActionRow;
  strategy_messages: StrategyMessageRow;
}

export interface DbError {
  message: string;
}
export interface ListResult<R> {
  data: R[] | null;
  error: DbError | null;
}
export interface OneResult<R> {
  data: R | null;
  error: DbError | null;
}

export interface CoachQuery<R> extends PromiseLike<ListResult<R>> {
  select(columns?: string): CoachQuery<R>;
  eq(column: keyof R & string, value: unknown): CoachQuery<R>;
  order(column: keyof R & string, opts?: { ascending?: boolean }): CoachQuery<R>;
  limit(n: number): CoachQuery<R>;
  insert(values: Partial<R> | Partial<R>[]): CoachQuery<R>;
  update(values: Partial<R>): CoachQuery<R>;
  upsert(values: Partial<R>, opts?: { onConflict?: string }): CoachQuery<R>;
  delete(): CoachQuery<R>;
  maybeSingle(): PromiseLike<OneResult<R>>;
  single(): PromiseLike<OneResult<R>>;
}

export interface CoachRpcs {
  apply_strategy_update: { args: { p_update: unknown }; returns: { version: number; applied: number; proposed: number; skipped: number; removed: number } };
  resolve_strategy_proposal: { args: { p_kind: "item" | "action" | "summary"; p_id: string; p_accept: boolean }; returns: null };
}

export interface TypedCoachClient {
  from<T extends keyof CoachTables>(table: T): CoachQuery<CoachTables[T]>;
  rpc<F extends keyof CoachRpcs>(fn: F, args: CoachRpcs[F]["args"]): PromiseLike<{ data: CoachRpcs[F]["returns"] | null; error: DbError | null }>;
}

export const coachDb = supabase as unknown as TypedCoachClient;
