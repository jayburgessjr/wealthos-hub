import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Papa from "papaparse";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchCategories,
  createCategory,
  createExpense,
  createBill,
  createIncomeEntry,
  createSubscription,
  createDebt,
  createGoal,
  fetchBills,
  fetchSubscriptions,
  fetchDebts,
  fetchGoals,
} from "@/integrations/supabase/household-queries";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Download, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

const TEMPLATE_HEADER =
  "type,name,amount,date,frequency,category,notes,target_amount,current_amount,interest_rate,balance";

const TEMPLATE_ROWS = [
  "expense,Groceries,150.00,2024-01-15,,Food,Weekly grocery run,,,, ",
  "expense,Coffee,5.50,2024-01-16,,Food,Morning coffee,,,,",
  "bill,Rent,2500.00,2024-02-01,monthly,Housing,,,,, ",
  "bill,Electricity,120.00,2024-02-05,monthly,Utilities,,,,,",
  "income,Salary,5000.00,2024-01-15,monthly,,January paycheck,,,,,",
  "income,Freelance,800.00,2024-01-20,,,Side project,,,,,",
  "subscription,Netflix,15.99,2024-02-01,monthly,Entertainment,,,,,",
  "subscription,Spotify,9.99,2024-02-01,monthly,Entertainment,,,,,",
  "debt,Car Loan,350.00,,monthly,,Honda Accord,,14500,4.5,15000",
  "debt,Student Loan,200.00,,monthly,,Federal loan,,29000,5.0,30000",
  "goal,Emergency Fund,500.00,2025-12-01,,,3 months expenses,15000,5000,,",
  "goal,Vacation,200.00,2025-12-01,,,Hawaii trip,5000,1200,,",
];

type ParsedRow = {
  type?: string;
  name?: string;
  amount?: string;
  date?: string;
  frequency?: string;
  category?: string;
  notes?: string;
  target_amount?: string;
  current_amount?: string;
  interest_rate?: string;
  balance?: string;
  [key: string]: string | undefined;
};

type ImportResult = {
  total: number;
  succeeded: number;
  skipped: number;
  failed: number;
  byType: Record<string, number>;
  errors: string[];
};

const VALID_TYPES = [
  "expense",
  "bill",
  "income",
  "subscription",
  "debt",
  "goal",
];

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseNum(v: string | undefined): number {
  const n = parseFloat(v ?? "");
  return isNaN(n) ? 0 : n;
}

export function HouseholdDataImport() {
  const { householdId } = useHouseholdBudget();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState<{
    counts: Record<string, number>;
    total: number;
    unknown: number;
  } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);

  const downloadTemplate = () => {
    const csv = [TEMPLATE_HEADER, ...TEMPLATE_ROWS].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "household-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFile = (file: File) => {
    Papa.parse<ParsedRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: ({ data }) => {
        const counts: Record<string, number> = {};
        let unknown = 0;
        for (const row of data) {
          const t = (row.type ?? "").trim().toLowerCase();
          if (VALID_TYPES.includes(t)) {
            counts[t] = (counts[t] ?? 0) + 1;
          } else {
            unknown++;
          }
        }
        setParsedRows(data);
        setPreview({ counts, total: data.length, unknown });
        setResult(null);
      },
    });
  };

  const handleImport = async () => {
    if (!householdId) {
      toast.error("You need to set up a household before importing data.");
      return;
    }
    if (!user || parsedRows.length === 0) return;
    setImporting(true);

    const categories = await fetchCategories(householdId).catch(() => []);
    const catMap = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));

    // Ensure a fallback category exists for expenses whose category name doesn't match
    let fallbackCategoryId: string | null = catMap.get("uncategorized") ?? null;
    if (!fallbackCategoryId) {
      try {
        const fallback = await createCategory(householdId, {
          name: "Uncategorized",
          type: "variable",
          monthlyLimit: 0,
        });
        fallbackCategoryId = fallback.id;
        catMap.set("uncategorized", fallback.id);
      } catch {
        fallbackCategoryId = categories[0]?.id ?? null;
      }
    }

    // Fetch existing records for deduplication
    const [
      { data: existingExpenses },
      existingBills,
      { data: existingIncome },
      existingDebts,
      existingGoals,
      existingSubsResult,
    ] = await Promise.all([
      supabase
        .from("expenses")
        .select("description,amount,date")
        .eq("household_id", householdId),
      fetchBills(householdId).catch(() => []),
      supabase
        .from("income_entries")
        .select("source_name,amount,date")
        .eq("household_id", householdId),
      fetchDebts(householdId).catch(() => []),
      fetchGoals(householdId).catch(() => []),
      fetchSubscriptions(householdId).catch(() => ({
        items: [],
        available: false,
      })),
    ]);

    // dedup key sets — within-file duplicates are also caught by adding to the set after insert
    const expenseKeys = new Set(
      (existingExpenses ?? []).map(
        (e: any) =>
          `${(e.description ?? "").toLowerCase()}|${e.amount}|${e.date}`,
      ),
    );
    const billKeys = new Set(existingBills.map((b) => b.name.toLowerCase()));
    const incomeKeys = new Set(
      (existingIncome ?? []).map(
        (e: any) =>
          `${(e.source_name ?? "").toLowerCase()}|${e.amount}|${e.date}`,
      ),
    );
    const subsKeys = new Set(
      (existingSubsResult.items ?? []).map((s: any) => s.name.toLowerCase()),
    );
    const debtKeys = new Set(existingDebts.map((d) => d.name.toLowerCase()));
    const goalKeys = new Set(existingGoals.map((g) => g.name.toLowerCase()));

    const res: ImportResult = {
      total: parsedRows.length,
      succeeded: 0,
      skipped: 0,
      failed: 0,
      byType: {},
      errors: [],
    };

    for (const [i, row] of parsedRows.entries()) {
      const type = (row.type ?? "").trim().toLowerCase();
      const name = (row.name ?? "").trim();
      const amount = parseNum(row.amount);
      const date = (row.date ?? "").trim() || today();
      const frequency = (row.frequency ?? "monthly").trim();
      const categoryId = catMap.get((row.category ?? "").toLowerCase()) ?? null;
      const notes = (row.notes ?? "").trim() || undefined;

      if (!VALID_TYPES.includes(type)) {
        res.failed++;
        res.errors.push(`Row ${i + 2}: unknown type "${type}" — skipped`);
        continue;
      }
      if (!name) {
        res.failed++;
        res.errors.push(`Row ${i + 2} (${type}): name is required — skipped`);
        continue;
      }

      // Dedup check
      const nameLower = name.toLowerCase();
      let isDuplicate = false;
      switch (type) {
        case "expense": {
          const key = `${nameLower}|${amount}|${date}`;
          isDuplicate = expenseKeys.has(key);
          if (!isDuplicate) expenseKeys.add(key);
          break;
        }
        case "bill":
          isDuplicate = billKeys.has(nameLower);
          if (!isDuplicate) billKeys.add(nameLower);
          break;
        case "income": {
          const key = `${nameLower}|${amount}|${date}`;
          isDuplicate = incomeKeys.has(key);
          if (!isDuplicate) incomeKeys.add(key);
          break;
        }
        case "subscription":
          isDuplicate = subsKeys.has(nameLower);
          if (!isDuplicate) subsKeys.add(nameLower);
          break;
        case "debt":
          isDuplicate = debtKeys.has(nameLower);
          if (!isDuplicate) debtKeys.add(nameLower);
          break;
        case "goal":
          isDuplicate = goalKeys.has(nameLower);
          if (!isDuplicate) goalKeys.add(nameLower);
          break;
      }

      if (isDuplicate) {
        res.skipped++;
        continue;
      }

      try {
        switch (type) {
          case "expense":
            await createExpense(householdId, user.id, {
              amount,
              categoryId: (categoryId ?? fallbackCategoryId) as any,
              date,
              description: name,
              notes,
            });
            break;

          case "bill":
            await createBill(householdId, {
              name,
              amount,
              dueDate: date,
              categoryId,
              frequency: (["monthly", "weekly", "yearly", "biweekly"].includes(
                frequency,
              )
                ? frequency
                : "monthly") as any,
              notes,
            });
            break;

          case "income":
            await createIncomeEntry(householdId, user.id, {
              amount,
              sourceName: name,
              type: frequency || "salary",
              date,
              notes,
            });
            break;

          case "subscription":
            await createSubscription(householdId, {
              name,
              amount,
              nextDate: date,
              categoryId: categoryId ?? undefined,
              frequency: frequency === "annual" ? "annual" : "monthly",
              notes,
            });
            break;

          case "debt": {
            const balance = parseNum(row.balance) || amount;
            await createDebt(householdId, {
              name,
              totalBalance: balance,
              currentBalance: parseNum(row.current_amount) || balance,
              monthlyPayment: amount,
              interestRate: parseNum(row.interest_rate),
              notes,
              userId: user.id,
            });
            break;
          }

          case "goal":
            await createGoal(householdId, {
              name,
              targetAmount: parseNum(row.target_amount),
              currentAmount: parseNum(row.current_amount),
              monthlyContribution: amount,
              targetDate: (row.date ?? "").trim() || null,
              notes,
            });
            break;
        }

        res.succeeded++;
        res.byType[type] = (res.byType[type] ?? 0) + 1;
      } catch (err: any) {
        res.failed++;
        res.errors.push(
          `Row ${i + 2} (${type} "${name}"): ${err?.message ?? "unknown error"}`,
        );
      }
    }

    setResult(res);
    setImporting(false);

    if (res.succeeded > 0)
      toast.success(`Imported ${res.succeeded} of ${res.total} rows`);
    if (res.skipped > 0) toast.info(`${res.skipped} duplicate rows skipped`);
    if (res.failed > 0)
      toast.error(`${res.failed} rows failed — see details below`);
  };

  const reset = () => {
    setPreview(null);
    setResult(null);
    setParsedRows([]);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Import Data</CardTitle>
        <CardDescription>
          Upload a CSV to bulk-populate expenses, bills, income, subscriptions,
          debts, and goals. Download the template to see the required format.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!householdId && (
          <p className="text-sm text-muted-foreground">
            You need to{" "}
            <Link to="/household/setup" className="underline text-foreground">
              set up a household
            </Link>{" "}
            before importing data.
          </p>
        )}
        <Button
          variant="outline"
          size="sm"
          onClick={downloadTemplate}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          Download Template
        </Button>

        {/* Drop zone */}
        {!preview && !result && (
          <div
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-foreground/30 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files[0];
              if (file) handleFile(file);
            }}
          >
            <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Drop a CSV here or{" "}
              <span className="text-foreground underline">click to browse</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supported types: expense · bill · income · subscription · debt ·
              goal
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {/* Preview */}
        {preview && !result && (
          <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
            <p className="text-sm font-medium">{preview.total} rows parsed</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(preview.counts).map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-md bg-secondary px-2 py-0.5 text-xs font-mono"
                >
                  {count} {type}
                </span>
              ))}
              {preview.unknown > 0 && (
                <span className="rounded-md bg-destructive/10 text-destructive px-2 py-0.5 text-xs font-mono">
                  {preview.unknown} unknown type
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={handleImport} disabled={importing} className="">
                {importing ? "Importing…" : `Import ${preview.total} rows`}
              </Button>
              <Button variant="outline" onClick={reset} disabled={importing}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center gap-2">
              {result.failed === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-500" />
              )}
              <span className="text-sm font-medium">
                {result.succeeded} imported
                {result.skipped > 0 &&
                  ` · ${result.skipped} skipped (duplicates)`}
                {result.failed > 0 && ` · ${result.failed} failed`}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(result.byType).map(([type, count]) => (
                <span
                  key={type}
                  className="rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-xs font-mono"
                >
                  {count} {type}
                </span>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded border border-destructive/20 bg-destructive/5 p-2 space-y-1">
                {result.errors.map((e, i) => (
                  <p key={i} className="text-xs text-destructive font-mono">
                    {e}
                  </p>
                ))}
              </div>
            )}
            <Button variant="outline" size="sm" onClick={reset}>
              Import another file
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
