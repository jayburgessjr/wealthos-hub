import { useState } from "react";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TabNav from "@/components/layout/TabNav";
import { GoalCard } from "@/components/household/budget/GoalCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Target, TrendingUp, ImageIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCreateBillMutation } from "@/hooks/useHouseholdBudgetData";

export default function HouseholdGoals() {
  const {
    budget,
    householdId,
    addGoal,
    updateGoal,
    deleteGoal,
    isLoading,
    error,
  } = useHouseholdBudget();
  const { toast } = useToast();
  const createBillMutation = useCreateBillMutation(householdId);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editTargetAmount, setEditTargetAmount] = useState("");
  const [editCurrentAmount, setEditCurrentAmount] = useState("");
  const [editMonthlyContribution, setEditMonthlyContribution] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editImagePath, setEditImagePath] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [currentAmount, setCurrentAmount] = useState("");
  const [monthlyContribution, setMonthlyContribution] = useState("");
  const [deadline, setDeadline] = useState("");
  const [imagePath, setImagePath] = useState("");
  const [notes, setNotes] = useState("");
  const [createLinkedBill, setCreateLinkedBill] = useState(false);
  const [billDueDate, setBillDueDate] = useState("");

  const totalSaved = budget.goals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = budget.goals.reduce((sum, g) => sum + g.targetAmount, 0);
  const totalMonthly = budget.goals.reduce(
    (sum, g) => sum + g.monthlyContribution,
    0,
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || !targetAmount || !monthlyContribution) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    const goalData = {
      name,
      targetAmount: parseFloat(targetAmount),
      currentAmount: parseFloat(currentAmount) || 0,
      monthlyContribution: parseFloat(monthlyContribution),
      deadline: deadline || undefined,
      imagePath: imagePath || undefined,
      notes: notes || undefined,
    };

    if (createLinkedBill && billDueDate && householdId) {
      try {
        const bill = await createBillMutation.mutateAsync({
          name: `${name} Savings`,
          amount: parseFloat(monthlyContribution),
          dueDate: billDueDate,
          isRecurring: true,
          frequency: "monthly",
          notes: `Monthly contribution for goal: ${name}`,
        });
        addGoal({ ...goalData, linkedBillId: bill.id });
      } catch (err) {
        console.error("Failed to create linked bill", err);
        toast({
          title: "Error",
          description:
            "Failed to create linked bill. Goal created without link.",
          variant: "destructive",
        });
        addGoal(goalData);
      }
    } else {
      addGoal(goalData);
    }

    toast({
      title: "Goal created",
      description: `${name} has been added to your goals.`,
    });

    setName("");
    setTargetAmount("");
    setCurrentAmount("");
    setMonthlyContribution("");
    setDeadline("");
    setImagePath("");
    setNotes("");
    setCreateLinkedBill(false);
    setBillDueDate("");
    setDialogOpen(false);
  };

  const openEdit = (goalId: string) => {
    const g = budget.goals.find((x) => x.id === goalId);
    if (!g) return;
    setEditingId(goalId);
    setEditName(g.name);
    setEditTargetAmount(String(g.targetAmount));
    setEditCurrentAmount(String(g.currentAmount));
    setEditMonthlyContribution(String(g.monthlyContribution));
    setEditDeadline(g.deadline || "");
    setEditImagePath(g.imagePath || "");
    setEditNotes(g.notes || "");
    setEditOpen(true);
  };

  const handleEditSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editName) {
      toast({
        title: "Invalid input",
        description: "Please provide a name.",
        variant: "destructive",
      });
      return;
    }
    updateGoal(editingId, {
      name: editName,
      targetAmount: parseFloat(editTargetAmount) || 0,
      currentAmount: parseFloat(editCurrentAmount) || 0,
      monthlyContribution: parseFloat(editMonthlyContribution) || 0,
      deadline: editDeadline || undefined,
      imagePath: editImagePath || undefined,
      notes: editNotes || undefined,
    });
    toast({ title: "Goal updated", description: `${editName} saved.` });
    setEditOpen(false);
  };

  const handleDelete = (goalId: string) => {
    const g = budget.goals.find((x) => x.id === goalId);
    if (!g) return;
    if (window.confirm(`Delete goal "${g.name}"?`)) {
      deleteGoal(goalId);
      toast({ title: "Goal deleted", description: `${g.name} removed.` });
    }
  };

  const linkedBillsMap = new Map(
    budget.goals
      .filter((g) => g.linkedBillId)
      .map((g) => [g.id, budget.bills.find((b) => b.id === g.linkedBillId)]),
  );

  if (isLoading) {
    return (
      <DashboardLayout>
        <TabNav group="household-future" />
        <div className="min-h-[40vh] flex items-center justify-center text-muted-foreground font-mono">
          Loading goals…
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <TabNav group="household-future" />
        <div className="min-h-[40vh] flex items-center justify-center">
          <div className="border-2 border-destructive p-4 bg-card max-w-lg">
            <p className="font-bold mb-1">Failed to load goals</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        </div>
        {budget.goals.length === 0 && (
          <div className="border-2 border-border p-4 bg-secondary flex items-center justify-between">
            <p className="text-sm">
              No goals yet. Create your first savings goal.
            </p>
            <Button
              size="sm"
              onClick={() => setDialogOpen(true)}
              className="font-mono text-xs"
            >
              ADD GOAL
            </Button>
          </div>
        )}
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TabNav group="household-future" />
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Future
              </span>
            </div>
            <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
              Financial <span className="text-emerald-500">Goals</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Track your financial goals.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                ADD GOAL
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-bold">New Goal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Goal Name
                  </Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., Emergency Fund"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Target Amount
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={targetAmount}
                        onChange={(e) => setTargetAmount(e.target.value)}
                        placeholder="10000"
                        className="pl-7 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Already Saved
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentAmount}
                        onChange={(e) => setCurrentAmount(e.target.value)}
                        placeholder="0"
                        className="pl-7 font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Monthly Contribution
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={monthlyContribution}
                        onChange={(e) => setMonthlyContribution(e.target.value)}
                        placeholder="500"
                        className="pl-7 font-mono"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-mono text-xs uppercase">
                      Target Date
                    </Label>
                    <Input
                      type="date"
                      value={deadline}
                      onChange={(e) => setDeadline(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" /> Image URL (optional)
                  </Label>
                  <Input
                    value={imagePath}
                    onChange={(e) => setImagePath(e.target.value)}
                    placeholder="https://example.com/image.jpg"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Notes (optional)
                  </Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any notes about this goal..."
                    rows={2}
                  />
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="createLinkedBill"
                      checked={createLinkedBill}
                      onCheckedChange={(checked) =>
                        setCreateLinkedBill(checked === true)
                      }
                    />
                    <Label
                      htmlFor="createLinkedBill"
                      className="text-sm cursor-pointer"
                    >
                      Create a recurring monthly bill for contributions
                    </Label>
                  </div>

                  {createLinkedBill && (
                    <div className="space-y-2 pl-6">
                      <Label className="font-mono text-xs uppercase">
                        Bill Due Date
                      </Label>
                      <Input
                        type="date"
                        value={billDueDate}
                        onChange={(e) => setBillDueDate(e.target.value)}
                        required={createLinkedBill}
                      />
                      <p className="text-xs text-muted-foreground">
                        A monthly bill for ${monthlyContribution || "0"} will be
                        created
                      </p>
                    </div>
                  )}
                </div>

                <Button type="submit" className="w-full font-mono">
                  CREATE GOAL
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border-2 border-border p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Target className="w-4 h-4" />
              <span className="text-xs font-mono uppercase">Total Saved</span>
            </div>
            <p className="text-3xl font-bold font-mono text-[hsl(var(--status-safe))]">
              ${totalSaved.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              of ${totalTarget.toLocaleString()} total target
            </p>
          </div>

          <div className="border-2 border-border p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-mono uppercase">
                Monthly Savings
              </span>
            </div>
            <p className="text-3xl font-bold font-mono">
              ${totalMonthly.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              committed per month
            </p>
          </div>

          <div className="border-2 border-border p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <span className="text-xs font-mono uppercase">Progress</span>
            </div>
            <p className="text-3xl font-bold font-mono">
              {totalTarget > 0
                ? ((totalSaved / totalTarget) * 100).toFixed(0)
                : 0}
              %
            </p>
            <p className="text-xs text-muted-foreground font-mono mt-1">
              overall completion
            </p>
          </div>
        </div>

        {/* Goals grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budget.goals.map((goal) => (
            <div key={goal.id} className="space-y-2">
              <GoalCard goal={goal} linkedBill={linkedBillsMap.get(goal.id)} />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="font-mono"
                  onClick={() => openEdit(goal.id)}
                >
                  Edit
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  className="font-mono"
                  onClick={() => handleDelete(goal.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Edit dialog */}
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-bold">Edit Goal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEditSave} className="space-y-4">
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Goal Name</Label>
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="e.g., Emergency Fund"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Target Amount
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editTargetAmount}
                      onChange={(e) => setEditTargetAmount(e.target.value)}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Already Saved
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editCurrentAmount}
                      onChange={(e) => setEditCurrentAmount(e.target.value)}
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Monthly Contribution
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                      $
                    </span>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={editMonthlyContribution}
                      onChange={(e) =>
                        setEditMonthlyContribution(e.target.value)
                      }
                      className="pl-7 font-mono"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-mono text-xs uppercase">
                    Target Date
                  </Label>
                  <Input
                    type="date"
                    value={editDeadline}
                    onChange={(e) => setEditDeadline(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" /> Image URL
                </Label>
                <Input
                  value={editImagePath}
                  onChange={(e) => setEditImagePath(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="space-y-2">
                <Label className="font-mono text-xs uppercase">Notes</Label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Any notes about this goal..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="font-mono">
                  Save
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="font-mono"
                  onClick={() => setEditOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {budget.goals.length === 0 && (
          <div className="text-center py-12 border-2 border-dashed border-border">
            <Target className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No goals set yet.</p>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(true)}
              className="font-mono"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create your first goal
            </Button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
