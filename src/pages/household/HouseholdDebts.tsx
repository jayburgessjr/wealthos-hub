import DashboardLayout from "@/components/layout/DashboardLayout";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import {
  useDebtsQuery,
  useCreateDebtMutation,
  useUpdateDebtMutation,
  useDeleteDebtMutation,
  useCreateBillMutation,
  useUpdateBillMutation,
} from "@/hooks/useHouseholdBudgetData";

export default function HouseholdDebts() {
  const { householdId, budget } = useHouseholdBudget();
  const { data } = useDebtsQuery(householdId);
  const createDebt = useCreateDebtMutation(householdId);
  const updateDebt = useUpdateDebtMutation(householdId);
  const deleteDebt = useDeleteDebtMutation(householdId);
  const createBill = useCreateBillMutation(householdId);
  const updateBill = useUpdateBillMutation(householdId);
  const debts = data?.debts ?? [];
  const totalCurrent = debts.reduce(
    (s, d) => s + Number(d.current_balance || 0),
    0,
  );
  const totalOriginal = debts.reduce(
    (s, d) => s + Number(d.total_balance || 0),
    0,
  );
  const [extra, setExtra] = useState("0");
  const [showAdd, setShowAdd] = useState(false);
  const [strategy, setStrategy] = useState<"none" | "snowball" | "avalanche">(
    "none",
  );
  const [dName, setDName] = useState("");
  const [dTotal, setDTotal] = useState("");
  const [dCurrent, setDCurrent] = useState("");
  const [dPayment, setDPayment] = useState("");
  const [dInterest, setDInterest] = useState("");
  const [dCategory, setDCategory] = useState("");
  const [createLinkedBill, setCreateLinkedBill] = useState(true);
  const [syncToBill, setSyncToBill] = useState(true);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDebtId, setScheduleDebtId] = useState<string | null>(null);
  const selectedDebt = useMemo(
    () => debts.find((d: any) => d.id === scheduleDebtId),
    [debts, scheduleDebtId],
  );

  function monthsSimple(
    balance: number,
    payment: number,
    apr?: number,
    extraPerMonth = 0,
  ): number {
    const b = Math.max(balance, 0);
    const p = Math.max(payment + extraPerMonth, 0.01);
    const r = apr ? apr / 100 / 12 : 0;
    if (r <= 0) return Math.ceil(b / p);
    if (p <= b * r) return 9999;
    const n = Math.log(p / (p - b * r)) / Math.log(1 + r);
    return Math.ceil(n);
  }

  function simulate(
    debtsList: any[],
    extra: number,
    mode: "snowball" | "avalanche",
  ) {
    const ds = debtsList.map((d) => ({
      id: d.id,
      bal: Number(d.current_balance || 0),
      pay: Number(d.monthly_payment || 0),
      apr: Number(d.interest_rate || 0),
    }));
    const order = [...ds].sort((a, b) =>
      mode === "avalanche" ? b.apr - a.apr : a.bal - b.bal,
    );
    const doneMonths = new Map<string, number>();
    const maxIters = 600;
    let month = 0;
    while (order.some((d) => d.bal > 0.01) && month < maxIters) {
      month++;
      const target = order.find((d) => d.bal > 0.01);
      for (const d of order) {
        const r = d.apr > 0 ? d.apr / 100 / 12 : 0;
        d.bal = d.bal + d.bal * r;
        let pay = d.pay;
        if (target && d.id === target.id) pay += extra;
        d.bal = Math.max(0, d.bal - pay);
        if (d.bal <= 0.01 && !doneMonths.has(d.id)) doneMonths.set(d.id, month);
      }
    }
    return doneMonths;
  }

  function buildAmortization(
    balance: number,
    payment: number,
    apr?: number,
    maxMonths = 600,
  ) {
    const r = apr ? apr / 100 / 12 : 0;
    const rows: {
      month: number;
      interest: number;
      principal: number;
      balance: number;
    }[] = [];
    let b = Math.max(balance, 0);
    let m = 0;
    let totalInterest = 0;
    if (payment <= Math.max(b * r, 0)) {
      return { rows, months: Infinity, totalInterest };
    }
    while (b > 0.01 && m < maxMonths) {
      m++;
      const interest = r > 0 ? b * r : 0;
      let principal = payment - interest;
      if (principal < 0) principal = 0;
      if (principal > b) principal = b;
      const newBalance = Math.max(0, b - principal);
      rows.push({ month: m, interest, principal, balance: newBalance });
      totalInterest += interest;
      b = newBalance;
    }
    return { rows, months: b <= 0.01 ? m : Infinity, totalInterest };
  }

  return (
    <DashboardLayout>
      <div className="space-y-6" role="region" aria-labelledby="debts-title">
        <div className="flex items-center justify-between">
          <div>
            <h1 id="debts-title" className="text-2xl md:text-3xl font-bold">
              Debts
            </h1>
            <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1">
              Balances and simple payoff planning
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-muted-foreground">
              Extra per month
            </span>
            <Input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              className="w-24 font-mono"
              type="number"
              step="1"
            />
            <span className="text-xs font-mono text-muted-foreground ml-2">
              Strategy
            </span>
            <Select
              value={strategy}
              onValueChange={(v) => setStrategy(v as any)}
            >
              <SelectTrigger className="w-[140px] font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="snowball">Snowball</SelectItem>
                <SelectItem value="avalanche">Avalanche</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription>Total Current Balance</CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${Math.round(totalCurrent).toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription>Total Original</CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                ${Math.round(totalOriginal).toLocaleString()}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card className="border-2">
            <CardHeader className="pb-2">
              <CardDescription>Debts</CardDescription>
              <CardTitle className="text-xl md:text-2xl font-mono">
                {debts.length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card className="border-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Debts</CardTitle>
                <CardDescription>Simple payoff estimate</CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setShowAdd(true)}
                className="font-mono text-xs"
              >
                Add Debt
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {debts.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No outstanding debts
              </div>
            ) : (
              <div className="space-y-2">
                {debts.map((d: any) => {
                  const extraNum = parseFloat(extra) || 0;
                  let months = 0;
                  if (strategy === "none") {
                    months = monthsSimple(
                      Number(d.current_balance || 0),
                      Number(d.monthly_payment || 0),
                      Number(d.interest_rate || 0),
                      extraNum / Math.max(debts.length, 1),
                    );
                  } else {
                    const map = simulate(debts, extraNum, strategy);
                    months =
                      map.get(d.id) ||
                      monthsSimple(
                        Number(d.current_balance || 0),
                        Number(d.monthly_payment || 0),
                        Number(d.interest_rate || 0),
                      );
                  }
                  const payoffDate = new Date();
                  payoffDate.setMonth(
                    payoffDate.getMonth() + (isFinite(months) ? months : 0),
                  );
                  const nearPayoff = months <= 3;
                  return (
                    <div
                      key={d.id}
                      className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 border-2 border-border bg-card"
                    >
                      <div>
                        <p className="font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          Current ${Number(d.current_balance).toFixed(2)} •
                          Original ${Number(d.total_balance).toFixed(2)}
                        </p>
                        <div className="mt-2 mb-1">
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-muted-foreground">
                              Progress
                            </span>
                            <span className="font-mono">
                              {Math.round(
                                ((Number(d.total_balance) -
                                  Number(d.current_balance)) /
                                  Number(d.total_balance)) *
                                  100,
                              )}
                              %
                            </span>
                          </div>
                          <Progress
                            value={
                              ((Number(d.total_balance) -
                                Number(d.current_balance)) /
                                Number(d.total_balance)) *
                              100
                            }
                            className="h-1.5"
                          />
                        </div>
                        {nearPayoff && (
                          <span className="text-[10px] font-mono px-1 py-[1px] border border-yellow-600 text-yellow-700">
                            Nearly paid off
                          </span>
                        )}
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Monthly Payment
                        </p>
                        <span className="font-mono font-bold">
                          ${Number(d.monthly_payment).toFixed(2)}/mo
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Est. Months
                        </p>
                        <span className="font-mono font-bold">
                          {isFinite(months) ? months : "∞"}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">
                          Est. Payoff Date
                        </p>
                        <span className="font-mono font-bold">
                          {isFinite(months)
                            ? payoffDate.toLocaleDateString()
                            : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs"
                          onClick={() => {
                            setScheduleDebtId(d.id as string);
                            setScheduleOpen(true);
                          }}
                        >
                          Schedule
                        </Button>
                        {d.payment_bill_id && (
                          <label className="text-[11px] font-mono flex items-center gap-2 mr-2">
                            <input
                              type="checkbox"
                              checked={(d.sync_to_bill ?? true) as boolean}
                              onChange={async (e) => {
                                try {
                                  await updateDebt.mutateAsync({
                                    id: d.id as string,
                                    updates: { syncToBill: e.target.checked },
                                  });
                                  toast.success(
                                    e.target.checked
                                      ? "Enabled bill sync"
                                      : "Disabled bill sync",
                                  );
                                } catch {
                                  toast.error("Failed to update sync setting");
                                }
                              }}
                            />
                            Sync to bill
                          </label>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs"
                          onClick={async () => {
                            const val = prompt(
                              "New monthly payment",
                              String(d.monthly_payment || 0),
                            );
                            if (val === null) return;
                            const newPay = parseFloat(val) || 0;
                            await updateDebt.mutateAsync({
                              id: d.id,
                              updates: { monthlyPayment: newPay },
                            });
                            if (d.payment_bill_id && (d.sync_to_bill ?? true)) {
                              updateBill.mutate({
                                id: d.payment_bill_id as string,
                                updates: { amount: newPay },
                              });
                            }
                          }}
                        >
                          Edit
                        </Button>
                        {!d.payment_bill_id && (
                          <Select
                            onValueChange={async (value) => {
                              try {
                                if (!householdId) {
                                  toast.error("Sign in to link a bill");
                                  return;
                                }
                                if (value === "__create_new__") {
                                  const bill = await createBill.mutateAsync({
                                    name: (d.name as string) || "Debt Payment",
                                    amount: Number(d.monthly_payment || 0) || 0,
                                    dueDate: new Date()
                                      .toISOString()
                                      .slice(0, 10),
                                    categoryId:
                                      (d.category_id as string) || null,
                                    isRecurring: true,
                                    frequency: "monthly",
                                    paymentStatus: "unpaid",
                                    amountPaid: 0,
                                    totalBalance:
                                      Number(d.current_balance || 0) || 0,
                                  });
                                  await updateDebt.mutateAsync({
                                    id: d.id as string,
                                    updates: {
                                      paymentBillId: bill.id as string,
                                      syncToBill: true,
                                    },
                                  });
                                  toast.success("Linked to new bill");
                                } else {
                                  await updateDebt.mutateAsync({
                                    id: d.id as string,
                                    updates: {
                                      paymentBillId: value,
                                      syncToBill: true,
                                    },
                                  });
                                  toast.success("Linked to existing bill");
                                }
                              } catch {
                                toast.error("Failed to link bill");
                              }
                            }}
                          >
                            <SelectTrigger className="w-[110px] h-8 font-mono text-xs">
                              <SelectValue placeholder="Link Bill" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__create_new__">
                                + Create New Bill
                              </SelectItem>
                              {budget.bills
                                .filter((b) => b.isActive !== false)
                                .map((b) => (
                                  <SelectItem key={b.id} value={b.id}>
                                    {b.name} (${Number(b.amount).toFixed(0)})
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          className="font-mono text-xs"
                          onClick={() =>
                            updateDebt.mutate({
                              id: d.id,
                              updates: { isActive: false },
                            })
                          }
                        >
                          Archive
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="font-mono text-xs"
                          onClick={() => deleteDebt.mutate(d.id)}
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {showAdd && (
          <Card className="border-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Add Debt</CardTitle>
              <CardDescription>
                Track current/original and monthly payment. Optionally create a
                linked bill.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="font-mono text-xs uppercase">Name</Label>
                  <Input
                    value={dName}
                    onChange={(e) => setDName(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase">
                    Category
                  </Label>
                  <Select value={dCategory} onValueChange={setDCategory}>
                    <SelectTrigger className="font-mono">
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                      {budget.categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase">
                    Original Total
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dTotal}
                    onChange={(e) => setDTotal(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase">
                    Current Balance
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dCurrent}
                    onChange={(e) => setDCurrent(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase">
                    Monthly Payment
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dPayment}
                    onChange={(e) => setDPayment(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="font-mono text-xs uppercase">
                    Interest Rate (APR %)
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={dInterest}
                    onChange={(e) => setDInterest(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center gap-4 mt-3">
                <label className="text-xs font-mono flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={createLinkedBill}
                    onChange={(e) => setCreateLinkedBill(e.target.checked)}
                  />
                  Create linked monthly bill
                </label>
                <span className="text-xs text-muted-foreground">
                  Amount = Monthly Payment
                </span>
                <label className="text-xs font-mono flex items-center gap-2 ml-auto">
                  <input
                    type="checkbox"
                    checked={syncToBill}
                    onChange={(e) => setSyncToBill(e.target.checked)}
                    disabled={!createLinkedBill}
                  />
                  Sync payment to bill amount
                </label>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  className="font-mono"
                  onClick={async () => {
                    const total = parseFloat(dTotal || "0") || 0;
                    const current = parseFloat(dCurrent || "0") || 0;
                    const pay = parseFloat(dPayment || "0") || 0;
                    const rate = dInterest ? parseFloat(dInterest) : undefined;
                    let billId: string | null = null;
                    if (createLinkedBill && householdId) {
                      const bill = await createBill.mutateAsync({
                        name: dName || "Debt Payment",
                        amount: pay,
                        dueDate: new Date().toISOString().slice(0, 10),
                        categoryId: dCategory || null,
                        isRecurring: true,
                        frequency: "monthly",
                        paymentStatus: "unpaid",
                        amountPaid: 0,
                        totalBalance: current,
                      });
                      billId = bill.id as string;
                    }
                    await createDebt.mutateAsync({
                      name: dName || "Debt",
                      totalBalance: total,
                      currentBalance: current,
                      monthlyPayment: pay,
                      interestRate: rate,
                      categoryId: dCategory || null,
                      paymentBillId: billId,
                      isActive: true,
                      syncToBill: createLinkedBill ? syncToBill : undefined,
                    });
                    setDName("");
                    setDTotal("");
                    setDCurrent("");
                    setDPayment("");
                    setDInterest("");
                    setDCategory("");
                    setShowAdd(false);
                  }}
                >
                  Add
                </Button>
                <Button
                  variant="outline"
                  className="font-mono"
                  onClick={() => setShowAdd(false)}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Amortization Dialog */}
      <Dialog open={scheduleOpen} onOpenChange={setScheduleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">
              Amortization Schedule
            </DialogTitle>
          </DialogHeader>
          {!selectedDebt ? (
            <div className="text-sm text-muted-foreground">
              No debt selected
            </div>
          ) : (
            (() => {
              const balance = Number(selectedDebt.current_balance || 0);
              const apr = Number(selectedDebt.interest_rate || 0);
              const payment = Number(selectedDebt.monthly_payment || 0);
              const { rows, months, totalInterest } = buildAmortization(
                balance,
                payment,
                apr,
                1200,
              );
              const payoff = new Date();
              payoff.setMonth(
                payoff.getMonth() + (isFinite(months) ? months : 0),
              );
              const preview = rows.slice(0, 24);
              return (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Starting Balance
                      </p>
                      <p className="font-mono font-bold">
                        ${balance.toFixed(2)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">APR</p>
                      <p className="font-mono font-bold">{apr.toFixed(2)}%</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Payment</p>
                      <p className="font-mono font-bold">
                        ${payment.toFixed(2)}/mo
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Projected Payoff
                      </p>
                      <p className="font-mono font-bold">
                        {isFinite(months) ? payoff.toLocaleDateString() : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">Months</p>
                      <p className="font-mono font-bold">
                        {isFinite(months) ? months : "∞"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">
                        Total Interest
                      </p>
                      <p className="font-mono font-bold">
                        ${totalInterest.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <div className="border rounded-md max-h-72 overflow-auto">
                    <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs font-mono text-muted-foreground sticky top-0 bg-background">
                      <span>Month</span>
                      <span>Interest</span>
                      <span>Principal</span>
                      <span>Balance</span>
                    </div>
                    {preview.map((r) => (
                      <div
                        key={r.month}
                        className="grid grid-cols-4 gap-2 px-3 py-1 text-sm"
                      >
                        <span className="font-mono">{r.month}</span>
                        <span className="font-mono">
                          ${r.interest.toFixed(2)}
                        </span>
                        <span className="font-mono">
                          ${r.principal.toFixed(2)}
                        </span>
                        <span className="font-mono">
                          ${r.balance.toFixed(2)}
                        </span>
                      </div>
                    ))}
                    {rows.length > preview.length && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">
                        …and {rows.length - preview.length} more months
                      </div>
                    )}
                  </div>
                </div>
              );
            })()
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
