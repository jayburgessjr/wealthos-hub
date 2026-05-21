import { useEffect, useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  getBudgetInsights,
  type BudgetData,
} from "@/services/householdAiService";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface AIInsightsPanelProps {
  budgetData: BudgetData;
  autoGenerate?: boolean;
}

export function AIInsightsPanel({
  budgetData,
  autoGenerate = true,
}: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);

  const generateInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await getBudgetInsights(budgetData);
      setInsights(result);
      setHasGenerated(true);
    } catch (err) {
      console.error("Failed to generate insights:", err);
      setError(
        err instanceof Error ? err.message : "Failed to generate insights",
      );
    } finally {
      setIsLoading(false);
    }
  }, [budgetData]);

  useEffect(() => {
    if (autoGenerate && !hasGenerated && !isLoading) {
      generateInsights();
    }
  }, [autoGenerate, hasGenerated, isLoading, generateInsights]);

  return (
    <Card className="border-2 h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            <CardTitle className="text-lg">AI Insights</CardTitle>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={generateInsights}
            disabled={isLoading}
            className="h-8 w-8 p-0"
            aria-label="Refresh insights"
          >
            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
          </Button>
        </div>
        <CardDescription>
          AI-powered financial analysis and recommendations
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        ) : error ? (
          <Alert variant="destructive" className="border-2">
            <AlertDescription className="text-sm">
              {error}
              <Button
                variant="outline"
                size="sm"
                onClick={generateInsights}
                className="mt-3 w-full"
              >
                Try Again
              </Button>
            </AlertDescription>
          </Alert>
        ) : insights ? (
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <div className="text-sm leading-relaxed whitespace-pre-wrap">
              {insights}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
            <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground mb-4">
              Get personalized AI insights about your finances
            </p>
            <Button onClick={generateInsights} size="sm">
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Insights
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
