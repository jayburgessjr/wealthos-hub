import { Goal, Bill } from "@/integrations/supabase/household-types";
import { ProgressBar } from "./ProgressBar";
import { Calendar, ImageIcon } from "lucide-react";

interface GoalCardProps {
  goal: Goal;
  linkedBill?: Bill;
  onClick?: () => void;
}

export function GoalCard({ goal, linkedBill, onClick }: GoalCardProps) {
  const percentage = (goal.currentAmount / goal.targetAmount) * 100;
  const remaining = goal.targetAmount - goal.currentAmount;
  const monthsToGoal =
    goal.monthlyContribution > 0
      ? Math.ceil(remaining / goal.monthlyContribution)
      : null;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl border border-border bg-card transition-all hover:border-foreground/20 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 overflow-hidden"
    >
      {/* Goal Image */}
      {goal.imagePath && (
        <div className="w-full h-32 bg-muted overflow-hidden">
          <img
            src={goal.imagePath}
            alt={goal.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      {!goal.imagePath && (
        <div className="w-full h-24 bg-secondary flex items-center justify-center">
          <ImageIcon className="w-8 h-8 text-muted-foreground" />
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-bold">{goal.name}</h3>
          <span className="text-xs font-mono bg-secondary px-2 py-1 border border-border">
            {percentage.toFixed(0)}%
          </span>
        </div>

        <ProgressBar
          value={goal.currentAmount}
          max={goal.targetAmount}
          size="md"
        />

        <div className="flex justify-between mt-3 text-sm">
          <div>
            <p className="font-mono font-bold">
              ${goal.currentAmount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">saved</p>
          </div>
          <div className="text-right">
            <p className="font-mono font-bold">
              ${goal.targetAmount.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">target</p>
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-border space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span className="font-mono">${goal.monthlyContribution}/mo</span>
            {monthsToGoal !== null && (
              <span className="font-mono">{monthsToGoal} months to go</span>
            )}
          </div>

          {/* Due Date */}
          {goal.deadline && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              <span className="font-mono">
                Due: {new Date(goal.deadline).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Linked Bill Due Date */}
          {linkedBill && (
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">Next payment:</span>
              <span className="font-mono text-foreground">
                {new Date(linkedBill.dueDate).toLocaleDateString()} ($
                {linkedBill.amount})
              </span>
            </div>
          )}
        </div>
      </div>
    </button>
  );
}
