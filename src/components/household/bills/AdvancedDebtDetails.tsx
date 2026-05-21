import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export interface AdvancedDebtValues {
  creditLimit?: string;
  apr?: string;
  monthlyFees?: string;
  yearlyFees?: string;
  lateFees?: string;
  idealPayment?: string;
}

interface AdvancedDebtDetailsProps {
  values: AdvancedDebtValues;
  onChange: (values: AdvancedDebtValues) => void;
  defaultOpen?: boolean;
}

export function AdvancedDebtDetails({
  values,
  onChange,
  defaultOpen = false,
}: AdvancedDebtDetailsProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleChange = (field: keyof AdvancedDebtValues, value: string) => {
    onChange({ ...values, [field]: value });
  };

  const hasAnyValue = Object.values(values).some((v) => v && v !== "");

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-between py-3 px-0 h-auto font-normal hover:bg-transparent"
        >
          <span className="text-sm font-medium flex items-center gap-2">
            Advanced Debt Details (Optional)
            {hasAnyValue && (
              <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Has data
              </span>
            )}
          </span>
          {isOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-2">
        <p className="text-xs text-muted-foreground mb-4">
          Add financial details to get smarter AI payoff advice. All fields are
          optional.
        </p>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="font-mono text-xs uppercase">
                Credit Limit
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      For credit cards or lines of credit. Used to calculate
                      utilization %.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={values.creditLimit || ""}
                onChange={(e) => handleChange("creditLimit", e.target.value)}
                className="pl-7 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="font-mono text-xs uppercase">APR %</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      Annual Percentage Rate. Used to estimate monthly interest
                      cost.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={values.apr || ""}
                onChange={(e) => handleChange("apr", e.target.value)}
                className="pr-7 font-mono"
                placeholder="0.00"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                %
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="font-mono text-xs uppercase">
                Monthly Fees
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      Recurring monthly service or maintenance fees.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={values.monthlyFees || ""}
                onChange={(e) => handleChange("monthlyFees", e.target.value)}
                className="pl-7 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="font-mono text-xs uppercase">Yearly Fees</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      Annual fees (will be amortized monthly in calculations).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={values.yearlyFees || ""}
                onChange={(e) => handleChange("yearlyFees", e.target.value)}
                className="pl-7 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="font-mono text-xs uppercase">Late Fee</Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      Typical penalty if a payment is missed.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={values.lateFees || ""}
                onChange={(e) => handleChange("lateFees", e.target.value)}
                className="pl-7 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-1">
              <Label className="font-mono text-xs uppercase">
                Ideal Payment
              </Label>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[200px]">
                      Your preferred payment amount per month (not necessarily
                      the minimum).
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-muted-foreground">
                $
              </span>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={values.idealPayment || ""}
                onChange={(e) => handleChange("idealPayment", e.target.value)}
                className="pl-7 font-mono"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Utility to calculate derived values
export function calculateDebtMetrics(bill: {
  totalBalance?: number;
  creditLimit?: number;
  apr?: number;
  monthlyFees?: number;
  yearlyFees?: number;
}) {
  const {
    totalBalance = 0,
    creditLimit,
    apr,
    monthlyFees = 0,
    yearlyFees = 0,
  } = bill;

  // Utilization % (only if both values exist)
  const utilization =
    creditLimit && creditLimit > 0 ? (totalBalance / creditLimit) * 100 : null;

  // Estimated monthly interest (only if APR and balance exist)
  const monthlyInterest =
    apr && totalBalance > 0 ? (apr / 100 / 12) * totalBalance : null;

  // True monthly cost
  const trueMonthlyCost =
    (monthlyInterest ?? 0) + monthlyFees + yearlyFees / 12;

  return {
    utilization,
    monthlyInterest,
    trueMonthlyCost: trueMonthlyCost > 0 ? trueMonthlyCost : null,
  };
}
