import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Plus,
  Briefcase,
  DollarSign,
  Calendar,
  TrendingUp,
} from "lucide-react";
import { CareerProfileCard } from "@/components/household/careers/CareerProfileCard";
import { CareerProfileForm } from "@/components/household/careers/CareerProfileForm";

export default function HouseholdCareers() {
  const { budget } = useHouseholdBudget();
  const [dialogOpen, setDialogOpen] = useState(false);

  const totalHouseholdIncome = budget.careerProfiles.reduce(
    (sum, p) => sum + (p.currentSalary || 0),
    0,
  );
  const activeProfiles = budget.careerProfiles.filter(
    (p) => p.employmentType !== "unemployed",
  );
  const upcomingReviews = budget.careerProfiles.filter(
    (p) => p.nextReviewDate,
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Careers</h1>
            <p className="text-muted-foreground font-mono text-xs md:text-sm mt-1">
              Professional development and income tracking
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="font-mono shadow-sm">
                <Plus className="w-4 h-4 mr-2" />
                ADD CAREER
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="font-bold">
                  Add Career Profile
                </DialogTitle>
              </DialogHeader>
              <CareerProfileForm onSuccess={() => setDialogOpen(false)} />
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="border-2 border-border p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-xs font-mono uppercase">Total Income</span>
            </div>
            <p className="text-2xl font-bold">
              ${totalHouseholdIncome.toLocaleString()}/mo
            </p>
          </div>

          <div className="border-2 border-border p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Briefcase className="w-4 h-4" />
              <span className="text-xs font-mono uppercase">
                Active Careers
              </span>
            </div>
            <p className="text-2xl font-bold">{activeProfiles.length}</p>
          </div>

          <div className="border-2 border-border p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Calendar className="w-4 h-4" />
              <span className="text-xs font-mono uppercase">
                Upcoming Reviews
              </span>
            </div>
            <p className="text-2xl font-bold">{upcomingReviews}</p>
          </div>

          <div className="border-2 border-border p-4 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs font-mono uppercase">Active Goals</span>
            </div>
            <p className="text-2xl font-bold">
              {budget.careerProfiles.reduce(
                (sum, p) =>
                  sum +
                  p.careerGoals.filter((g) => g.status === "in_progress")
                    .length,
                0,
              )}
            </p>
          </div>
        </div>

        {/* Career Profiles */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Career Profiles</h2>
          {budget.careerProfiles.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-border">
              <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                No career profiles yet. Add your first career!
              </p>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(true)}
                className="font-mono"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Career Profile
              </Button>
            </div>
          ) : (
            <div className="grid gap-4">
              {budget.careerProfiles.map((profile) => (
                <CareerProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
