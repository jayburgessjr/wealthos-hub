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
    queryFn: () => deskRows<SignalRow>(deskDb("desk_signals").select("*").order("created_at", { ascending: false }).limit(60)),
    refetchInterval: 60_000,
  });
}

export function useTheses() {
  return useQuery({
    queryKey: [KEY, "theses"],
    queryFn: () => deskRows<ThesisRow>(deskDb("desk_theses").select("*").order("created_at", { ascending: false }).limit(200)),
  });
}

export function usePendingProposals() {
  return useQuery({
    queryKey: [KEY, "proposals"],
    queryFn: () => deskRows<ProposedOrderRow>(deskDb("desk_proposed_orders").select("*").eq("status", "pending").order("created_at", { ascending: false })),
    refetchInterval: 30_000,
  });
}

export function useOpenPositions() {
  return useQuery({
    queryKey: [KEY, "positions"],
    queryFn: () => deskRows<PositionRow>(deskDb("desk_positions").select("*").eq("status", "open").order("opened_at", { ascending: false })),
    refetchInterval: 30_000,
  });
}

export function useJournal() {
  return useQuery({
    queryKey: [KEY, "journal"],
    queryFn: () => deskRows<JournalRow>(deskDb("desk_journal").select("*").order("created_at", { ascending: false }).limit(50)),
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
    queryFn: () => deskRows<ScorecardRow>(deskDb("desk_scorecard").select("*").order("tn_date", { ascending: true })),
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
  order?: { id: string; status: string; broker_order_id: string | null; filled_qty: number; avg_fill_price: number | null };
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
