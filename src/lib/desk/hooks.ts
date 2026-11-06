import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { deskDb, deskRows, invokeDesk, type FnResult } from "./db";
import type { RiskDecision } from "../../../supabase/functions/_shared/desk/risk/engine.ts";
import type { DeskAccount, InstrumentRow, JournalRow, PositionRow, ProposedOrderRow, ScorecardRow, SignalRow, ThesisRow } from "./types";

const KEY = "desk";

export function useIsOwner() {
  return useQuery({
    queryKey: [KEY, "owner"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_desk_owner" as never);
      if (error) throw new Error(error.message);
      return data === true;
    },
    staleTime: 60_000,
  });
}

export function useClaimOwner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await invokeDesk<FnResult & { owner?: boolean }>("desk-claim-owner", {});
      if (!res.ok) throw new Error(res.error ?? "Could not claim the desk.");
      if (res.owner !== true) throw new Error("This account is not the desk owner.");
      return res;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "owner"] }),
  });
}

export function useAccount() {
  return useQuery({
    queryKey: [KEY, "account"],
    queryFn: async () => {
      const res = await invokeDesk<DeskAccount>("desk-account", {});
      if (!res.ok) throw new Error(res.error ?? "Account data unavailable.");
      return res;
    },
    refetchInterval: 30_000,
  });
}

export function useInstruments() {
  return useQuery({
    queryKey: [KEY, "instruments"],
    queryFn: () => deskRows<InstrumentRow>(deskDb("desk_instruments").select("id,symbol,asset_class,name")),
  });
}

export function useSignals() {
  return useQuery({
    queryKey: [KEY, "signals"],
    queryFn: () => deskRows<SignalRow>(deskDb("desk_signals").select("id, instrument_id, agent_name, kind, direction, strength, summary, source_links, created_at").order("created_at", { ascending: false }).limit(60)),
    refetchInterval: 60_000,
  });
}

export function useTheses() {
  return useQuery({
    queryKey: [KEY, "theses"],
    queryFn: () => deskRows<ThesisRow>(deskDb("desk_theses").select("id, instrument_id, agent_name, direction, bull_case, bear_case, catalysts, entry_price, stop_price, target_price, confidence, invalidation, horizon_days, created_at").order("created_at", { ascending: false }).limit(200)),
  });
}

export function usePendingProposals() {
  return useQuery({
    queryKey: [KEY, "proposals"],
    queryFn: () => deskRows<ProposedOrderRow>(deskDb("desk_proposed_orders").select("id, thesis_id, instrument_id, agent_name, intent, position_id, structure, side, qty, order_type, limit_price, legs, stop_price, stop_basis, target_price, max_loss, rationale, status, expires_at, created_at").eq("status", "pending").order("created_at", { ascending: false }).limit(100)),
    refetchInterval: 30_000,
  });
}

export function useOpenPositions() {
  return useQuery({
    queryKey: [KEY, "positions"],
    queryFn: () => deskRows<PositionRow>(deskDb("desk_positions").select("id, position_group, instrument_id, agent_name, mode, structure, legs, qty, avg_price, stop_price, target_price, max_loss, exposure, mark_price, status, opened_at").eq("status", "open").order("opened_at", { ascending: false }).limit(200)),
    refetchInterval: 30_000,
  });
}

export function useJournal() {
  return useQuery({
    queryKey: [KEY, "journal"],
    queryFn: () => deskRows<JournalRow>(deskDb("desk_journal").select("id, author, entry_type, body, tags, created_at").order("created_at", { ascending: false }).limit(50)),
  });
}

export function useAddJournal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: string) => {
      await deskRows(deskDb("desk_journal").insert({ author: "owner", entry_type: "note", body }));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "journal"] }),
  });
}

export function useScorecardRows() {
  return useQuery({
    queryKey: [KEY, "scorecard"],
    queryFn: () => deskRows<ScorecardRow>(deskDb("desk_scorecard").select("id, subject_kind, subject_id, agent_name, horizon_days, tn_date, return_pct, benchmark_return_pct, alpha_pct").order("tn_date", { ascending: true }).limit(5000)),
  });
}

export function useResetKillSwitch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (note: string) => {
      const res = await invokeDesk<FnResult>("desk-reset-kill-switch", { note });
      if (!res.ok) throw new Error(res.error ?? "Reset failed.");
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "account"] }),
  });
}

export interface DecideParams {
  proposed_order_id: string;
  decision: "approved" | "rejected";
  live_confirmation?: string;
}

export interface DecideResult extends FnResult {
  decision?: "approved" | "rejected";
  risk?: RiskDecision;
  order?: { id: string; status: string; brokerOrderId?: string; filledQty: number; avgFillPrice?: number };
}

/** Sends ONLY proposed_order_id, decision and (live only) live_confirmation. The server recomputes risk. */
export function decideOrder(p: DecideParams): Promise<DecideResult> {
  const body: Record<string, unknown> = { proposed_order_id: p.proposed_order_id, decision: p.decision };
  if (p.live_confirmation !== undefined) body.live_confirmation = p.live_confirmation;
  return invokeDesk<DecideResult>("desk-approve-order", body);
}

export function useDecideOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: decideOrder,
    onSettled: () => {
      qc.invalidateQueries({ queryKey: [KEY, "proposals"] });
      qc.invalidateQueries({ queryKey: [KEY, "positions"] });
      qc.invalidateQueries({ queryKey: [KEY, "account"] });
    },
  });
}

export function usePatchProposal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; qty: number; limit_price: number | null; stop_price: number; target_price: number | null }) => {
      const { id, ...values } = v;
      await deskRows(deskDb("desk_proposed_orders").update(values).eq("id", id).eq("status", "pending"));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY, "proposals"] }),
  });
}
