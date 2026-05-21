import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/components/AuthProvider";
import { createHousehold } from "@/integrations/supabase/household-queries";
import { toast } from "sonner";

export default function HouseholdSetup() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("My Household");
  const [monthlyIncome, setMonthlyIncome] = useState("6500");
  const [busy, setBusy] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const income = parseFloat(monthlyIncome || "0") || 0;
    try {
      setBusy(true);
      await createHousehold(name.trim() || "Household", income);
      toast.success("Household created");
      navigate("/household");
      window.location.reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Failed to create household");
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-lg mx-auto border-2 border-border p-6 bg-card">
        <h1 className="text-2xl font-bold mb-2">Set up your household</h1>
        <p className="text-sm text-muted-foreground mb-6 font-mono">
          Create a shared space for your budget. You'll be the owner.
        </p>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase">
              Household Name
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., The Burgess Family"
            />
          </div>
          <div className="space-y-2">
            <Label className="font-mono text-xs uppercase">
              Monthly Income
            </Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                min="0"
                step="0.01"
                className="pl-7 font-mono"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(e.target.value)}
                placeholder="6500"
              />
            </div>
          </div>
          <Button type="submit" className="w-full font-mono" disabled={busy}>
            {busy ? "Creating…" : "Create Household"}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
