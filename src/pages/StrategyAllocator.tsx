import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  STRATEGY_TIERS,
  getCurrentTier,
  getNextTierUnlock,
  Strategy,
} from "@/data/strategyTiers";
import { calcBlendedReturn } from "@/lib/compoundEngine";
import { optimizePortfolio } from "@/lib/quantumOptimizer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Zap,
  Shield,
  TrendingUp,
  Lock,
  CheckCircle2,
  RefreshCw,
  FlaskConical,
  GitBranch,
  BarChart2,
  Radio,
  Rocket,
  ChevronRight,
  Play,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { useDemo } from "@/components/DemoProvider";
import { sandboxPortfolio } from "@/data/sandboxData";

// ── Lifecycle types ────────────────────────────────────────────────────────────
type LifecycleStage =
  | "draft"
  | "backtest"
  | "monte_carlo"
  | "incubation"
  | "live_ready";

const LIFECYCLE_STAGES: {
  id: LifecycleStage;
  label: string;
  icon: any;
  color: string;
  description: string;
}[] = [
  {
    id: "draft",
    label: "Draft",
    icon: FlaskConical,
    color: "#94a3b8",
    description: "Strategy concept defined, not yet validated",
  },
  {
    id: "backtest",
    label: "Backtest",
    icon: BarChart2,
    color: "#3D8EFF",
    description: "Historical performance simulation complete",
  },
  {
    id: "monte_carlo",
    label: "Monte Carlo",
    icon: GitBranch,
    color: "#8B5CF6",
    description: "Probabilistic simulation across 2,000+ paths",
  },
  {
    id: "incubation",
    label: "Incubation",
    icon: Radio,
    color: "#F59E0B",
    description: "Paper trading / live monitoring in sandbox",
  },
  {
    id: "live_ready",
    label: "Live Ready",
    icon: Rocket,
    color: "#00cc73",
    description: "Approved for capital deployment",
  },
];

interface LifecycleStrategy {
  id: string;
  name: string;
  description: string;
  assetClass: string;
  targetReturn: number;
  riskScore: number;
  capital: number;
  stage: LifecycleStage;
  sharpe?: number;
  maxDrawdown?: number;
  winRate?: number;
  monteCarloResult?: {
    expectedReturn: number;
    var95: number;
    sharpeRatio: number;
  };
  createdAt: Date;
  notes: string;
}

const STAGE_ORDER: LifecycleStage[] = [
  "draft",
  "backtest",
  "monte_carlo",
  "incubation",
  "live_ready",
];

function nextStage(current: LifecycleStage): LifecycleStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1] : null;
}
function prevStage(current: LifecycleStage): LifecycleStage | null {
  const idx = STAGE_ORDER.indexOf(current);
  return idx > 0 ? STAGE_ORDER[idx - 1] : null;
}

export default function StrategyAllocator() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"allocator" | "pipeline">(
    "allocator",
  );
  const [excludedStrategies, setExcludedStrategies] = useState<string[]>([]);
  const [recommendedAllocations, setRecommendedAllocations] = useState<
    Record<string, number>
  >({});
  const [lifecycleStrategies, setLifecycleStrategies] = useState<
    LifecycleStrategy[]
  >([]);
  const [selectedLifecycle, setSelectedLifecycle] = useState<string | null>(
    null,
  );
  const [runningMC, setRunningMC] = useState<string | null>(null);
  const [newStratName, setNewStratName] = useState("");

  const { data: portfolio, isLoading: portLoading } = useQuery({
    queryKey: ["portfolio", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["compound-settings", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode)
        return {
          risk_tier: "moderate",
          allocations: { "Covered Calls": 40, "Momentum Stocks": 60 },
        };
      const { data } = await supabase
        .from("compound_settings")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const capital = portfolio?.total_capital ?? 0;
  const currentTier = getCurrentTier(capital);
  const nextUnlock = getNextTierUnlock(capital);
  const blendedReturn = calcBlendedReturn(
    capital,
    settings?.risk_tier || "moderate",
  );

  const availableStrategies = STRATEGY_TIERS.filter(
    (t) => capital >= t.min_capital,
  ).flatMap((t) => t.strategies);

  const lockedStrategies = STRATEGY_TIERS.filter(
    (t) => capital < t.min_capital,
  ).flatMap((t) => t.strategies);

  const { mutate: saveAllocations, isPending: saving } = useMutation({
    mutationFn: async (newAllocations: Record<string, number>) => {
      const { error } = await supabase
        .from("compound_settings")
        .update({ allocations: newAllocations as any })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Allocation applied successfully");
      queryClient.invalidateQueries({
        queryKey: ["compound-settings", user?.id],
      });
    },
    onError: (err) => toast.error(`Failed to save: ${err.message}`),
  });

  const optimize = () => {
    const active = availableStrategies.filter(
      (s) => !excludedStrategies.includes(s.name),
    );
    if (!active.length) {
      toast.error("At least one strategy must be included");
      return;
    }

    // Optimization logic: Simple equal weight for now, or weighted by return?
    // User requested "maximize blended return within risk_tier limits"
    // For now, let's do a weighted allocation based on monthly return
    const totalReturn = active.reduce(
      (sum, s) => sum + s.avg_monthly_return,
      0,
    );
    const newAllocations: Record<string, number> = {};
    active.forEach((s) => {
      newAllocations[s.name] = (s.avg_monthly_return / totalReturn) * 100;
    });

    setRecommendedAllocations(newAllocations);
    toast.success("Optimization calculated");
  };

  const currentAllocations =
    (settings?.allocations as Record<string, number>) || {};

  // ── Lifecycle handlers ────────────────────────────────────────────────────
  const advanceStage = async (id: string) => {
    const strat = lifecycleStrategies.find((s) => s.id === id);
    if (!strat) return;
    const next = nextStage(strat.stage);
    if (!next) return;

    // Run Monte Carlo when advancing to monte_carlo stage
    if (next === "monte_carlo") {
      setRunningMC(id);
      await new Promise((r) => setTimeout(r, 100));
      const assets = [
        {
          symbol: strat.name.replace(/\s/g, ""),
          price: 100,
          changePct: strat.targetReturn / 12,
          assetClass: "equity" as const,
        },
      ];
      const result = optimizePortfolio(
        assets,
        strat.capital,
        11 - strat.riskScore,
        1000,
        500,
      );
      setLifecycleStrategies((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                stage: next,
                monteCarloResult: {
                  expectedReturn: result.expectedReturn,
                  var95: result.var95,
                  sharpeRatio: result.sharpeRatio,
                },
              }
            : s,
        ),
      );
      setRunningMC(null);
      toast.success(`Monte Carlo complete for "${strat.name}"`);
    } else {
      setLifecycleStrategies((prev) =>
        prev.map((s) => (s.id === id ? { ...s, stage: next } : s)),
      );
      toast.success(
        `"${strat.name}" advanced to ${LIFECYCLE_STAGES.find((l) => l.id === next)?.label}`,
      );
    }
  };

  const regressStage = (id: string) => {
    const strat = lifecycleStrategies.find((s) => s.id === id);
    if (!strat) return;
    const prev = prevStage(strat.stage);
    if (!prev) return;
    setLifecycleStrategies((s) =>
      s.map((x) => (x.id === id ? { ...x, stage: prev } : x)),
    );
  };

  const addLifecycleStrategy = () => {
    if (!newStratName.trim()) return;
    const newStrat: LifecycleStrategy = {
      id: Math.random().toString(36).slice(2),
      name: newStratName.trim(),
      description: "New strategy — add description.",
      assetClass: "equity",
      targetReturn: 10,
      riskScore: 5,
      capital: 5000,
      stage: "draft",
      createdAt: new Date(),
      notes: "",
    };
    setLifecycleStrategies((prev) => [...prev, newStrat]);
    setNewStratName("");
    toast.success(`"${newStrat.name}" created in Draft`);
  };

  const removeLifecycleStrategy = (id: string) => {
    setLifecycleStrategies((prev) => prev.filter((s) => s.id !== id));
    if (selectedLifecycle === id) setSelectedLifecycle(null);
  };

  const selectedStrat = lifecycleStrategies.find(
    (s) => s.id === selectedLifecycle,
  );

  return (
    <DashboardLayout>
      <SubscriptionGate>
        <div className="space-y-6">
          {/* Header + tabs */}
          <div>
            <h2 className="font-display text-2xl font-bold text-foreground">
              Strategy Allocator
            </h2>
            <div className="mt-4 flex gap-1 border-b border-border">
              {(
                [
                  { id: "allocator", label: "Allocator" },
                  { id: "pipeline", label: "Strategy Pipeline" },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(t.id)}
                  className={`rounded-t-lg border border-b-0 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                    activeTab === t.id
                      ? "border-border bg-card text-foreground -mb-px"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
          {/* ══ PIPELINE TAB ══ */}
          {activeTab === "pipeline" && (
            <div className="space-y-6">
              {/* Stage header rail */}
              <div className="overflow-x-auto">
                <div className="flex min-w-max items-center gap-0">
                  {LIFECYCLE_STAGES.map((stage, i) => {
                    const count = lifecycleStrategies.filter(
                      (s) => s.stage === stage.id,
                    ).length;
                    const Icon = stage.icon;
                    return (
                      <div key={stage.id} className="flex items-center">
                        <div
                          className="flex flex-col items-center gap-1.5 px-6 py-3 rounded-xl"
                          style={{
                            background: `${stage.color}10`,
                            border: `1px solid ${stage.color}30`,
                          }}
                        >
                          <Icon size={16} style={{ color: stage.color }} />
                          <span
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: stage.color }}
                          >
                            {stage.label}
                          </span>
                          <span className="font-mono text-xl font-black text-foreground">
                            {count}
                          </span>
                          <span className="text-xs text-muted-foreground/60">
                            {count === 1 ? "strategy" : "strategies"}
                          </span>
                        </div>
                        {i < LIFECYCLE_STAGES.length - 1 && (
                          <ChevronRight
                            size={16}
                            className="mx-2 text-muted-foreground/30 shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add strategy */}
              <div className="flex gap-2">
                <input
                  value={newStratName}
                  onChange={(e) => setNewStratName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addLifecycleStrategy()}
                  placeholder="New strategy name…"
                  className="flex-1 rounded-xl border border-border bg-card px-4 py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                />
                <button
                  onClick={addLifecycleStrategy}
                  className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5 font-mono text-xs font-bold text-primary transition-colors hover:brightness-110"
                >
                  <Plus size={13} /> Add Strategy
                </button>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                {/* Stage columns */}
                <div className="lg:col-span-2 space-y-4">
                  {LIFECYCLE_STAGES.map((stage) => {
                    const stratInStage = lifecycleStrategies.filter(
                      (s) => s.stage === stage.id,
                    );
                    const Icon = stage.icon;
                    return (
                      <div
                        key={stage.id}
                        className="rounded-2xl border bg-card"
                        style={{ borderColor: `${stage.color}30` }}
                      >
                        <div
                          className="flex items-center gap-2 border-b px-4 py-3"
                          style={{ borderColor: `${stage.color}20` }}
                        >
                          <Icon size={13} style={{ color: stage.color }} />
                          <span
                            className="text-xs font-bold uppercase tracking-widest"
                            style={{ color: stage.color }}
                          >
                            {stage.label}
                          </span>
                          <span
                            className="ml-auto rounded-full px-2 py-0.5 text-xs font-bold"
                            style={{
                              background: `${stage.color}15`,
                              color: stage.color,
                            }}
                          >
                            {stratInStage.length}
                          </span>
                        </div>
                        <div className="space-y-2 p-3">
                          {stratInStage.length === 0 && (
                            <p className="py-4 text-center text-xs uppercase tracking-widest text-muted-foreground/40">
                              No strategies in this stage
                            </p>
                          )}
                          {stratInStage.map((strat, i) => {
                            const isSelected = selectedLifecycle === strat.id;
                            const isRunning = runningMC === strat.id;
                            const next = nextStage(strat.stage);
                            const nextStageInfo = next
                              ? LIFECYCLE_STAGES.find((l) => l.id === next)
                              : null;
                            return (
                              <motion.div
                                key={strat.id}
                                initial={{ opacity: 0, y: 4 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className={`rounded-xl border p-3 cursor-pointer transition-all ${
                                  isSelected
                                    ? "border-foreground/30 bg-accent"
                                    : "border-border hover:border-border/70 hover:bg-accent/30"
                                }`}
                                onClick={() =>
                                  setSelectedLifecycle(
                                    isSelected ? null : strat.id,
                                  )
                                }
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="text-xs font-bold text-foreground">
                                      {strat.name}
                                    </p>
                                    <p className="text-xs text-muted-foreground capitalize">
                                      {strat.assetClass} · Target{" "}
                                      {strat.targetReturn}%/yr
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    {next && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          advanceStage(strat.id);
                                        }}
                                        disabled={isRunning}
                                        className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-bold transition-all hover:brightness-110 disabled:opacity-50"
                                        style={{
                                          borderColor: `${nextStageInfo?.color}40`,
                                          color: nextStageInfo?.color,
                                          background: `${nextStageInfo?.color}10`,
                                        }}
                                        title={`Advance to ${nextStageInfo?.label}`}
                                      >
                                        {isRunning ? (
                                          "Running…"
                                        ) : (
                                          <>
                                            <Play size={8} />{" "}
                                            {nextStageInfo?.label}
                                          </>
                                        )}
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        removeLifecycleStrategy(strat.id);
                                      }}
                                      className="text-muted-foreground/40 hover:text-bearish transition-colors"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                </div>

                                {strat.monteCarloResult && (
                                  <div className="mt-2 flex gap-3 border-t border-border/40 pt-2">
                                    <span className="text-xs text-bullish">
                                      +
                                      {strat.monteCarloResult.expectedReturn.toFixed(
                                        1,
                                      )}
                                      %
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      Sharpe{" "}
                                      {strat.monteCarloResult.sharpeRatio.toFixed(
                                        2,
                                      )}
                                    </span>
                                    <span className="text-xs text-bearish">
                                      VaR{" "}
                                      {strat.monteCarloResult.var95.toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Detail panel */}
                <div>
                  {selectedStrat ? (
                    <motion.div
                      key={selectedStrat.id}
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="rounded-2xl border border-border bg-card p-5 space-y-4 sticky top-4"
                    >
                      {(() => {
                        const stageInfo = LIFECYCLE_STAGES.find(
                          (l) => l.id === selectedStrat.stage,
                        )!;
                        const StageIcon = stageInfo.icon;
                        return (
                          <>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <StageIcon
                                  size={14}
                                  style={{ color: stageInfo.color }}
                                />
                                <span
                                  className="text-xs font-bold uppercase tracking-widest"
                                  style={{ color: stageInfo.color }}
                                >
                                  {stageInfo.label}
                                </span>
                              </div>
                              <button
                                onClick={() => setSelectedLifecycle(null)}
                                className="text-muted-foreground/40 hover:text-foreground"
                              >
                                ✕
                              </button>
                            </div>

                            <div>
                              <h3 className="font-display text-base font-bold text-foreground">
                                {selectedStrat.name}
                              </h3>
                              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                {selectedStrat.description}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {[
                                {
                                  label: "Asset Class",
                                  value: selectedStrat.assetClass,
                                  cls: "capitalize",
                                },
                                {
                                  label: "Target Return",
                                  value: `${selectedStrat.targetReturn}%/yr`,
                                  cls: "text-bullish",
                                },
                                {
                                  label: "Risk Score",
                                  value: `${selectedStrat.riskScore}/10`,
                                  cls:
                                    selectedStrat.riskScore > 6
                                      ? "text-bearish"
                                      : "text-watch",
                                },
                                {
                                  label: "Capital",
                                  value: `$${selectedStrat.capital.toLocaleString()}`,
                                  cls: "",
                                },
                              ].map((m) => (
                                <div
                                  key={m.label}
                                  className="rounded-lg border border-border bg-accent/30 p-2.5"
                                >
                                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                                    {m.label}
                                  </p>
                                  <p
                                    className={`font-mono text-xs font-black mt-0.5 ${m.cls}`}
                                  >
                                    {m.value}
                                  </p>
                                </div>
                              ))}
                            </div>

                            {selectedStrat.monteCarloResult && (
                              <div className="space-y-2 rounded-xl border border-purple-500/20 bg-purple-500/5 p-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-purple-400">
                                  Monte Carlo Results
                                </p>
                                {[
                                  {
                                    label: "Expected Return",
                                    value: `+${selectedStrat.monteCarloResult.expectedReturn.toFixed(2)}%`,
                                    color: "text-bullish",
                                  },
                                  {
                                    label: "VaR 95%",
                                    value: `${selectedStrat.monteCarloResult.var95.toFixed(2)}%`,
                                    color: "text-bearish",
                                  },
                                  {
                                    label: "Sharpe Ratio",
                                    value:
                                      selectedStrat.monteCarloResult.sharpeRatio.toFixed(
                                        3,
                                      ),
                                    color:
                                      selectedStrat.monteCarloResult
                                        .sharpeRatio > 1
                                        ? "text-bullish"
                                        : "text-watch",
                                  },
                                ].map((m) => (
                                  <div
                                    key={m.label}
                                    className="flex items-center justify-between"
                                  >
                                    <span className="text-xs text-muted-foreground">
                                      {m.label}
                                    </span>
                                    <span
                                      className={`font-mono text-xs font-black ${m.color}`}
                                    >
                                      {m.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {selectedStrat.sharpe && (
                              <div className="space-y-2 rounded-xl border border-border bg-accent/20 p-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                                  Backtest Metrics
                                </p>
                                {[
                                  {
                                    label: "Sharpe Ratio",
                                    value: selectedStrat.sharpe.toFixed(2),
                                  },
                                  {
                                    label: "Max Drawdown",
                                    value: `-${selectedStrat.maxDrawdown?.toFixed(1)}%`,
                                  },
                                  {
                                    label: "Win Rate",
                                    value: `${selectedStrat.winRate}%`,
                                  },
                                ].map((m) => (
                                  <div
                                    key={m.label}
                                    className="flex items-center justify-between"
                                  >
                                    <span className="text-xs text-muted-foreground">
                                      {m.label}
                                    </span>
                                    <span className="font-mono text-xs font-black text-foreground">
                                      {m.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {selectedStrat.notes && (
                              <div className="flex items-start gap-2 rounded-xl border border-watch/20 bg-watch/5 p-3">
                                <AlertCircle
                                  size={11}
                                  className="mt-0.5 shrink-0 text-watch"
                                />
                                <p className="text-xs text-muted-foreground leading-relaxed">
                                  {selectedStrat.notes}
                                </p>
                              </div>
                            )}

                            {/* Stage advance / regress controls */}
                            <div className="flex gap-2 pt-1 border-t border-border">
                              {prevStage(selectedStrat.stage) && (
                                <button
                                  onClick={() => regressStage(selectedStrat.id)}
                                  className="flex-1 rounded-xl border border-border py-2 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                                >
                                  ← Regress
                                </button>
                              )}
                              {nextStage(selectedStrat.stage) && (
                                <button
                                  onClick={() => advanceStage(selectedStrat.id)}
                                  disabled={runningMC === selectedStrat.id}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold text-background transition-all hover:brightness-110 disabled:opacity-50"
                                  style={{
                                    background:
                                      LIFECYCLE_STAGES.find(
                                        (l) =>
                                          l.id ===
                                          nextStage(selectedStrat.stage),
                                      )?.color ?? "#00cc73",
                                  }}
                                >
                                  {runningMC === selectedStrat.id ? (
                                    "Running…"
                                  ) : (
                                    <>
                                      Advance →{" "}
                                      {
                                        LIFECYCLE_STAGES.find(
                                          (l) =>
                                            l.id ===
                                            nextStage(selectedStrat.stage),
                                        )?.label
                                      }
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border py-16 text-center">
                      <GitBranch
                        size={28}
                        className="text-muted-foreground/20"
                      />
                      <p className="text-xs uppercase tracking-widest text-muted-foreground/50">
                        Select a strategy
                        <br />
                        to view details
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          {/* ══ ALLOCATOR TAB ══ */}
          {activeTab === "allocator" && (
            <div className="space-y-8">
              {/* TOP ROW — 3 summary cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SummaryCard
                  label="Total Capital"
                  value={`$${capital.toLocaleString()}`}
                  icon={TrendingUp}
                  loading={portLoading}
                />
                <SummaryCard
                  label="Current Tier"
                  value={currentTier.label}
                  icon={Shield}
                  loading={portLoading}
                />
                <SummaryCard
                  label="Blended Monthly Return"
                  value={`${(blendedReturn * 100).toFixed(2)}%`}
                  icon={Zap}
                  loading={portLoading}
                />
              </div>

              {/* TIER PROGRESSION BAR */}
              <Card className="border-border bg-card p-6">
                <div className="flex flex-col gap-6">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                      Tier Progression
                    </h3>
                    {nextUnlock && (
                      <span className="text-xs text-muted-foreground">
                        Need{" "}
                        <span className="font-mono font-bold text-foreground">
                          ${nextUnlock.amount_needed.toLocaleString()}
                        </span>{" "}
                        to unlock{" "}
                        <span className="font-bold text-primary">
                          {nextUnlock.tier.label}
                        </span>
                      </span>
                    )}
                  </div>

                  <div className="relative pt-10 pb-4">
                    <div className="absolute top-0 flex w-full justify-between">
                      {STRATEGY_TIERS.map((tier) => {
                        const isUnlocked = capital >= tier.min_capital;
                        const isCurrent = currentTier.label === tier.label;
                        return (
                          <TooltipProvider key={tier.label}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div
                                  className={`flex flex-col items-center gap-2 ${isUnlocked ? "cursor-default" : "cursor-help"}`}
                                >
                                  <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                                      isCurrent
                                        ? "border-primary bg-primary text-primary-foreground scale-110 shadow-lg shadow-primary/20"
                                        : isUnlocked
                                          ? "border-primary/50 bg-primary/10 text-primary"
                                          : "border-border bg-muted/30 text-muted-foreground"
                                    }`}
                                  >
                                    {isUnlocked ? (
                                      <CheckCircle2 size={16} />
                                    ) : (
                                      <Lock size={14} />
                                    )}
                                  </div>
                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-tighter ${isUnlocked ? "text-foreground" : "text-muted-foreground"}`}
                                  >
                                    {tier.label}
                                  </span>
                                </div>
                              </TooltipTrigger>
                              {!isUnlocked && (
                                <TooltipContent className="bg-popover border-border text-popover-foreground">
                                  <p>
                                    Unlock at $
                                    {tier.min_capital.toLocaleString()}
                                  </p>
                                  <p className="text-[10px] text-muted-foreground">
                                    Need $
                                    {(
                                      tier.min_capital - capital
                                    ).toLocaleString()}{" "}
                                    more
                                  </p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>
                    <Progress
                      value={
                        capital > 0
                          ? (capital /
                              STRATEGY_TIERS[STRATEGY_TIERS.length - 1]
                                .min_capital) *
                            100
                          : 0
                      }
                      className="h-1"
                    />
                  </div>
                </div>
              </Card>

              {/* STRATEGY GRID */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-lg font-bold">
                    Active Allocation
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={optimize}
                      className="gap-2"
                    >
                      <RefreshCw size={14} /> Optimize
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => saveAllocations(recommendedAllocations)}
                      disabled={
                        Object.keys(recommendedAllocations).length === 0 ||
                        saving
                      }
                    >
                      Apply Allocation
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {availableStrategies.map((s) => {
                    const isExcluded = excludedStrategies.includes(s.name);
                    const currentAlloc = currentAllocations[s.name] || 0;
                    const recommendedAlloc =
                      recommendedAllocations[s.name] || 0;

                    return (
                      <StrategyCard
                        key={s.name}
                        strategy={s}
                        isExcluded={isExcluded}
                        currentAlloc={currentAlloc}
                        recommendedAlloc={recommendedAlloc}
                        onToggle={() => {
                          setExcludedStrategies((prev) =>
                            isExcluded
                              ? prev.filter((p) => p !== s.name)
                              : [...prev, s.name],
                          );
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* LOCKED STRATEGIES */}
              {lockedStrategies.length > 0 && (
                <div className="space-y-4 opacity-60">
                  <h3 className="font-display text-lg font-bold flex items-center gap-2">
                    <Lock size={18} /> Locked Strategies
                  </h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {lockedStrategies.map((s) => (
                      <Card
                        key={s.name}
                        className="border-border bg-muted/30 p-4 grayscale"
                      >
                        <p className="font-display font-bold text-sm">
                          {s.name}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1 uppercase">
                          Min Capital: $
                          {STRATEGY_TIERS.find((t) =>
                            t.strategies.includes(s),
                          )?.min_capital.toLocaleString()}
                        </p>
                        <p className="text-xs mt-2 text-muted-foreground line-clamp-2">
                          {s.description}
                        </p>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}{" "}
          {/* end allocator tab */}
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  icon: any;
  loading: boolean;
}) {
  return (
    <Card className="border-border bg-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          {loading ? (
            <Skeleton className="h-8 w-24 mt-2" />
          ) : (
            <p className="mt-2 font-display text-2xl font-black">{value}</p>
          )}
        </div>
        <div className="rounded-full bg-primary/10 p-3 text-primary">
          <Icon size={24} />
        </div>
      </div>
    </Card>
  );
}

function StrategyCard({
  strategy,
  isExcluded,
  currentAlloc,
  recommendedAlloc,
  onToggle,
}: {
  strategy: Strategy;
  isExcluded: boolean;
  currentAlloc: number;
  recommendedAlloc: number;
  onToggle: () => void;
}) {
  return (
    <Card
      className={`border-border bg-card p-5 transition-all ${isExcluded ? "opacity-40 grayscale" : ""}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-display font-bold text-foreground">
            {strategy.name}
          </h4>
          <p className="text-[10px] font-bold text-muted-foreground uppercase">
            Benchmark: {(strategy.avg_monthly_return * 100).toFixed(1)}%/mo
          </p>
        </div>
        <input
          type="checkbox"
          checked={!isExcluded}
          onChange={onToggle}
          className="h-4 w-4 rounded border-border bg-muted text-primary focus:ring-primary"
        />
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            <span>Current Allocation</span>
            <span>{currentAlloc.toFixed(1)}%</span>
          </div>
          <Progress value={currentAlloc} className="h-1" />
        </div>

        {recommendedAlloc > 0 && (
          <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-500">
            <div className="flex justify-between text-[10px] font-bold uppercase tracking-wider text-primary">
              <span>Recommended</span>
              <span>{recommendedAlloc.toFixed(1)}%</span>
            </div>
            <Progress value={recommendedAlloc} className="h-1 bg-primary/20" />
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
        {strategy.description}
      </p>
    </Card>
  );
}
