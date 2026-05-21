import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, TrendingUp, TrendingDown, Minus, Upload } from "lucide-react";
import { CsvImportDialog } from "@/components/household/import/CsvImportDialog";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { DemoBanner } from "@/components/household/layout/DemoBanner";
import { useDemoMode } from "@/hooks/useHouseholdDemoMode";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/components/AuthProvider";
import {
  useCreateCreditScoreMutation,
  useDeleteCreditScoreMutation,
} from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";

const HouseholdCreditScores = () => {
  const {
    budget,
    householdId,
    isLoading,
    error,
    addCreditScoreLocal,
    deleteCreditScoreLocal,
  } = useHouseholdBudget();
  const { demoMode } = useDemoMode();
  const { user } = useAuth();
  const [showAddForm, setShowAddForm] = useState(false);
  const createScore = useCreateCreditScoreMutation(householdId);
  const deleteScore = useDeleteCreditScoreMutation(householdId);
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    ok: number;
    fail: number;
  }>({
    ok: 0,
    fail: 0,
  });
  const [selectedUser, setSelectedUser] = useState<string>("all");

  const getLatestScore = (userId: string) => {
    const userScores = budget.creditScores
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return userScores.length > 0 ? userScores[0] : null;
  };

  const getScoreChange = (userId: string) => {
    const userScores = budget.creditScores
      .filter((entry) => entry.userId === userId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (userScores.length < 2) return null;
    return userScores[0].score - userScores[1].score;
  };

  const users = [
    ...new Set(
      budget.creditScores.map((entry) => ({
        id: entry.userId,
        name: entry.userName,
      })),
    ),
  ];

  const filteredScores =
    selectedUser === "all"
      ? budget.creditScores
      : budget.creditScores.filter((entry) => entry.userId === selectedUser);

  const sortedScores = [...filteredScores].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  const getScoreRating = (score: number) => {
    if (score >= 800)
      return {
        label: "Exceptional",
        color: "text-green-700",
        bg: "bg-green-100",
      };
    if (score >= 740)
      return { label: "Very Good", color: "text-blue-700", bg: "bg-blue-100" };
    if (score >= 670)
      return { label: "Good", color: "text-teal-700", bg: "bg-teal-100" };
    if (score >= 580)
      return { label: "Fair", color: "text-yellow-700", bg: "bg-yellow-100" };
    return { label: "Poor", color: "text-red-700", bg: "bg-red-100" };
  };

  const [score, setScore] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [bureau, setBureau] = useState("");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseInt(score, 10);
    if (isNaN(val) || val < 300 || val > 850) {
      toast.error("Enter a valid score (300-850)");
      return;
    }
    if (!user) {
      toast.error("Not signed in");
      return;
    }
    if (demoMode || !householdId) {
      addCreditScoreLocal({
        userId: user.id,
        userName: user.email ?? "You",
        score: val,
        date,
        bureau: (bureau || undefined) as any,
      });
      toast.success("Credit score added (demo)");
      setShowAddForm(false);
      setScore("");
      return;
    }
    createScore.mutate(
      { userId: user.id, score: val, date, bureau: bureau || null },
      {
        onSuccess: () => {
          toast.success("Credit score added");
          setShowAddForm(false);
          setScore("");
        },
        onError: () => toast.error("Failed to add score"),
      },
    );
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Delete this credit score entry?")) {
      if (demoMode || !householdId) {
        deleteCreditScoreLocal(id);
        toast.success("Deleted (demo)");
      } else {
        deleteScore.mutate(id, {
          onSuccess: () => toast.success("Deleted"),
          onError: () => toast.error("Failed to delete"),
        });
      }
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground font-mono">
          Loading credit…
        </div>
      </DashboardLayout>
    );
  }
  if (error) {
    return (
      <DashboardLayout>
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="border-2 border-destructive p-4 bg-card max-w-lg">
            <p className="font-bold mb-1">Failed to load credit scores</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 md:space-y-6">
        {demoMode && <DemoBanner />}
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold text-gray-900">
              Credit Scores
            </h1>
            <p className="text-sm md:text-base text-gray-600 mt-1 md:mt-2">
              Track your credit health over time
            </p>
          </div>
          <div className="flex gap-2">
            <CsvImportDialog
              trigger={
                <Button className="gap-2 w-full sm:w-auto" variant="outline">
                  <Upload className="h-4 w-4" />
                  Import CSV
                </Button>
              }
              title="Import Credit Scores"
              template={{
                filename: "credit_scores_template.csv",
                headers: ["score", "date", "bureau", "user_email"],
                sampleRows: [
                  ["720", "2025-01-05", "experian", "you@example.com"],
                ],
              }}
              fields={[
                { key: "score", label: "Score", type: "number" },
                { key: "date", label: "Date", type: "date" },
                { key: "bureau", label: "Bureau", optional: true },
                { key: "user_email", label: "User Email", optional: true },
              ]}
              synonyms={{
                score: ["score"],
                date: ["date"],
                bureau: ["bureau"],
                user_email: ["useremail", "email", "memberemail"],
              }}
              storageKey="import:credit_scores"
              onImport={async (rowsMapped) => {
                setImporting(true);
                let ok = 0,
                  fail = 0;
                const errors: { row: number; reason: string }[] = [];
                let emailToId: Record<string, string> = {};
                try {
                  if (householdId) {
                    const map = await (
                      await import("@/integrations/supabase/household-queries")
                    ).fetchProfilesForHousehold(householdId);
                    const inv: Record<string, string> = {};
                    Object.entries(map).forEach(([id, p]: any) => {
                      inv[(p.email as string).toLowerCase()] = id;
                    });
                    emailToId = inv;
                  }
                } catch {}
                for (let i = 0; i < rowsMapped.length; i++) {
                  try {
                    const r = rowsMapped[i];
                    const scoreVal = Number(r.score);
                    const dateVal = String(r.date);
                    const bureauVal = r.bureau ? String(r.bureau) : null;
                    let uid = user?.id || "local";
                    if (r.user_email) {
                      const e = String(r.user_email).toLowerCase();
                      uid = emailToId[e] || uid;
                    }
                    if (isNaN(scoreVal) || !dateVal) {
                      fail++;
                      errors.push({
                        row: i + 1,
                        reason: "Invalid score or date",
                      });
                      continue;
                    }
                    if (demoMode || !householdId) {
                      addCreditScoreLocal({
                        userId: uid,
                        userName: user?.email || "You",
                        score: scoreVal,
                        date: dateVal,
                        bureau: (bureauVal || undefined) as any,
                      });
                    } else {
                      await createScore.mutateAsync({
                        userId: uid,
                        score: scoreVal,
                        date: dateVal,
                        bureau: bureauVal,
                      });
                    }
                    ok++;
                  } catch {
                    fail++;
                    errors.push({ row: i + 1, reason: "Failed to import row" });
                  }
                }
                setImportSummary({ ok, fail });
                setImporting(false);
                return { ok, fail, errors };
              }}
            />
            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
              <DialogTrigger asChild>
                <Button className="gap-2 w-full sm:w-auto">
                  <Plus className="h-4 w-4" />
                  Add Score
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-bold">
                    Add Credit Score
                  </DialogTitle>
                </DialogHeader>
                <form onSubmit={handleAdd} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Score
                      </Label>
                      <Input
                        type="number"
                        min="300"
                        max="850"
                        value={score}
                        onChange={(e) => setScore(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-mono text-xs uppercase">
                        Date
                      </Label>
                      <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Bureau
                    </Label>
                    <Select value={bureau} onValueChange={setBureau}>
                      <SelectTrigger className="font-mono">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {["experian", "equifax", "transunion", "vantage"].map(
                          (b) => (
                            <SelectItem key={b} value={b}>
                              {b}
                            </SelectItem>
                          ),
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button type="submit" className="font-mono">
                      Add
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="font-mono"
                      onClick={() => setShowAddForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* User Filter Tabs */}
        {users.length > 0 && (
          <div className="flex gap-2">
            <Button
              variant={selectedUser === "all" ? "default" : "outline"}
              onClick={() => setSelectedUser("all")}
              size="sm"
            >
              All Members
            </Button>
            {users.map((u) => (
              <Button
                key={u.id}
                variant={selectedUser === u.id ? "default" : "outline"}
                onClick={() => setSelectedUser(u.id)}
                size="sm"
              >
                {u.name}
              </Button>
            ))}
          </div>
        )}

        {/* Current Scores */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {users.map((u) => {
            const latestScore = getLatestScore(u.id);
            const scoreChange = getScoreChange(u.id);
            if (!latestScore) return null;
            const rating = getScoreRating(latestScore.score);
            return (
              <Card key={u.id} className="border-2">
                <CardHeader>
                  <CardDescription className="text-xs md:text-sm">
                    {u.name}'s Credit Score
                  </CardDescription>
                  <CardTitle className="text-3xl md:text-5xl font-bold">
                    {latestScore.score}
                  </CardTitle>
                  <div
                    className={`inline-block px-3 py-1 rounded-full text-xs md:text-sm font-medium ${rating.bg} ${rating.color}`}
                  >
                    {rating.label}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {scoreChange !== null && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">
                          Change from last entry:
                        </span>
                        <span
                          className={`flex items-center gap-1 font-semibold ${
                            scoreChange > 0
                              ? "text-green-600"
                              : scoreChange < 0
                                ? "text-red-600"
                                : "text-gray-600"
                          }`}
                        >
                          {scoreChange > 0 ? (
                            <TrendingUp className="h-4 w-4" />
                          ) : scoreChange < 0 ? (
                            <TrendingDown className="h-4 w-4" />
                          ) : (
                            <Minus className="h-4 w-4" />
                          )}
                          {scoreChange > 0 ? "+" : ""}
                          {scoreChange}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-gray-600">Last updated:</p>
                      <p className="font-medium">
                        {new Date(latestScore.date).toLocaleDateString()}
                      </p>
                    </div>
                    {latestScore.bureau && (
                      <div>
                        <p className="text-sm text-gray-600">Bureau:</p>
                        <p className="font-medium capitalize">
                          {latestScore.bureau}
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Score History */}
        <Card>
          <CardHeader>
            <CardTitle>Score History</CardTitle>
            <CardDescription>
              {selectedUser === "all"
                ? "All household members"
                : users.find((u) => u.id === selectedUser)?.name ||
                  "Selected member"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sortedScores.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 mb-4">
                  No credit scores recorded yet
                </p>
                <Button onClick={() => setShowAddForm(true)} variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Your First Score
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedScores.map((entry, index) => {
                  const rating = getScoreRating(entry.score);
                  const previousEntry = sortedScores[index + 1];
                  const change = previousEntry
                    ? entry.score - previousEntry.score
                    : null;
                  return (
                    <div
                      key={entry.id}
                      className="flex justify-between items-center p-4 border rounded-lg hover:bg-gray-50"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`px-4 py-2 rounded-lg ${rating.bg}`}>
                          <p
                            className={`text-xl md:text-2xl font-bold ${rating.color}`}
                          >
                            {entry.score}
                          </p>
                        </div>
                        <div>
                          <p className="font-semibold">{entry.userName}</p>
                          <p className="text-sm text-gray-600">
                            {new Date(entry.date).toLocaleDateString()}
                          </p>
                          {entry.bureau && (
                            <p className="text-xs text-gray-500 capitalize">
                              {entry.bureau}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {change !== null && (
                          <div
                            className={`flex items-center gap-1 ${
                              change > 0
                                ? "text-green-600"
                                : change < 0
                                  ? "text-red-600"
                                  : "text-gray-600"
                            }`}
                          >
                            {change > 0 ? (
                              <TrendingUp className="h-4 w-4" />
                            ) : change < 0 ? (
                              <TrendingDown className="h-4 w-4" />
                            ) : (
                              <Minus className="h-4 w-4" />
                            )}
                            <span className="font-semibold">
                              {change > 0 ? "+" : ""}
                              {change}
                            </span>
                          </div>
                        )}
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${rating.bg} ${rating.color}`}
                        >
                          {rating.label}
                        </span>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(entry.id)}
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

        {/* Credit Score Ranges */}
        <Card>
          <CardHeader>
            <CardTitle>Understanding Credit Scores</CardTitle>
            <CardDescription>FICO Score ranges (300-850)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between items-center p-3 bg-green-100 rounded-lg">
                <span className="font-semibold text-green-800">
                  Exceptional
                </span>
                <span className="text-green-700">800-850</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-100 rounded-lg">
                <span className="font-semibold text-blue-800">Very Good</span>
                <span className="text-blue-700">740-799</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-teal-100 rounded-lg">
                <span className="font-semibold text-teal-800">Good</span>
                <span className="text-teal-700">670-739</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-100 rounded-lg">
                <span className="font-semibold text-yellow-800">Fair</span>
                <span className="text-yellow-700">580-669</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-100 rounded-lg">
                <span className="font-semibold text-red-800">Poor</span>
                <span className="text-red-700">300-579</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tips */}
        <Card>
          <CardHeader>
            <CardTitle>Tips for Improving Your Credit Score</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc list-inside space-y-2 text-sm text-gray-700">
              <li>
                Pay all bills on time - payment history is 35% of your score
              </li>
              <li>
                Keep credit utilization below 30% of your available credit
              </li>
              <li>
                Don't close old credit cards - length of credit history matters
              </li>
              <li>Limit new credit applications to avoid hard inquiries</li>
              <li>
                Monitor your credit report for errors and dispute inaccuracies
              </li>
              <li>
                Consider becoming an authorized user on someone's good credit
                account
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default HouseholdCreditScores;
