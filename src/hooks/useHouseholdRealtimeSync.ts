import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { budgetKeys } from "./useHouseholdBudgetData";

const REALTIME_TABLES = [
  "expenses",
  "income_entries",
  "bills",
  "subscriptions",
  "categories",
  "goals",
  "bank_accounts",
  "credit_scores",
  "income_sources",
] as const;

type RealtimeTable = (typeof REALTIME_TABLES)[number];

/**
 * Hook to sync data in real-time across browser tabs using Supabase Realtime.
 * Invalidates relevant queries when database changes are detected.
 *
 * Channel name includes householdId so multiple households don't share a channel.
 */
export function useHouseholdRealtimeSync(
  householdId: string | null,
  monthISO: string,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!householdId) return;

    const channel = supabase
      .channel(`budget-realtime-sync-${householdId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          filter: `household_id=eq.${householdId}`,
        },
        (payload) => {
          const table = payload.table as RealtimeTable;

          // Invalidate specific queries based on the table that changed
          switch (table) {
            case "expenses":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.expenses(householdId, monthISO),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "income_entries":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.incomeEntries(householdId, monthISO),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "bills":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.bills(householdId),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "subscriptions":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.subscriptions(householdId),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "categories":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.categories(householdId),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "goals":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.goals(householdId),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "bank_accounts":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.bankAccounts(householdId),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "credit_scores":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.creditScores(householdId),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            case "income_sources":
              queryClient.invalidateQueries({
                queryKey: budgetKeys.incomeSources(householdId),
              });
              queryClient.invalidateQueries({
                queryKey: budgetKeys.detail(householdId, monthISO),
              });
              break;
            default:
              // Fallback: invalidate all household budget queries
              queryClient.invalidateQueries({ queryKey: budgetKeys.all });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, monthISO, queryClient]);
}
