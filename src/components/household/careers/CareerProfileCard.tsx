import { useState } from "react";
import { CareerProfile } from "@/integrations/supabase/household-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Briefcase,
  DollarSign,
  Calendar,
  Target,
  TrendingUp,
  Award,
  BookOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
import { useDeleteCareerProfileMutation } from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";
import { SkillsList } from "./SkillsList";
import { AchievementsList } from "./AchievementsList";
import { CareerGoalsList } from "./CareerGoalsList";

interface CareerProfileCardProps {
  profile: CareerProfile;
}

export function CareerProfileCard({ profile }: CareerProfileCardProps) {
  const { user } = useAuth();
  const { householdId, deleteCareerProfileLocal } = useHouseholdBudget();
  const deleteMutation = useDeleteCareerProfileMutation(householdId);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const tenure = differenceInMonths(new Date(), new Date(profile.startDate));
  const tenureYears = Math.floor(tenure / 12);
  const tenureMonths = tenure % 12;
  const tenureText =
    tenureYears > 0 ? `${tenureYears}y ${tenureMonths}m` : `${tenureMonths}m`;

  const employmentTypeLabels = {
    full_time: "Full-time",
    part_time: "Part-time",
    contract: "Contract",
    self_employed: "Self-employed",
    unemployed: "Unemployed",
  };

  const handleDelete = async () => {
    try {
      if (householdId) {
        await deleteMutation.mutateAsync(profile.id);
      } else {
        deleteCareerProfileLocal(profile.id);
      }
      toast.success("Career profile deleted");
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Failed to delete career profile:", error);
      toast.error("Failed to delete career profile");
    }
  };

  return (
    <Card className="border-2 border-border p-6 bg-card">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-muted-foreground" />
              <h3 className="text-xl font-bold">{profile.currentTitle}</h3>
            </div>
            <p className="text-muted-foreground font-mono text-sm">
              {profile.currentCompany}
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs">
                {profile.userName}
              </Badge>
              <Badge variant="secondary" className="font-mono text-xs">
                {employmentTypeLabels[profile.employmentType]}
              </Badge>
              {profile.jobSearchActive && (
                <Badge
                  variant="default"
                  className="font-mono text-xs bg-blue-500"
                >
                  Job Searching
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Pencil className="w-4 h-4" />
            </Button>
            <Dialog
              open={showDeleteConfirm}
              onOpenChange={setShowDeleteConfirm}
            >
              <DialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Delete Career Profile</DialogTitle>
                </DialogHeader>
                <p className="text-sm text-muted-foreground">
                  Are you sure you want to delete this career profile? This will
                  also delete all associated skills, achievements, and goals.
                </p>
                <div className="flex gap-3 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleDelete}>
                    Delete
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="border border-border p-3 bg-background/50">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <DollarSign className="w-3.5 h-3.5" />
              <span className="text-xs font-mono uppercase">Salary</span>
            </div>
            <p className="text-lg font-bold">
              ${profile.currentSalary.toLocaleString()}/mo
            </p>
          </div>

          <div className="border border-border p-3 bg-background/50">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-xs font-mono uppercase">Tenure</span>
            </div>
            <p className="text-lg font-bold">{tenureText}</p>
          </div>

          {profile.nextReviewDate && (
            <div className="border border-border p-3 bg-background/50">
              <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span className="text-xs font-mono uppercase">Review</span>
              </div>
              <p className="text-sm font-bold">
                {format(new Date(profile.nextReviewDate), "MMM d, yyyy")}
              </p>
              {profile.targetRaise && (
                <p className="text-xs text-muted-foreground">
                  Target: +{profile.targetRaise}%
                </p>
              )}
            </div>
          )}

          <div className="border border-border p-3 bg-background/50">
            <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
              <Target className="w-3.5 h-3.5" />
              <span className="text-xs font-mono uppercase">Goals</span>
            </div>
            <p className="text-lg font-bold">
              {
                profile.careerGoals.filter((g) => g.status === "in_progress")
                  .length
              }
              /{profile.careerGoals.length}
            </p>
          </div>
        </div>

        {/* Skills Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-mono text-xs uppercase text-muted-foreground">
              Skills
            </h4>
          </div>
          <SkillsList profileId={profile.id} skills={profile.skills} />
        </div>

        {/* Achievements Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Award className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-mono text-xs uppercase text-muted-foreground">
              Achievements
            </h4>
          </div>
          <AchievementsList
            profileId={profile.id}
            achievements={profile.achievements}
          />
        </div>

        {/* Career Goals Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-muted-foreground" />
            <h4 className="font-mono text-xs uppercase text-muted-foreground">
              Career Goals
            </h4>
          </div>
          <CareerGoalsList profileId={profile.id} goals={profile.careerGoals} />
        </div>
      </div>
    </Card>
  );
}
