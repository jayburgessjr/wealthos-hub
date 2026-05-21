import { useState, useMemo } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/household/budget/ProgressBar";
import { formatCurrency } from "@/lib/household-format";
import {
  Plus,
  CreditCard,
  CheckCircle,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Bill, Expense } from "@/integrations/supabase/household-types";

export interface BillPayment {
  id: string;
  billId: string;
  expenseId: string;
  amount: number;
  allocatedAt: string;
}

interface BillPaymentAllocationProps {
  bills: Bill[];
  expenses: Expense[];
  billPayments: BillPayment[];
  onAllocatePayment: (
    billId: string,
    expenseId: string,
    amount: number,
  ) => Promise<void>;
  isLoading?: boolean;
}

export function BillPaymentAllocation({
  bills,
  expenses,
  billPayments,
  onAllocatePayment,
  isLoading,
}: BillPaymentAllocationProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [selectedExpenseId, setSelectedExpenseId] = useState<string>("");
  const [allocationAmount, setAllocationAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Calculate paid amounts for each bill from allocations
  const billPaidAmounts = useMemo(() => {
    const amounts: Record<string, number> = {};
    billPayments.forEach((bp) => {
      amounts[bp.billId] = (amounts[bp.billId] || 0) + bp.amount;
    });
    return amounts;
  }, [billPayments]);

  // Get bill status based on payments
  const getBillStatus = (bill: Bill): "paid" | "partial" | "unpaid" => {
    const paid = billPaidAmounts[bill.id] || 0;
    if (paid >= bill.amount) return "paid";
    if (paid > 0) return "partial";
    return "unpaid";
  };

  // Filter expenses that aren't fully allocated
  const availableExpenses = useMemo(() => {
    const allocatedAmounts: Record<string, number> = {};
    billPayments.forEach((bp) => {
      allocatedAmounts[bp.expenseId] =
        (allocatedAmounts[bp.expenseId] || 0) + bp.amount;
    });
    return expenses.filter((e) => {
      const allocated = allocatedAmounts[e.id] || 0;
      return allocated < e.amount;
    });
  }, [expenses, billPayments]);

  // Get unallocated amount for an expense
  const getUnallocatedAmount = (expenseId: string): number => {
    const expense = expenses.find((e) => e.id === expenseId);
    if (!expense) return 0;
    const allocated = billPayments
      .filter((bp) => bp.expenseId === expenseId)
      .reduce((sum, bp) => sum + bp.amount, 0);
    return expense.amount - allocated;
  };

  // Get remaining amount for a bill
  const getRemainingAmount = (billId: string): number => {
    const bill = bills.find((b) => b.id === billId);
    if (!bill) return 0;
    const paid = billPaidAmounts[billId] || 0;
    return Math.max(0, bill.amount - paid);
  };

  const handleAllocate = async () => {
    if (!selectedBillId || !selectedExpenseId || !allocationAmount) {
      toast({
        title: "Missing fields",
        description: "Please select a bill, expense, and enter an amount.",
        variant: "destructive",
      });
      return;
    }

    const amount = parseFloat(allocationAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive amount.",
        variant: "destructive",
      });
      return;
    }

    const maxExpenseAmount = getUnallocatedAmount(selectedExpenseId);
    const maxBillAmount = getRemainingAmount(selectedBillId);

    if (amount > maxExpenseAmount) {
      toast({
        title: "Amount too high",
        description: `Maximum available from this expense: ${formatCurrency(maxExpenseAmount)}`,
        variant: "destructive",
      });
      return;
    }

    if (amount > maxBillAmount) {
      toast({
        title: "Amount exceeds bill",
        description: `Bill only needs ${formatCurrency(maxBillAmount)} more.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onAllocatePayment(selectedBillId, selectedExpenseId, amount);
      toast({
        title: "Payment allocated",
        description: `${formatCurrency(amount)} allocated to bill.`,
      });
      setDialogOpen(false);
      setSelectedBillId("");
      setSelectedExpenseId("");
      setAllocationAmount("");
    } catch (error) {
      toast({
        title: "Failed to allocate",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const unpaidBills = bills.filter(
    (b) => getBillStatus(b) !== "paid" && b.isActive,
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Bill Payment Tracking</h3>
          <p className="text-sm text-muted-foreground">
            Allocate expenses to bills for accurate payment tracking
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="font-mono">
              <Plus className="h-4 w-4 mr-2" />
              Allocate Payment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Allocate Expense to Bill</DialogTitle>
              <DialogDescription>
                Link an expense payment to a bill for tracking.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">
                  Select Bill
                </Label>
                <Select
                  value={selectedBillId}
                  onValueChange={setSelectedBillId}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Choose a bill..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unpaidBills.map((bill) => (
                      <SelectItem
                        key={bill.id}
                        value={bill.id}
                        className="font-mono"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span>{bill.name}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(getRemainingAmount(bill.id))}{" "}
                            remaining
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">
                  Select Expense
                </Label>
                <Select
                  value={selectedExpenseId}
                  onValueChange={setSelectedExpenseId}
                >
                  <SelectTrigger className="font-mono">
                    <SelectValue placeholder="Choose an expense..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableExpenses.map((expense) => (
                      <SelectItem
                        key={expense.id}
                        value={expense.id}
                        className="font-mono"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <span>{expense.description || "Expense"}</span>
                          <span className="text-muted-foreground">
                            {formatCurrency(getUnallocatedAmount(expense.id))}{" "}
                            available
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">
                  Amount to Allocate
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                    $
                  </span>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={allocationAmount}
                    onChange={(e) => setAllocationAmount(e.target.value)}
                    className="pl-7 font-mono"
                  />
                </div>
                {selectedBillId && selectedExpenseId && (
                  <p className="text-xs text-muted-foreground">
                    Max:{" "}
                    {formatCurrency(
                      Math.min(
                        getUnallocatedAmount(selectedExpenseId),
                        getRemainingAmount(selectedBillId),
                      ),
                    )}
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAllocate} disabled={isSubmitting}>
                {isSubmitting ? "Allocating..." : "Allocate Payment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bills with payment status */}
      <div className="grid gap-3">
        {bills
          .filter((b) => b.isActive)
          .map((bill) => {
            const status = getBillStatus(bill);
            const paid = billPaidAmounts[bill.id] || 0;
            const allocations = billPayments.filter(
              (bp) => bp.billId === bill.id,
            );

            return (
              <Card key={bill.id} className="border-2">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-base">{bill.name}</CardTitle>
                    </div>
                    <Badge
                      variant={
                        status === "paid"
                          ? "default"
                          : status === "partial"
                            ? "secondary"
                            : "outline"
                      }
                      className={
                        status === "paid"
                          ? "bg-[hsl(var(--status-safe))] text-[hsl(var(--status-safe-foreground))]"
                          : status === "partial"
                            ? "bg-[hsl(var(--status-warning))] text-[hsl(var(--status-warning-foreground))]"
                            : ""
                      }
                    >
                      {status === "paid" && (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      )}
                      {status === "partial" && (
                        <Clock className="h-3 w-3 mr-1" />
                      )}
                      {status === "unpaid" && (
                        <AlertCircle className="h-3 w-3 mr-1" />
                      )}
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono">
                    Due: {bill.dueDate} • {formatCurrency(bill.amount)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Paid</span>
                    <span className="font-mono">
                      {formatCurrency(paid)} / {formatCurrency(bill.amount)}
                    </span>
                  </div>
                  <ProgressBar
                    value={paid}
                    max={bill.amount}
                    size="sm"
                    tone={
                      status === "paid"
                        ? "safe"
                        : status === "partial"
                          ? "warning"
                          : "danger"
                    }
                  />
                  {allocations.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-1">
                        Payments:
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {allocations.map((alloc) => {
                          const expense = expenses.find(
                            (e) => e.id === alloc.expenseId,
                          );
                          return (
                            <Badge
                              key={alloc.id}
                              variant="outline"
                              className="text-xs font-mono"
                            >
                              {formatCurrency(alloc.amount)}
                              {expense?.description &&
                                ` - ${expense.description.slice(0, 15)}...`}
                            </Badge>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
      </div>
    </div>
  );
}
