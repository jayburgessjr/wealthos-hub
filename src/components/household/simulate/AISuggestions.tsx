import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Loader2,
  Lightbulb,
  Plus,
  BarChart3,
  Shield,
  TrendingUp,
} from "lucide-react";
import {
  BudgetData,
  Scenario,
  getScenarioSuggestions,
  getScenarioImpact,
  getScenarioRisk,
  compareScenarios,
} from "@/services/householdAiService";
import { toast } from "sonner";

interface AISuggestionsProps {
  budgetData: BudgetData;
  scenarios: Scenario[];
  onAddScenario?: (suggestion: {
    name: string;
    type: Scenario["type"];
    amount: number;
  }) => void;
}

type AnalysisType = "suggestions" | "impact" | "risk" | "compare";

export function AISuggestions({
  budgetData,
  scenarios,
  onAddScenario,
}: AISuggestionsProps) {
  const [loading, setLoading] = useState<AnalysisType | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<AnalysisType | null>(null);

  const handleAnalysis = async (type: AnalysisType) => {
    setLoading(type);
    setActiveType(type);
    setResult(null);

    try {
      let response: string;

      switch (type) {
        case "suggestions":
          response = await getScenarioSuggestions(budgetData);
          break;
        case "impact":
          if (scenarios.length === 0) {
            toast.error("Add at least one scenario first");
            setLoading(null);
            return;
          }
          response = await getScenarioImpact(budgetData, scenarios[0]);
          break;
        case "risk":
          if (scenarios.length === 0) {
            toast.error("Add at least one scenario first");
            setLoading(null);
            return;
          }
          response = await getScenarioRisk(budgetData, scenarios[0]);
          break;
        case "compare":
          if (scenarios.length < 2) {
            toast.error("Add at least two scenarios to compare");
            setLoading(null);
            return;
          }
          response = await compareScenarios(budgetData, scenarios);
          break;
        default:
          response = "";
      }

      setResult(response);
    } catch (error) {
      console.error("AI analysis error:", error);
      toast.error("Failed to get AI analysis");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="border-2 border-border p-4 bg-card">
      <h3 className="font-bold mb-4 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        AI Analysis
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-4">
        <Button
          variant={activeType === "suggestions" ? "default" : "outline"}
          size="sm"
          className="font-mono text-xs h-9"
          onClick={() => handleAnalysis("suggestions")}
          disabled={loading !== null}
        >
          {loading === "suggestions" ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Lightbulb className="w-3 h-3 mr-1" />
          )}
          Suggest Scenarios
        </Button>

        <Button
          variant={activeType === "impact" ? "default" : "outline"}
          size="sm"
          className="font-mono text-xs h-9"
          onClick={() => handleAnalysis("impact")}
          disabled={loading !== null || scenarios.length === 0}
        >
          {loading === "impact" ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <TrendingUp className="w-3 h-3 mr-1" />
          )}
          Impact Analysis
        </Button>

        <Button
          variant={activeType === "risk" ? "default" : "outline"}
          size="sm"
          className="font-mono text-xs h-9"
          onClick={() => handleAnalysis("risk")}
          disabled={loading !== null || scenarios.length === 0}
        >
          {loading === "risk" ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <Shield className="w-3 h-3 mr-1" />
          )}
          Risk Assessment
        </Button>

        <Button
          variant={activeType === "compare" ? "default" : "outline"}
          size="sm"
          className="font-mono text-xs h-9"
          onClick={() => handleAnalysis("compare")}
          disabled={loading !== null || scenarios.length < 2}
        >
          {loading === "compare" ? (
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
          ) : (
            <BarChart3 className="w-3 h-3 mr-1" />
          )}
          Compare All
        </Button>
      </div>

      {result && (
        <div className="border border-border bg-secondary p-4 max-h-80 overflow-y-auto">
          <div className="prose prose-sm prose-invert max-w-none">
            <div className="whitespace-pre-wrap text-sm font-mono leading-relaxed">
              {result}
            </div>
          </div>
        </div>
      )}

      {!result && !loading && (
        <div className="text-center py-6 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-mono">
            Get AI-powered insights about your scenarios
          </p>
        </div>
      )}
    </div>
  );
}
