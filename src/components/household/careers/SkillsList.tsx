import { useState } from "react";
import { Skill, SkillLevel } from "@/integrations/supabase/household-types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import {
  useCreateSkillMutation,
  useDeleteSkillMutation,
} from "@/hooks/useHouseholdBudgetData";
import { toast } from "sonner";

interface SkillsListProps {
  profileId: string;
  skills: Skill[];
}

interface SkillFormData {
  name: string;
  level: SkillLevel;
  yearsExperience: number;
}

export function SkillsList({ profileId, skills }: SkillsListProps) {
  const createMutation = useCreateSkillMutation(profileId);
  const deleteMutation = useDeleteSkillMutation(profileId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [skillLevel, setSkillLevel] = useState<SkillLevel>("intermediate");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SkillFormData>({
    defaultValues: {
      name: "",
      level: "intermediate",
      yearsExperience: 0,
    },
  });

  const onSubmit = async (data: SkillFormData) => {
    try {
      await createMutation.mutateAsync({
        careerProfileId: profileId,
        name: data.name,
        level: skillLevel,
        yearsExperience: Number(data.yearsExperience) || 0,
      });
      toast.success("Skill added");
      reset();
      setDialogOpen(false);
    } catch (error) {
      console.error("Failed to add skill:", error);
      toast.error("Failed to add skill");
    }
  };

  const handleDelete = async (skillId: string) => {
    try {
      await deleteMutation.mutateAsync(skillId);
      toast.success("Skill removed");
    } catch (error) {
      console.error("Failed to delete skill:", error);
      toast.error("Failed to delete skill");
    }
  };

  const skillLevelColors = {
    beginner: "bg-yellow-500",
    intermediate: "bg-blue-500",
    advanced: "bg-purple-500",
    expert: "bg-green-500",
  };

  return (
    <div className="space-y-2">
      {skills.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No skills added yet
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <Badge
              key={skill.id}
              variant="outline"
              className="font-mono text-xs pr-1 gap-1"
            >
              <span
                className={`w-2 h-2 rounded-full ${skillLevelColors[skill.level]}`}
              />
              {skill.name}
              <span className="text-muted-foreground">
                ({skill.yearsExperience || 0}y)
              </span>
              <button
                onClick={() => handleDelete(skill.id)}
                className="ml-1 hover:text-destructive"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="font-mono text-xs h-8">
            <Plus className="w-3 h-3 mr-1" />
            Add Skill
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-bold">Add Skill</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name" className="font-mono text-xs uppercase">
                Skill Name *
              </Label>
              <Input
                id="name"
                {...register("name", { required: "Skill name is required" })}
                placeholder="e.g., React, Python, Leadership"
                className="font-mono"
              />
              {errors.name && (
                <p className="text-sm text-destructive mt-1">
                  {errors.name.message}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="level" className="font-mono text-xs uppercase">
                Proficiency Level
              </Label>
              <Select
                value={skillLevel}
                onValueChange={(value) => setSkillLevel(value as SkillLevel)}
              >
                <SelectTrigger className="font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="beginner">Beginner</SelectItem>
                  <SelectItem value="intermediate">Intermediate</SelectItem>
                  <SelectItem value="advanced">Advanced</SelectItem>
                  <SelectItem value="expert">Expert</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label
                htmlFor="yearsExperience"
                className="font-mono text-xs uppercase"
              >
                Years of Experience
              </Label>
              <Input
                id="yearsExperience"
                type="number"
                step="0.5"
                {...register("yearsExperience")}
                placeholder="0"
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
                {isSubmitting ? "ADDING..." : "ADD SKILL"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
