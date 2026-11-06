// Typed access to desk_* tables. Generated Supabase types do not include them, so the table name is cast once here.
import { supabase } from "@/integrations/supabase/client";

export type DeskTable =
  | "desk_state"
  | "desk_instruments"
  | "desk_signals"
  | "desk_theses"
  | "desk_proposed_orders"
  | "desk_orders"
  | "desk_positions"
  | "desk_journal"
  | "desk_scorecard"
  | "desk_risk_events"
  | "desk_agent_runs";

export interface DeskChain extends PromiseLike<{ data: unknown; error: { message: string } | null }> {
  eq(column: string, value: unknown): DeskChain;
  order(column: string, opts?: { ascending?: boolean }): DeskChain;
  limit(count: number): DeskChain;
  select(columns?: string): DeskChain;
}

export interface DeskTableApi {
  select(columns?: string): DeskChain;
  insert(values: Record<string, unknown>): DeskChain;
  update(values: Record<string, unknown>): DeskChain;
}

export const deskDb = (table: DeskTable): DeskTableApi => supabase.from(table as never) as unknown as DeskTableApi;

export async function deskRows<T>(chain: DeskChain): Promise<T[]> {
  const { data, error } = await chain;
  if (error) throw new Error(error.message);
  return (data ?? []) as T[];
}

export interface FnResult {
  ok?: boolean;
  error?: string;
}

/** Calls a desk edge function with the owner JWT. Throws on transport errors; callers inspect `ok` themselves. */
export async function invokeDesk<T extends FnResult>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    let message = error.message;
    const ctx = (error as { context?: { json?: () => Promise<unknown> } }).context;
    if (ctx?.json) {
      try {
        const parsed = (await ctx.json()) as FnResult | null;
        if (parsed?.error) message = parsed.error;
      } catch {
        // keep the transport message
      }
    }
    throw new Error(message);
  }
  return data as T;
}
