import { useState } from "react";
import {
  CareerGoal,
  CareerGoalStatus,
} from "@/integrations/supabase/household-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, CheckCircle2, Circle, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  useCreateCareerGoalMutation,
  useDeleteCareerGoalMutation,
  useUpdateCareerGoalMutation,
} from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";
import { format } from "date-fns";

interface CareerGoalsListProps {
  profileId: string;
  goals: CareerGoal[];
}

interface CareerGoalFormData {
  title: string;
  description: string;
  targetDate: string;
}

export function CareerGoalsList({ profileId, goals }: CareerGoalsListProps) {
  const createMutation = useCreateCareerGoalMutation(profileId);
  const updateMutation = useUpdateCareerGoalMutation(profileId);
  const deleteMutation = useDeleteCareerGoalMutation(profileId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalStatus, setGoalStatus] = useState<CareerGoalStatus>("planning");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CareerGoalFormData>({
    defaultValues: {
      title: "",
      description: "",
      targetDate: "",
    },
  });

  const onSubmit = async (data: CareerGoalFormData) => {
    try {
      await createMutation.mutateAsync({
        careerProfileId: profileId,
        title: data.title,
        description: data.description,
        targetDate: data.targetDate,
        status: goalStatus,
      });
      toast.success("Career goal added");
      reset();
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to add goal:", error);
      toast.error("Failed to add goal");
    }
  };

  const handleStatusChange = async (
    goalId: string,
    newStatus: CareerGoalStatus,
  ) => {
    try {
      await updateMutation.mutateAsync({
        id: goalId,
        updates: { status: newStatus },
      });
      toast.success("Goal status updated");
    } catch (error) {
      console.error("Failed to update goal:", error);
      toast.error("Failed to update goal");
    }
  };

  const handleDelete = async (goalId: string) => {
    try {
      await deleteMutation.mutateAsync(goalId);
      toast.success("Goal removed");
    } catch (error) {
      console.error("Failed to delete goal:", error);
      toast.error("Failed to delete goal");
    }
  };

  const statusIcons = {
    planning: Circle,
    in_progress: Clock,
    completed: CheckCircle2,
  };

  const statusColors = {
    planning: "text-gray-400",
    in_progress: "text-blue-500",
    completed: "text-green-500",
  };

  return (
    <div className="space-y-2">
      {goals.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No career goals set yet
        </p>
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const StatusIcon = statusIcons[goal.status];
            return (
              <div
                key={goal.id}
                className="border border-border p-3 bg-background/50 group"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon
                        className={`w-4 h-4 ${statusColors[goal.status]}`}
                      />
                      <h5 className="font-semibold">{goal.title}</h5>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {goal.description}
                    </p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Select
                        value={goal.status}
                        onValueChange={(value) =>
                          handleStatusChange(goal.id, value as CareerGoalStatus)
                        }
                      >
                        <SelectTrigger className="h-7 w-32 font-mono text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="in_progress">
                            In Progress
                          </SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      {goal.targetDate && (
                        <Badge variant="outline" className="font-mono text-xs">
                          Target:{" "}
                          {format(new Date(goal.targetDate), "MMM d, yyyy")}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDelete(goal.id)}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="font-mono text-xs h-8">
            <Plus className="w-3 h-3 mr-1" />
            Add Goal
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">Add Career Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="title" className="font-mono text-xs uppercase">
                Goal Title *
              </Label>
              <Input
                id="title"
                {...register("title", { required: "Title is required" })}
                placeholder="e.g., Get AWS Certification"
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
                placeholder="Describe what you want to achieve and why..."
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
              <Label htmlFor="status" className="font-mono text-xs uppercase">
                Status
              </Label>
              <Select
                value={goalStatus}
                onValueChange={(value) =>
                  setGoalStatus(value as CareerGoalStatus)
                }
              >
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">Planning</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="targetDate"
                className="font-mono text-xs uppercase"
              >
                Target Date
              </Label>
              <Input
                id="targetDate"
                type="date"
                {...register("targetDate")}
                className="font-mono"
              />
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
                {isSubmitting ? "ADDING..." : "ADD GOAL"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
