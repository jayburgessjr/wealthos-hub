import { useState } from "react";
import { useForm } from "react-hook-form";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";
import { useAuth } from "@/components/AuthProvider";
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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  CreateCareerProfileInput,
  EmploymentType,
} from "@/integrations/supabase/household-types";
import { useCreateCareerProfileMutation } from "@/hooks/useHouseholdBudgetData";

interface CareerProfileFormProps {
  onSuccess?: () => void;
}

export function CareerProfileForm({ onSuccess }: CareerProfileFormProps) {
  const { user } = useAuth();
  const { householdId, addCareerProfileLocal } = useHouseholdBudget();
  const createMutation = useCreateCareerProfileMutation(
    householdId,
    user?.id || "",
  );

  const [jobSearchActive, setJobSearchActive] = useState(false);
  const [employmentType, setEmploymentType] =
    useState<EmploymentType>("full_time");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<CreateCareerProfileInput>({
    defaultValues: {
      currentTitle: "",
      currentCompany: "",
      startDate: "",
      employmentType: "full_time",
      currentSalary: 0,
      nextReviewDate: "",
      targetRaise: 0,
      jobSearchActive: false,
    },
  });

  const onSubmit = async (data: CreateCareerProfileInput) => {
    try {
      const profileData = {
        ...data,
        employmentType,
        jobSearchActive,
        currentSalary: Number(data.currentSalary) || 0,
        targetRaise: data.targetRaise ? Number(data.targetRaise) : undefined,
      };

      if (householdId && user?.id) {
        await createMutation.mutateAsync(profileData);
      } else {
        addCareerProfileLocal({
          currentTitle: profileData.currentTitle,
          currentCompany: profileData.currentCompany,
          startDate: profileData.startDate,
          employmentType: profileData.employmentType,
          currentSalary: profileData.currentSalary,
          nextReviewDate: profileData.nextReviewDate,
          targetRaise: profileData.targetRaise,
          jobSearchActive: profileData.jobSearchActive,
        });
      }

      toast.success("Career profile created successfully");
      reset();
      onSuccess?.();
    } catch (error) {
      console.error("Failed to create career profile:", error);
      toast.error("Failed to create career profile");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-4">
        <div>
          <Label htmlFor="currentTitle" className="font-mono text-xs uppercase">
            Job Title *
          </Label>
          <Input
            id="currentTitle"
            {...register("currentTitle", { required: "Job title is required" })}
            placeholder="e.g., Senior Software Engineer"
            className="font-mono"
          />
          {errors.currentTitle && (
            <p className="text-sm text-destructive mt-1">
              {errors.currentTitle.message}
            </p>
          )}
        </div>

        <div>
          <Label
            htmlFor="currentCompany"
            className="font-mono text-xs uppercase"
          >
            Company *
          </Label>
          <Input
            id="currentCompany"
            {...register("currentCompany", { required: "Company is required" })}
            placeholder="e.g., Acme Corp"
            className="font-mono"
          />
          {errors.currentCompany && (
            <p className="text-sm text-destructive mt-1">
              {errors.currentCompany.message}
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="startDate" className="font-mono text-xs uppercase">
            Start Date *
          </Label>
          <Input
            id="startDate"
            type="date"
            {...register("startDate", { required: "Start date is required" })}
            className="font-mono"
          />
          {errors.startDate && (
            <p className="text-sm text-destructive mt-1">
              {errors.startDate.message}
            </p>
          )}
        </div>

        <div>
          <Label
            htmlFor="employmentType"
            className="font-mono text-xs uppercase"
          >
            Employment Type
          </Label>
          <Select
            value={employmentType}
            onValueChange={(value) =>
              setEmploymentType(value as EmploymentType)
            }
          >
            <SelectTrigger className="font-mono">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="self_employed">Self-employed</SelectItem>
              <SelectItem value="unemployed">Unemployed</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label
            htmlFor="currentSalary"
            className="font-mono text-xs uppercase"
          >
            Monthly Salary
          </Label>
          <Input
            id="currentSalary"
            type="number"
            step="0.01"
            {...register("currentSalary")}
            placeholder="0.00"
            className="font-mono"
          />
        </div>

        <div>
          <Label
            htmlFor="nextReviewDate"
            className="font-mono text-xs uppercase"
          >
            Next Review Date
          </Label>
          <Input
            id="nextReviewDate"
            type="date"
            {...register("nextReviewDate")}
            className="font-mono"
          />
        </div>

        <div>
          <Label htmlFor="targetRaise" className="font-mono text-xs uppercase">
            Target Raise (%)
          </Label>
          <Input
            id="targetRaise"
            type="number"
            step="0.1"
            {...register("targetRaise")}
            placeholder="0"
            className="font-mono"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Switch
            id="jobSearchActive"
            checked={jobSearchActive}
            onCheckedChange={setJobSearchActive}
          />
          <Label
            htmlFor="jobSearchActive"
            className="font-mono text-xs uppercase cursor-pointer"
          >
            Actively Job Searching
          </Label>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 font-mono"
        >
          {isSubmitting ? "CREATING..." : "CREATE CAREER PROFILE"}
        </Button>
      </div>
    </form>
  );
}
