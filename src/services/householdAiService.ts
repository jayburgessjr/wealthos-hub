import { supabase } from "@/integrations/supabase/client";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-budget`;

const MAX_INPUT_LENGTH = 2000;
const REQUEST_TIMEOUT_MS = 30000;

function sanitizeInput(input: string): string {
  return input.slice(0, MAX_INPUT_LENGTH).replace(/[<>]/g, "").trim();
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Please log in to use AI features");
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${session.access_token}`,
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface BudgetData {
  income: number;
  totalSpent: number;
  remaining: number;
  categories: { name: string; spent: number; monthlyLimit: number }[];
  goals: {
    name: string;
    currentAmount: number;
    targetAmount: number;
    targetDate?: string;
  }[];
  recentExpenses?: {
    description?: string;
    amount: number;
    categoryName: string;
    date?: string;
  }[];
  creditScores?: { score: number; bureau?: string; date: string }[];
  bankAccounts?: { name: string; type: string; current_balance: number }[];
  bills?: {
    name: string;
    amount: number;
    due_date: string;
    payment_status: string;
    total_balance?: number;
    credit_limit?: number;
    apr?: number;
    monthly_fees?: number;
    yearly_fees?: number;
    late_fees?: number;
    ideal_payment?: number;
    utilization_pct?: number;
    monthly_interest?: number;
    true_monthly_cost?: number;
  }[];
  incomeSources?: {
    name: string;
    type: string;
    expected_amount?: number;
    frequency?: string;
  }[];
}

export async function aiRequest(
  action: string,
  data: Record<string, any>,
): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ action, data }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      if (response.status === 401)
        throw new Error("Please log in to use AI features");
      if (response.status === 429)
        throw new Error(
          "Rate limit exceeded. Please wait a moment and try again.",
        );
      if (response.status === 402)
        throw new Error(
          "AI service requires additional credits. Please contact support.",
        );
      const error = await response
        .json()
        .catch(() => ({ error: "Request failed" }));
      throw new Error(error.error || `Request failed: ${response.status}`);
    }

    const result = await response.json();
    return result.content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }
    throw error;
  }
}

export async function streamChat({
  messages,
  budgetData,
  onDelta,
  onDone,
  onError,
}: {
  messages: ChatMessage[];
  budgetData: BudgetData;
  onDelta: (delta: string) => void;
  onDone: () => void;
  onError?: (error: Error) => void;
}) {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(CHAT_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "chat",
        data: { ...budgetData, messages, stream: true },
      }),
    });

    if (!response.ok || !response.body) {
      const error = await response
        .json()
        .catch(() => ({ error: "Stream failed" }));
      throw new Error(error.error || `Stream failed: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    onDone();
  } catch (error) {
    console.error("Stream error:", error);
    onError?.(error instanceof Error ? error : new Error("Unknown error"));
  }
}

export async function suggestCategory(
  description: string,
  categories: string[],
): Promise<string> {
  const sanitizedDescription = sanitizeInput(description);
  return aiRequest("categorize", {
    description: sanitizedDescription,
    categories,
  });
}

export async function getBudgetInsights(
  budgetData: BudgetData,
): Promise<string> {
  return aiRequest("insights", budgetData);
}

export async function getWeeklyReview(budgetData: BudgetData): Promise<string> {
  return aiRequest("weekly_review", budgetData);
}

export async function getInvestmentAdvice(
  budgetData: BudgetData,
): Promise<string> {
  return aiRequest("investment_advice", budgetData);
}

export async function getLoanAdvisor(budgetData: BudgetData): Promise<string> {
  return aiRequest("loan_advisor", budgetData);
}

export async function getMarketAlerts(budgetData: BudgetData): Promise<string> {
  return aiRequest("market_alert", budgetData);
}

export async function getVisionPlan(input: {
  vision: string;
  images: number;
}): Promise<string> {
  return aiRequest("vision_copilot", input as any);
}

export interface Scenario {
  id: string;
  name: string;
  type:
    | "income_change"
    | "expense_change"
    | "new_expense"
    | "goal_contribution"
    | "one_time";
  amount: number;
  categoryId?: string;
  categoryName?: string;
  isRecurring: boolean;
  color: string;
}

export interface SimulationResult {
  scenarioId: string;
  newMonthlyIncome: number;
  newMonthlyExpenses: number;
  newSurplus: number;
  surplusChange: number;
  monthsUntilStress: number | null;
  isStressed: boolean;
  goalImpacts: {
    goalName: string;
    currentMonths: number;
    newMonths: number;
    change: number;
  }[];
  riskLevel: "low" | "medium" | "high" | "critical";
  projections: { month: number; balance: number; savings: number }[];
}

export async function getScenarioSuggestions(
  budgetData: BudgetData,
): Promise<string> {
  return aiRequest("simulate_analysis", {
    ...budgetData,
    analysisType: "suggestions",
    scenarios: [],
  });
}

export async function compareScenarios(
  budgetData: BudgetData,
  scenarios: Scenario[],
): Promise<string> {
  return aiRequest("simulate_analysis", {
    ...budgetData,
    analysisType: "compare",
    scenarios,
  });
}

export async function getScenarioRisk(
  budgetData: BudgetData,
  scenario: Scenario,
): Promise<string> {
  return aiRequest("simulate_analysis", {
    ...budgetData,
    analysisType: "risk",
    scenarios: [scenario],
  });
}

export async function getScenarioProjection(
  budgetData: BudgetData,
  scenario: Scenario,
): Promise<string> {
  return aiRequest("simulate_analysis", {
    ...budgetData,
    analysisType: "projection",
    scenarios: [scenario],
  });
}

export async function getScenarioImpact(
  budgetData: BudgetData,
  scenario: Scenario,
): Promise<string> {
  return aiRequest("simulate_analysis", {
    ...budgetData,
    analysisType: "impact",
    scenarios: [scenario],
  });
}
