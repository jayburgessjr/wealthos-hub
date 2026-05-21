import { useState, useEffect, useCallback, useMemo } from "react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
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
import { useToast } from "@/hooks/use-toast";
import { suggestCategory } from "@/services/householdAiService";
import { Sparkles, Loader2 } from "lucide-react";
import {
  useCreateBillMutation,
  useCreateSubscriptionMutation,
} from "@/hooks/useHouseholdBudgetData";
import { useDemoMode as useHouseholdDemoMode } from "@/hooks/useHouseholdDemoMode";
import { toast as sonnerToast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { QuickExpenseEntry } from "./QuickExpenseEntry";
import { ExpenseType as DbExpenseType } from "@/integrations/supabase/household-types";

type ExpenseType =
  | "one-time"
  | "bill"
  | "bill-one-time"
  | "subscription"
  | "subscription-annual"
  | "annual";
type LinkMode = "none" | "existing" | "new";

interface ExpenseFormProps {
  onSuccess?: () => void;
}

export function ExpenseForm({ onSuccess }: ExpenseFormProps) {
  const {
    budget,
    addExpense,
    householdId,
    addBillLocal,
    addSubscriptionLocal,
    updateSubscription,
    updateSubscriptionLocal,
  } = useHouseholdBudget();
  const { demoMode } = useHouseholdDemoMode();
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];

  const [amount, setAmount] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(today);
  const [description, setDescription] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [aiSuggested, setAiSuggested] = useState(false);

  // Expense type selection
  const [expenseType, setExpenseType] = useState<ExpenseType>("one-time");
  const [linkMode, setLinkMode] = useState<LinkMode>("none");
  const [selectedBillId, setSelectedBillId] = useState<string>("");
  const [selectedSubscriptionId, setSelectedSubscriptionId] =
    useState<string>("");
  const [billOneTime, setBillOneTime] = useState<boolean>(false);
  const [advanceSubscription, setAdvanceSubscription] = useState<boolean>(true);

  // New bill/subscription form
  const [newBillName, setNewBillName] = useState("");
  const [newBillDueDate, setNewBillDueDate] = useState(today);
  const [newSubName, setNewSubName] = useState("");
  const [newSubNextDate, setNewSubNextDate] = useState(today);

  const createBillMutation = useCreateBillMutation(householdId);
  const createSubscriptionMutation = useCreateSubscriptionMutation(householdId);

  // Handler for quick expense pattern selection
  const handleQuickPatternSelect = useCallback(
    (pattern: {
      description: string;
      categoryId: string;
      amount: number;
      expenseType: DbExpenseType;
      linkedBillId?: string;
      linkedSubscriptionId?: string;
    }) => {
      setDescription(pattern.description);
      setCategoryId(pattern.categoryId);
      setAmount(pattern.amount.toString());
      setAiSuggested(false);

      // Map db expense type to UI expense type
      switch (pattern.expenseType) {
        case "bill_payment":
          setExpenseType("bill");
          if (pattern.linkedBillId) {
            setLinkMode("existing");
            setSelectedBillId(pattern.linkedBillId);
          }
          break;
        case "subscription":
          setExpenseType("subscription");
          if (pattern.linkedSubscriptionId) {
            setLinkMode("existing");
            setSelectedSubscriptionId(pattern.linkedSubscriptionId);
          }
          break;
        case "recurring":
          setExpenseType("annual");
          break;
        default:
          setExpenseType("one-time");
      }
    },
    [],
  );

  // Local rules (merchant → category) suggestion
  const rules = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("hh_rules_v1") || "[]");
    } catch {
      return [];
    }
  }, []) as { pattern: string; categoryId: string }[];
  const localSuggestedCategoryId = useMemo(() => {
    if (!description) return "";
    const d = description.toLowerCase();
    const hit = rules.find((r) => d.includes(r.pattern.toLowerCase()));
    return hit?.categoryId || "";
  }, [description, rules]);

  // Debounced AI category suggestion
  const suggestCategoryFromDescription = useCallback(
    async (desc: string) => {
      if (!desc.trim() || budget.categories.length === 0) return;

      setIsSuggesting(true);
      try {
        const categoryNames = budget.categories.map((c) => c.name);
        const suggested = await suggestCategory(desc, categoryNames);

        // Find the category that matches
        const matchedCategory = budget.categories.find(
          (c) => c.name.toLowerCase() === suggested.toLowerCase().trim(),
        );

        if (matchedCategory && !categoryId) {
          setCategoryId(matchedCategory.id);
          setAiSuggested(true);
        }
      } catch (error) {
        console.error("Failed to suggest category:", error);
      } finally {
        setIsSuggesting(false);
      }
    },
    [budget.categories, categoryId],
  );

  // Trigger AI suggestion when description changes
  useEffect(() => {
    if (description.length >= 3 && !categoryId) {
      const timer = setTimeout(() => {
        suggestCategoryFromDescription(description);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [description, suggestCategoryFromDescription, categoryId]);

  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setAiSuggested(false);
  };

  // Reset link mode when expense type changes
  useEffect(() => {
    setLinkMode("none");
    setSelectedBillId("");
    setSelectedSubscriptionId("");
    setBillOneTime(expenseType === "bill-one-time");
    if (expenseType === "bill-one-time") {
      setLinkMode("new");
    }
  }, [expenseType]);

  // Auto-detect expense type based on linked bill or subscription
  useEffect(() => {
    if (
      selectedBillId &&
      (expenseType === "one-time" || expenseType === "annual")
    ) {
      const bill = budget.bills.find((b) => b.id === selectedBillId);
      if (bill) {
        setExpenseType(bill.isRecurring ? "bill" : "bill-one-time");
      }
    }
  }, [selectedBillId, budget.bills, expenseType]);

  useEffect(() => {
    if (
      selectedSubscriptionId &&
      (expenseType === "one-time" || expenseType === "annual")
    ) {
      const sub = budget.subscriptions.find(
        (s) => s.id === selectedSubscriptionId,
      );
      if (sub) {
        setExpenseType(
          sub.frequency === "annual" ? "subscription-annual" : "subscription",
        );
      }
    }
  }, [selectedSubscriptionId, budget.subscriptions, expenseType]);

  function toISO(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function addMonthsISO(iso: string, months: number) {
    const d = new Date(iso);
    d.setHours(0, 0, 0, 0);
    d.setMonth(d.getMonth() + months);
    return toISO(d);
  }

  function addYearsISO(iso: string, years: number) {
    const d = new Date(iso);
    d.setFullYear(d.getFullYear() + years);
    return toISO(d);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!amount || !categoryId) {
      toast({
        title: "Missing fields",
        description: "Please enter an amount and select a category.",
        variant: "destructive",
      });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast({
        title: "Invalid amount",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      });
      return;
    }

    let linkedBillId: string | undefined;
    let linkedSubscriptionId: string | undefined;

    try {
      // Handle bill creation/linking (recurring or one-time)
      if (expenseType === "bill" || expenseType === "bill-one-time") {
        const oneTime = expenseType === "bill-one-time" || billOneTime;
        if (linkMode === "existing" && selectedBillId) {
          linkedBillId = selectedBillId;
        } else if (linkMode === "new" && newBillName) {
          if (demoMode || !householdId) {
            const tempId = `bill_${Date.now()}`;
            addBillLocal({
              name: newBillName,
              amount: parsedAmount,
              dueDate: newBillDueDate,
              categoryId: categoryId,
              isAutoPay: false,
              paymentStatus: "unpaid",
              amountPaid: 0,
              totalBalance: parsedAmount,
              paymentAccountId: "",
              isRecurring: !oneTime,
              frequency: !oneTime ? "monthly" : undefined,
              isActive: true,
            });
            linkedBillId = tempId;
            sonnerToast.success(`Bill "${newBillName}" created`);
          } else {
            const newBill = await createBillMutation.mutateAsync({
              name: newBillName,
              amount: parsedAmount,
              dueDate: newBillDueDate,
              categoryId: categoryId,
              isAutoPay: false,
              isRecurring: !oneTime,
              frequency: "monthly",
              paymentStatus: "unpaid",
              amountPaid: 0,
              totalBalance: parsedAmount,
            });
            linkedBillId = newBill.id;
            sonnerToast.success(`Bill "${newBillName}" created and linked`);
          }
        }
      }

      // Handle subscription creation/linking
      if (
        expenseType === "subscription" ||
        expenseType === "subscription-annual"
      ) {
        if (linkMode === "existing" && selectedSubscriptionId) {
          linkedSubscriptionId = selectedSubscriptionId;
          // Optionally advance next date for existing subscription
          if (advanceSubscription) {
            const sub = budget.subscriptions.find(
              (s) => s.id === selectedSubscriptionId,
            );
            if (sub) {
              const next =
                sub.frequency === "annual"
                  ? addYearsISO(sub.nextDate, 1)
                  : addMonthsISO(sub.nextDate, 1);
              if (demoMode || !householdId) {
                updateSubscriptionLocal(sub.id, { nextDate: next });
              } else {
                updateSubscription(sub.id, { nextDate: next });
              }
            }
          }
        } else if (linkMode === "new" && newSubName) {
          if (demoMode || !householdId) {
            const tempId = `sub_${Date.now()}`;
            addSubscriptionLocal({
              name: newSubName,
              amount: parsedAmount,
              categoryId: categoryId,
              nextDate: newSubNextDate,
              confirmed: true,
              frequency:
                expenseType === "subscription-annual" ? "annual" : "monthly",
            });
            linkedSubscriptionId = tempId;
            sonnerToast.success(`Subscription "${newSubName}" created`);
            if (advanceSubscription) {
              const next =
                expenseType === "subscription-annual"
                  ? addYearsISO(newSubNextDate, 1)
                  : addMonthsISO(newSubNextDate, 1);
              updateSubscriptionLocal(tempId, { nextDate: next });
            }
          } else {
            const newSub = await createSubscriptionMutation.mutateAsync({
              name: newSubName,
              amount: parsedAmount,
              nextDate: newSubNextDate,
              categoryId: categoryId,
              confirmed: true,
              frequency:
                expenseType === "subscription-annual" ? "annual" : "monthly",
            });
            linkedSubscriptionId = newSub.id;
            sonnerToast.success(
              `Subscription "${newSubName}" created and linked`,
            );
            if (advanceSubscription) {
              const next =
                expenseType === "subscription-annual"
                  ? addYearsISO(newSubNextDate, 1)
                  : addMonthsISO(newSubNextDate, 1);
              updateSubscription(newSub.id, { nextDate: next });
            }
          }
        }
      }

      // Map UI expense type to database expense_type
      const dbExpenseType = (() => {
        switch (expenseType) {
          case "bill":
          case "bill-one-time":
            return "bill_payment" as const;
          case "subscription":
          case "subscription-annual":
            return "subscription" as const;
          case "annual":
            return "recurring" as const;
          default:
            return "one_off" as const;
        }
      })();

      addExpense({
        amount: parsedAmount,
        categoryId,
        date,
        description: description.trim() || undefined,
        linkedBillId,
        linkedSubscriptionId,
        expenseType: dbExpenseType,
        transactionDate: date,
      });

      toast({
        title: "Expense added",
        description: `$${parsedAmount.toFixed(2)} added to ${budget.categories.find((c) => c.id === categoryId)?.name}`,
      });

      // Reset form
      setAmount("");
      setDescription("");
      setCategoryId("");
      setAiSuggested(false);
      setExpenseType("one-time");
      setLinkMode("none");
      setSelectedBillId("");
      setSelectedSubscriptionId("");
      setNewBillName("");
      setNewSubName("");
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create expense:", error);
      toast({
        title: "Error",
        description: "Failed to create expense. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {/* Quick Entry Suggestions */}
      <QuickExpenseEntry onSelectPattern={handleQuickPatternSelect} />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="amount" className="font-mono text-xs uppercase">
              Amount
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                $
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="date" className="font-mono text-xs uppercase">
              Date
            </Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="font-mono"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description" className="font-mono text-xs uppercase">
            Description (optional)
          </Label>
          <div className="relative">
            <Input
              id="description"
              placeholder="What was this expense for?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            {isSuggesting && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="category" className="font-mono text-xs uppercase">
              Category
            </Label>
            {aiSuggested && (
              <span className="flex items-center gap-1 text-xs text-primary">
                <Sparkles className="h-3 w-3" />
                AI suggested
              </span>
            )}
          </div>
          <Select value={categoryId} onValueChange={handleCategoryChange}>
            <SelectTrigger
              className={`font-mono ${aiSuggested ? "border-primary" : ""}`}
            >
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {budget.categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id} className="font-mono">
                  <span className="flex items-center gap-2">
                    <span>{cat.icon}</span>
                    <span>{cat.name}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!categoryId && localSuggestedCategoryId && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Suggested by rule:{" "}
                {
                  budget.categories.find(
                    (c) => c.id === localSuggestedCategoryId,
                  )?.name
                }
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="font-mono"
                onClick={() => setCategoryId(localSuggestedCategoryId)}
              >
                Apply
              </Button>
            </div>
          )}
        </div>

        {/* Expense Type Selection */}
        <div className="space-y-2">
          <Label className="font-mono text-xs uppercase">Expense Type</Label>
          <Select
            value={expenseType}
            onValueChange={(v) => setExpenseType(v as ExpenseType)}
          >
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-time" className="font-mono">
                One-time expense
              </SelectItem>
              <SelectItem value="bill" className="font-mono">
                Bill
              </SelectItem>
              <SelectItem value="bill-one-time" className="font-mono">
                One-time bill
              </SelectItem>
              <SelectItem value="subscription" className="font-mono">
                Subscription (monthly)
              </SelectItem>
              <SelectItem value="subscription-annual" className="font-mono">
                Subscription (annual)
              </SelectItem>
              <SelectItem value="annual" className="font-mono">
                Annual expense
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bill linking options */}
        {(expenseType === "bill" || expenseType === "bill-one-time") && (
          <div className="space-y-3 p-3 border rounded-md bg-muted/30">
            <Label className="font-mono text-xs uppercase">
              {expenseType === "bill-one-time"
                ? "Link to One-time Bill"
                : "Link to Bill"}
            </Label>
            <Select
              value={linkMode}
              onValueChange={(v) => setLinkMode(v as LinkMode)}
            >
              <SelectTrigger className="font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="font-mono">
                  Don't link
                </SelectItem>
                <SelectItem value="existing" className="font-mono">
                  Link to existing bill
                </SelectItem>
                <SelectItem value="new" className="font-mono">
                  Create new bill
                </SelectItem>
              </SelectContent>
            </Select>

            {linkMode === "existing" && (
              <Select value={selectedBillId} onValueChange={setSelectedBillId}>
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="Select bill..." />
                </SelectTrigger>
                <SelectContent>
                  {budget.bills
                    .filter((b) => b.isActive !== false)
                    .map((bill) => {
                      const label = `${bill.name} ($${bill.amount})${bill.isRecurring ? "" : " • one-time"}`;
                      return (
                        <SelectItem
                          key={bill.id}
                          value={bill.id}
                          className="font-mono"
                        >
                          {label}
                        </SelectItem>
                      );
                    })}
                </SelectContent>
              </Select>
            )}

            {linkMode === "new" && (
              <div className="space-y-2">
                <Input
                  placeholder={
                    billOneTime
                      ? "One-time bill (e.g., Medical)"
                      : "Bill name (e.g., Internet)"
                  }
                  value={newBillName}
                  onChange={(e) => setNewBillName(e.target.value)}
                  className="font-mono"
                />
                <div className="flex items-center gap-2">
                  <Label className="font-mono text-xs shrink-0">
                    Due date:
                  </Label>
                  <Input
                    type="date"
                    value={newBillDueDate}
                    onChange={(e) => setNewBillDueDate(e.target.value)}
                    className="font-mono"
                  />
                </div>
                <div className="flex items-center justify-between border border-border p-2">
                  <div>
                    <p className="text-sm font-medium">One-time bill</p>
                    <p className="text-xs text-muted-foreground">
                      Do not recur next month
                    </p>
                  </div>
                  <Switch
                    checked={
                      expenseType === "bill-one-time" ? true : billOneTime
                    }
                    onCheckedChange={setBillOneTime}
                    aria-label="One-time bill"
                    disabled={expenseType === "bill-one-time"}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Subscription linking options */}
        {(expenseType === "subscription" ||
          expenseType === "subscription-annual") && (
          <div className="space-y-3 p-3 border rounded-md bg-muted/30">
            <Label className="font-mono text-xs uppercase">
              Link to Subscription
            </Label>
            <Select
              value={linkMode}
              onValueChange={(v) => setLinkMode(v as LinkMode)}
            >
              <SelectTrigger className="font-mono">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none" className="font-mono">
                  Don't link
                </SelectItem>
                <SelectItem value="existing" className="font-mono">
                  Link to existing subscription
                </SelectItem>
                <SelectItem value="new" className="font-mono">
                  Create new subscription
                </SelectItem>
              </SelectContent>
            </Select>

            {linkMode === "existing" && (
              <Select
                value={selectedSubscriptionId}
                onValueChange={setSelectedSubscriptionId}
              >
                <SelectTrigger className="font-mono">
                  <SelectValue placeholder="Select subscription..." />
                </SelectTrigger>
                <SelectContent>
                  {budget.subscriptions.map((sub) => (
                    <SelectItem
                      key={sub.id}
                      value={sub.id}
                      className="font-mono"
                    >
                      {sub.name} (${sub.amount})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {linkMode === "new" && (
              <div className="space-y-2">
                <Input
                  placeholder={
                    expenseType === "subscription-annual"
                      ? "Annual subscription name (e.g., Amazon Prime)"
                      : "Subscription name (e.g., Netflix)"
                  }
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="font-mono"
                />
                <div className="flex items-center gap-2">
                  <Label className="font-mono text-xs shrink-0">
                    Next billing:
                  </Label>
                  <Input
                    type="date"
                    value={newSubNextDate}
                    onChange={(e) => setNewSubNextDate(e.target.value)}
                    className="font-mono"
                  />
                </div>
                {expenseType === "subscription-annual" && (
                  <p className="text-xs text-muted-foreground">
                    This subscription will be marked as annual billing.
                  </p>
                )}
              </div>
            )}

            {/* Advance next date toggle */}
            {(linkMode === "existing" || linkMode === "new") && (
              <div className="flex items-center justify-between border border-border p-2">
                <div>
                  <p className="text-sm font-medium">Advance next date</p>
                  <p className="text-xs text-muted-foreground">
                    After recording this payment
                  </p>
                </div>
                <Switch
                  checked={advanceSubscription}
                  onCheckedChange={setAdvanceSubscription}
                  aria-label="Advance subscription next date"
                />
              </div>
            )}
          </div>
        )}

        <Button type="submit" className="w-full font-mono">
          ADD EXPENSE
        </Button>
      </form>
    </div>
  );
}
