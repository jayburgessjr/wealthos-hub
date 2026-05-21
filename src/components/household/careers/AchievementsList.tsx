import { useState } from "react";
import { Achievement } from "@/integrations/supabase/household-types";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Award } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  useCreateAchievementMutation,
  useDeleteAchievementMutation,
} from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";
import { format } from "date-fns";

interface AchievementsListProps {
  profileId: string;
  achievements: Achievement[];
}

interface AchievementFormData {
  title: string;
  description: string;
  date: string;
}

export function AchievementsList({
  profileId,
  achievements,
}: AchievementsListProps) {
  const createMutation = useCreateAchievementMutation(profileId);
  const deleteMutation = useDeleteAchievementMutation(profileId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AchievementFormData>({
    defaultValues: {
      title: "",
      description: "",
      date: "",
    },
  });

  const onSubmit = async (data: AchievementFormData) => {
    try {
      await createMutation.mutateAsync({
        careerProfileId: profileId,
        title: data.title,
        description: data.description,
        date: data.date,
      });
      toast.success("Achievement added");
      reset();
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to add achievement:", error);
      toast.error("Failed to add achievement");
    }
  };

  const handleDelete = async (achievementId: string) => {
    try {
      await deleteMutation.mutateAsync(achievementId);
      toast.success("Achievement removed");
    } catch (error) {
      console.error("Failed to delete achievement:", error);
      toast.error("Failed to delete achievement");
    }
  };

  return (
    <div className="space-y-2">
      {achievements.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No achievements added yet
        </p>
      ) : (
        <div className="space-y-3">
          {achievements.map((achievement) => (
            <div
              key={achievement.id}
              className="border border-border p-3 bg-background/50 group"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="w-4 h-4 text-amber-500" />
                    <h5 className="font-semibold">{achievement.title}</h5>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">
                    {achievement.description}
                  </p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {format(new Date(achievement.date), "MMMM yyyy")}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => handleDelete(achievement.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="font-mono text-xs h-8">
            <Plus className="w-3 h-3 mr-1" />
            Add Achievement
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">Add Achievement</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="title" className="font-mono text-xs uppercase">
                Title *
              </Label>
              <Input
                id="title"
                {...register("title", { required: "Title is required" })}
                placeholder="e.g., Promoted to Senior Engineer"
                className="font-mono"
              />
              {errors.title && (
                <p className="text-sm text-destructive mt-1">
                  {errors.title.message}
                </p>
              )}
            </div>

            <div>
              <Label
                htmlFor="description"
                className="font-mono text-xs uppercase"
              >
                Description *
              </Label>
              <Textarea
                id="description"
                {...register("description", {
                  required: "Description is required",
                })}
                placeholder="Describe the achievement and its impact..."
                className="font-mono"
                rows={3}
              />
              {errors.description && (
                <p className="text-sm text-destructive mt-1">
                  {errors.description.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="date" className="font-mono text-xs uppercase">
                Date *
              </Label>
              <Input
                id="date"
                type="date"
                {...register("date", { required: "Date is required" })}
                className="font-mono"
              />
              {errors.date && (
                <p className="text-sm text-destructive mt-1">
                  {errors.date.message}
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 font-mono"
              >
                {isSubmitting ? "ADDING..." : "ADD ACHIEVEMENT"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
