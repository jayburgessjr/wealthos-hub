import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { BillPayment } from "@/components/household/bills/BillPaymentAllocation";

export const billPaymentKeys = {
  all: ["bill-payments"] as const,
  list: (householdId: string) => ["bill-payments", householdId] as const,
};

export function useBillPaymentsQuery(householdId: string | null) {
  return useQuery<BillPayment[], Error>({
    queryKey: householdId
      ? billPaymentKeys.list(householdId)
      : ["bill-payments", "none"],
    queryFn: async () => {
      if (!householdId) throw new Error("No household");

      const { data, error } = await supabase
        .from("bill_payments")
        .select("*")
        .eq("household_id", householdId)
        .order("allocated_at", { ascending: false });

      if (error) {
        console.error("Failed to fetch bill payments:", error);
        throw error;
      }

      return (data || []).map((row) => ({
        id: row.id,
        billId: row.bill_id,
        expenseId: row.expense_id,
        amount: Number(row.amount),
        allocatedAt: row.allocated_at,
      }));
    },
    enabled: !!householdId,
  });
}

export function useCreateBillPaymentMutation(householdId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      billId,
      expenseId,
      amount,
    }: {
      billId: string;
      expenseId: string;
      amount: number;
    }) => {
      if (!householdId) throw new Error("No household");

      const { data, error } = await supabase
        .from("bill_payments")
        .insert({
          bill_id: billId,
          expense_id: expenseId,
          amount,
          household_id: householdId,
        })
        .select("*")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      if (householdId) {
        queryClient.invalidateQueries({
          queryKey: billPaymentKeys.list(householdId),
        });
        // Also invalidate bills to refresh their status
        queryClient.invalidateQueries({ queryKey: ["bills", householdId] });
      }
    },
  });
}

export function useDeleteBillPaymentMutation(householdId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase
        .from("bill_payments")
        .delete()
        .eq("id", paymentId);

      if (error) throw error;
    },
    onSuccess: () => {
      if (householdId) {
        queryClient.invalidateQueries({
          queryKey: billPaymentKeys.list(householdId),
        });
        queryClient.invalidateQueries({ queryKey: ["bills", householdId] });
      }
    },
  });
}
