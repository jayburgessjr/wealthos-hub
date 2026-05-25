import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import TabNav from "@/components/layout/TabNav";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp,
  CreditCard,
  BarChart3,
  Bell,
  RefreshCw,
  Loader2,
  Calendar,
  DollarSign,
  Target,
  Sparkles,
} from "lucide-react";
import { useHouseholdFinancialData } from "@/hooks/useHouseholdFinancialData";
import {
  getWeeklyReview,
  getInvestmentAdvice,
  getLoanAdvisor,
  getMarketAlerts,
  getBudgetInsights,
} from "@/services/householdAiService";
import { toast } from "sonner";
import { ErrorBoundary } from "@/components/household/errors/ErrorBoundary";
import { useHouseholdBudget } from "@/context/HouseholdBudgetContext";

type AdvisorSection = "weekly" | "investment" | "loans" | "market" | "insights";

interface SectionState {
  content: string;
  loading: boolean;
  lastUpdated?: Date;
}

export default function HouseholdAIAssistant() {
  const { budgetData, hasData, creditScores, bankAccounts } =
    useHouseholdFinancialData();
  const { budget, totalSpent, remaining, getCategoryById } =
    useHouseholdBudget();
  const [sections, setSections] = useState<
    Record<AdvisorSection, SectionState>
  >({
    weekly: { content: "", loading: false },
    investment: { content: "", loading: false },
    loans: { content: "", loading: false },
    market: { content: "", loading: false },
    insights: { content: "", loading: false },
  });
  const [advisorTab, setAdvisorTab] = useState<string>("insights");

  const updateSection = (
    section: AdvisorSection,
    updates: Partial<SectionState>,
  ) => {
    setSections((prev) => ({
      ...prev,
      [section]: { ...prev[section], ...updates },
    }));
  };

  const fetchAdvice = async (section: AdvisorSection) => {
    if (!hasData && section !== "insights") {
      toast.error("Please add some financial data first");
      return;
    }

    if (section === "insights" && budget.categories.length === 0) {
      toast.error("Add some expenses first to get AI insights");
      return;
    }

    updateSection(section, { loading: true });

    try {
      let content = "";
      switch (section) {
        case "weekly":
          content = await getWeeklyReview(budgetData);
          break;
        case "investment":
          content = await getInvestmentAdvice(budgetData);
          break;
        case "loans":
          content = await getLoanAdvisor(budgetData);
          break;
        case "market":
          content = await getMarketAlerts(budgetData);
          break;
        case "insights":
          const insightData = {
            income: budget.income,
            totalSpent,
            remaining,
            categories: budget.categories.map((c) => ({
              name: c.name,
              spent: c.spent,
              monthlyLimit: c.monthlyLimit,
            })),
            goals: budget.goals.map((g) => ({
              name: g.name,
              currentAmount: g.currentAmount,
              targetAmount: g.targetAmount,
            })),
            recentExpenses: budget.expenses.slice(0, 10).map((e) => ({
              description: e.description,
              amount: e.amount,
              categoryName: getCategoryById(e.categoryId)?.name || "Unknown",
            })),
          };
          content = await getBudgetInsights(insightData);
          break;
      }
      updateSection(section, {
        content,
        loading: false,
        lastUpdated: new Date(),
      });
    } catch (error) {
      toast.error(`Failed to get ${section} advice`);
      updateSection(section, { loading: false });
    }
  };

  // Calculate summary stats
  const avgCreditScore =
    creditScores.length > 0
      ? Math.round(
          creditScores.reduce((sum, cs) => sum + cs.score, 0) /
            creditScores.length,
        )
      : null;

  const totalAssets = bankAccounts.reduce(
    (sum, acc) => sum + acc.current_balance,
    0,
  );
  const savingsRate =
    budgetData.income > 0
      ? Math.round(
          ((budgetData.income - budgetData.totalSpent) / budgetData.income) *
            100,
        )
      : 0;

  const renderContent = (
    section: AdvisorSection,
    title: string,
    description: string,
    icon: React.ReactNode,
  ) => {
    const state = sections[section];

    return (
      <Card className="h-full border-2">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {icon}
              <div>
                <CardTitle className="text-lg">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchAdvice(section)}
              disabled={state.loading || !hasData}
            >
              {state.loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              <span className="ml-2">
                {state.content ? "Refresh" : "Generate"}
              </span>
            </Button>
          </div>
          {state.lastUpdated && (
            <p className="text-xs text-muted-foreground mt-1">
              Last updated: {state.lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {!hasData ? (
            <div className="border-2 border-destructive p-4 bg-card">
              <p className="font-bold mb-1">
                Add data to get personalized advice
              </p>
              <p className="text-sm text-muted-foreground">
                Connect accounts, add bills, and record income/expenses to
                enable the advisor.
              </p>
            </div>
          ) : state.content ? (
            <ScrollArea className="h-[400px] pr-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap text-sm">
                  {state.content}
                </div>
              </div>
            </ScrollArea>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Click "Generate" to get personalized {title.toLowerCase()}</p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <DashboardLayout>
      <TabNav group="household-insights" />
      <div className="space-y-6" role="region" aria-labelledby="advisor-title">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs uppercase tracking-widest text-muted-foreground">
              AI
            </span>
          </div>
          <h1
            id="advisor-title"
            className="font-display text-[28px] font-extrabold leading-none tracking-tight"
          >
            Financial <span className="text-emerald-500">Assistant</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            AI-powered insights and recommendations based on your complete
            financial picture.
          </p>
        </div>

        {/* Summary Stats */}
        <ErrorBoundary>
          <div className="grid gap-3 md:gap-4 md:grid-cols-4">
            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 border-2 border-border bg-secondary">
                    <DollarSign className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Monthly Income
                    </p>
                    <p className="text-xl md:text-2xl font-bold font-mono">
                      ${budgetData.income.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 border-2 border-border bg-secondary">
                    <Target className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Savings Rate
                    </p>
                    <p className="text-xl md:text-2xl font-bold font-mono">
                      {savingsRate}%
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 border-2 border-border bg-secondary">
                    <CreditCard className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Credit Score
                    </p>
                    <p className="text-xl md:text-2xl font-bold font-mono">
                      {avgCreditScore || "N/A"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 border-2 border-border bg-secondary">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs md:text-sm text-muted-foreground">
                      Total Assets
                    </p>
                    <p className="text-xl md:text-2xl font-bold font-mono">
                      ${totalAssets.toLocaleString()}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </ErrorBoundary>

        {/* Advisor Tabs */}
        <ErrorBoundary>
          <Tabs
            value={advisorTab}
            onValueChange={setAdvisorTab}
            className="space-y-4"
          >
            <div className="border border-border bg-card rounded-xl p-1 flex gap-1 w-fit overflow-x-auto">
              {[
                { id: "insights", label: "AI Insights", icon: Sparkles },
                { id: "weekly", label: "Weekly Review", icon: Calendar },
                { id: "investment", label: "Investments", icon: TrendingUp },
                { id: "loans", label: "Loans & Credit", icon: CreditCard },
                { id: "market", label: "Market Alerts", icon: Bell },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setAdvisorTab(tab.id)}
                    className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors whitespace-nowrap flex items-center gap-2 ${
                      advisorTab === tab.id
                        ? "bg-foreground/[0.08] text-foreground"
                        : "text-foreground/40 hover:text-foreground/70"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            <TabsContent value="insights">
              {renderContent(
                "insights",
                "AI Budget Insights",
                "Personalized budget analysis and recommendations",
                <Sparkles className="h-5 w-5 text-purple-500" />,
              )}
            </TabsContent>

            <TabsContent value="weekly">
              {renderContent(
                "weekly",
                "Weekly Financial Review",
                "Comprehensive analysis of your financial health and actionable recommendations",
                <Calendar className="h-5 w-5 text-primary" />,
              )}
            </TabsContent>

            <TabsContent value="investment">
              {renderContent(
                "investment",
                "Investment Opportunities",
                "Personalized investment guidance based on your goals and risk profile",
                <TrendingUp className="h-5 w-5 text-green-500" />,
              )}
            </TabsContent>

            <TabsContent value="loans">
              {renderContent(
                "loans",
                "Loan & Credit Advisor",
                "What your credit score qualifies you for and optimal borrowing strategies",
                <CreditCard className="h-5 w-5 text-blue-500" />,
              )}
            </TabsContent>

            <TabsContent value="market">
              {renderContent(
                "market",
                "Market Alerts",
                "Timely insights about market conditions and opportunities relevant to you",
                <Bell className="h-5 w-5 text-orange-500" />,
              )}
            </TabsContent>
          </Tabs>
        </ErrorBoundary>
      </div>
    </DashboardLayout>
  );
}
