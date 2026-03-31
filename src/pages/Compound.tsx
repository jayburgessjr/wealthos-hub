import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useMemo, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { STRATEGY_TIERS, getCurrentTier, getNextTierUnlock, getAvailableStrategies } from "@/data/strategyTiers";
import { projectGrowth, monteCarlo, reverseCalc, timeToGoal } from "@/lib/compoundEngine";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, Lock } from "lucide-react";

type RiskTier = "conservative" | "moderate" | "aggressive";

export default function Compound() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Local state (used as defaults until DB loads)
  const [starting, setStarting] = useState(0);
  const [monthly, setMonthly] = useState(0);
  const [months, setMonths] = useState(24);
  const [riskTier, setRiskTier] = useState<RiskTier>("moderate");
  const [reinvestPct, setReinvestPct] = useState(100);
  const [goalTarget, setGoalTarget] = useState(100000);
  const [goalMonths, setGoalMonths] = useState(36);
  const [goalMonthlyAdd, setGoalMonthlyAdd] = useState(500);
  const [loaded, setLoaded] = useState(false);

  // Load settings from DB
  useQuery({
    queryKey: ["compound_settings", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("compound_settings")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setStarting(data.starting_capital ?? 0);
        setMonthly(data.monthly_contribution ?? 0);
        setMonths(data.time_horizon_months ?? 24);
        setRiskTier((data.risk_tier as RiskTier) ?? "moderate");
        setReinvestPct(data.reinvestment_pct ?? 100);
      }
      setLoaded(true);
      return data;
    },
    enabled: !!user,
  });

  // Load portfolio capital
  useQuery({
    queryKey: ["portfolio_capital", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("portfolios")
        .select("total_capital")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.total_capital && !loaded) {
        setStarting(data.total_capital);
      }
      return data;
    },
    enabled: !!user,
  });

  // Save settings mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase.from("compound_settings").upsert({
        user_id: user.id,
        starting_capital: starting,
        monthly_contribution: monthly,
        time_horizon_months: months,
        risk_tier: riskTier,
        reinvestment_pct: reinvestPct,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["compound_settings"] }),
  });

  // Compute projections
  const projection = useMemo(() => projectGrowth({
    startingCapital: starting, monthlyContribution: monthly, timeHorizonMonths: months, riskTier, reinvestmentPct: reinvestPct,
  }), [starting, monthly, months, riskTier, reinvestPct]);

  const mc = useMemo(() => monteCarlo({
    startingCapital: starting, monthlyContribution: monthly, timeHorizonMonths: months, riskTier,
  }), [starting, monthly, months, riskTier]);

  const reverse = useMemo(() => reverseCalc({
    startingCapital: starting, monthlyContribution: monthly, targetCapital: goalTarget, timeHorizonMonths: goalMonths,
  }), [starting, monthly, goalTarget, goalMonths]);

  const ttg = useMemo(() => timeToGoal({
    startingCapital: starting, monthlyContribution: goalMonthlyAdd, targetCapital: goalTarget, riskTier,
  }), [starting, goalMonthlyAdd, goalTarget, riskTier]);

  const finalRow = projection[projection.length - 1];
  const midRow = projection[Math.min(12, projection.length - 1)];
  const currentTier = getCurrentTier(finalRow?.capital || 0);
  const startTier = getCurrentTier(starting);
  const blendedRate = finalRow ? finalRow.monthly_return_pct : "0";
  const strategiesCount = getAvailableStrategies(finalRow?.capital || 0).length;

  // Monte Carlo max for bar scaling
  const mcMax = mc.p90;
  const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}K` : `$${Math.round(v).toLocaleString()}`;
  const fmtFull = (v: number) => `$${Math.round(v).toLocaleString()}`;

  // Tier timeline data
  const tierTimeline = STRATEGY_TIERS.map((tier) => {
    const unlocked = (finalRow?.capital || 0) >= tier.min_capital;
    const isCurrent = currentTier.label === tier.label;
    return { ...tier, unlocked, isCurrent };
  });

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1400px] space-y-5">
        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-xl sm:text-[28px] font-extrabold leading-none tracking-tight">
              Compound <span className="text-bullish">Engine</span>
            </h1>
            <p className="mt-1.5 font-mono text-[11px] sm:text-[13px] text-muted-foreground hidden sm:block">
              // Every dollar assigned. Every return reinvested. Wealth compounded systematically.
            </p>
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            className="flex items-center justify-center gap-2 rounded-lg bg-bullish px-4 sm:px-6 py-2.5 font-display text-[13px] font-bold text-primary-foreground transition-all hover:shadow-[0_4px_24px_hsl(160_100%_45%/0.25)] hover:-translate-y-0.5 w-full sm:w-auto"
          >
            <Play className="h-3.5 w-3.5" /> Run Projection
          </button>
        </div>

        {/* Input Parameters Card */}
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
            <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">Projection Parameters</span>
            <span className="rounded bg-bullish/10 px-2 py-0.5 font-mono text-[10px] font-medium text-bullish">LIVE MODEL</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
            {/* Starting Capital */}
            <InputCell label="Starting Capital" prefix="$" value={starting} onChange={setStarting} />
            {/* Monthly Contribution */}
            <InputCell label="Monthly Contribution" prefix="$" value={monthly} onChange={setMonthly} />
            {/* Time Horizon */}
            <InputCell label="Time Horizon" suffix="mo" value={months} onChange={setMonths} />
            {/* Risk Tier */}
            <div className="flex flex-col gap-2.5 border-b sm:border-b-0 sm:border-r border-border p-5">
              <span className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground">Risk Tier</span>
              <div className="flex gap-1">
                {(["conservative", "moderate", "aggressive"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setRiskTier(t)}
                    className={`flex-1 rounded-md px-1 py-2 font-mono text-[10px] tracking-wide border transition-all ${
                      riskTier === t
                        ? t === "conservative" ? "bg-neutral/10 border-neutral/30 text-neutral"
                          : t === "moderate" ? "bg-bullish/10 border-bullish/30 text-bullish"
                          : "bg-bearish/10 border-bearish/30 text-bearish"
                        : "border-border text-muted-foreground hover:border-border hover:text-muted-foreground"
                    }`}
                  >
                    {t === "conservative" ? "CONS" : t === "moderate" ? "MOD" : "AGG"}
                  </button>
                ))}
              </div>
            </div>
            {/* Reinvestment Rate */}
            <div className="flex flex-col gap-2.5 p-5">
              <span className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground">Reinvestment Rate</span>
              <span className="font-mono text-lg font-semibold text-bullish">{reinvestPct}%</span>
              <input
                type="range"
                min={0}
                max={100}
                value={reinvestPct}
                onChange={(e) => setReinvestPct(+e.target.value)}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-bullish [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-bullish [&::-webkit-slider-thumb]:shadow-[0_0_8px_hsl(160_100%_45%/0.25)]"
              />
            </div>
          </div>
        </div>

        {/* Summary Stats Row */}
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
            <SummaryStat
              label="Starting"
              value={fmtFull(starting)}
              sub="Your seed capital"
              accent="muted"
            />
            <SummaryStat
              label="12-Month"
              value={midRow ? fmtFull(midRow.capital) : "—"}
              sub={midRow ? `+${midRow.cumulative_return_pct}%` : "—"}
              accent="blue"
            />
            <SummaryStat
              label="Final Value"
              value={finalRow ? fmtFull(finalRow.capital) : "—"}
              sub={finalRow ? `Month ${finalRow.month}` : "—"}
              accent="green"
            />
            <SummaryStat
              label="Total Return"
              value={finalRow ? `+${finalRow.cumulative_return_pct}%` : "—"}
              sub={finalRow ? fmtFull(finalRow.cumulative_return) : "—"}
              accent="yellow"
            />
            <SummaryStat
              label="Blended Rate"
              value={`${blendedRate}%`}
              sub="Monthly return"
              accent="purple"
            />
            <SummaryStat
              label="Strategies Unlocked"
              value={`${strategiesCount}`}
              sub={`${currentTier.label} tier`}
              accent="red"
              last
            />
          </div>
        </div>

        {/* Chart + Monte Carlo Row */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5">
          {/* Main Chart */}
          <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-border px-5 py-3.5">
              <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">Growth Projection</span>
              <div className="flex gap-3 sm:gap-5 flex-wrap">
                <LegendItem color="bg-bullish" label="Actual Path" />
                <LegendItem color="bg-neutral/60" label="P75 Scenario" />
                <LegendItem color="bg-bearish/50" label="P25 Scenario" />
              </div>
            </div>
            <div className="p-5">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={projection}>
                  <defs>
                    <linearGradient id="capitalGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(160 100% 45%)" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(160 100% 45%)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#7A8BA3" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#7A8BA3" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                  <Tooltip
                    contentStyle={{ background: "#111820", border: "1px solid #1C2535", borderRadius: 8, fontSize: 12 }}
                    formatter={(v: number) => [fmtFull(v), "Capital"]}
                    labelFormatter={(l) => `Month ${l}`}
                  />
                  <Area type="monotone" dataKey="capital" stroke="#00E5A0" strokeWidth={2} fill="url(#capitalGrad)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Monte Carlo Panel */}
          <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3">
            <div className="border-b border-border px-5 py-3.5">
              <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">Monte Carlo (500 runs)</span>
            </div>
            <div className="flex flex-col gap-4 p-5">
              <span className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground">Outcome Distribution</span>
              <div className="space-y-3">
                {[
                  { label: "P10 Bear", value: mc.p10, color: "bg-bearish" },
                  { label: "P25", value: mc.p25, color: "bg-watch" },
                  { label: "P50 Base", value: mc.p50, color: "bg-bullish" },
                  { label: "P75", value: mc.p75, color: "bg-neutral" },
                  { label: "P90 Bull", value: mc.p90, color: "bg-neutral" },
                ].map((s) => (
                  <div key={s.label} className="flex items-center gap-2.5">
                    <span className="w-14 flex-shrink-0 font-mono text-[10px] text-muted-foreground">{s.label}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <div className={`h-full rounded-full ${s.color}`} style={{ width: `${mcMax > 0 ? (s.value / mcMax) * 100 : 0}%`, transition: "width 0.8s ease" }} />
                    </div>
                    <span className="w-[72px] flex-shrink-0 text-right font-mono text-[11px] font-medium text-foreground">{fmtFull(s.value)}</span>
                  </div>
                ))}
              </div>

              <div className="flex justify-between border-t border-border pt-3">
                <ProbItem value={`${mc.probability_double.toFixed(0)}%`} label="Prob. 2x" green />
                <ProbItem value={`${(100 - mc.probability_of_loss).toFixed(0)}%`} label="Prob. Profit" green />
                <ProbItem value={`${mc.probability_of_loss.toFixed(0)}%`} label="Prob. Loss" />
              </div>

              <div className="border-t border-border pt-3">
                <span className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground">Time to $100K</span>
                <div className="mt-1 font-display text-xl font-extrabold text-foreground">
                  {timeToGoal({ startingCapital: starting, monthlyContribution: monthly, targetCapital: 100000, riskTier }).label}
                </div>
                <span className="font-mono text-[10px] text-muted-foreground">at current settings</span>
              </div>
            </div>
          </div>
        </div>

        {/* Tier Timeline */}
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3">
          <div className="border-b border-border px-5 py-3.5">
            <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">Strategy Unlock Timeline</span>
            <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">Capital milestones that unlock new wealth strategies</p>
          </div>
          <div className="px-4 sm:px-6 py-6 overflow-x-auto">
            {/* Timeline nodes */}
            <div className="flex items-center min-w-[600px]">
              {tierTimeline.map((tier, i) => (
                <div key={tier.label} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full border-2 font-mono text-[10px] font-semibold transition-all ${
                        tier.isCurrent
                          ? "border-bullish bg-bullish text-primary-foreground shadow-[0_0_20px_hsl(160_100%_45%/0.4)]"
                          : tier.unlocked
                          ? "border-bullish bg-bullish/10 text-bullish shadow-[0_0_16px_hsl(160_100%_45%/0.2)]"
                          : "border-border bg-surface text-muted-foreground opacity-40"
                      }`}
                    >
                      {tier.unlocked ? "✓" : <Lock className="h-3 w-3" />}
                    </div>
                    <div className="mt-2.5 text-center">
                      <div className="font-display text-xs font-bold" style={{ color: tier.color }}>{tier.label}</div>
                      <div className="font-mono text-[9px] text-muted-foreground">
                        ${tier.min_capital.toLocaleString()}
                      </div>
                      <span className={`mt-1 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] ${
                        tier.unlocked ? "bg-bullish/10 text-bullish" : "bg-border text-muted-foreground"
                      }`}>
                        {tier.unlocked ? "Reached" : "Locked"}
                      </span>
                    </div>
                  </div>
                  {i < tierTimeline.length - 1 && (
                    <div className={`mx-1 h-0.5 flex-1 rounded-full ${
                      tierTimeline[i + 1].unlocked ? "bg-bullish" : "bg-border"
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Strategy Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 px-5 pb-5">
            {STRATEGY_TIERS.map((tier) => {
              const unlocked = (finalRow?.capital || 0) >= tier.min_capital;
              const isCurrent = currentTier.label === tier.label;
              return (
                <div
                  key={tier.label}
                  className={`rounded-lg border overflow-hidden transition-all ${
                    isCurrent ? "border-bullish shadow-[0_0_20px_hsl(160_100%_45%/0.1)] opacity-100"
                    : unlocked ? "border-border opacity-100"
                    : "border-border opacity-50"
                  }`}
                >
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <span className="font-display text-[13px] font-bold" style={{ color: tier.color }}>{tier.label}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">
                      ${tier.min_capital.toLocaleString()}{tier.max_capital < Infinity ? `–$${tier.max_capital.toLocaleString()}` : "+"}
                    </span>
                    {!unlocked && <Lock className="ml-1 h-3 w-3 text-muted-foreground opacity-50" />}
                  </div>
                  <div className="flex flex-col gap-2 p-4">
                    {tier.strategies.map((s) => (
                      <div key={s.name} className="flex items-center justify-between gap-2">
                        <span className="text-xs text-muted-foreground">{s.name}</span>
                        <span className="font-mono text-[11px] text-bullish">{(s.avg_monthly_return * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Goal Calculators */}
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3">
          <div className="border-b border-border px-5 py-3.5">
            <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">Goal Calculators</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Time to Goal */}
            <div className="border-r border-border p-6">
              <span className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground">→ Time to Goal</span>
              <div className="mt-4 space-y-3">
                <GoalInput label="Target Capital ($)" value={goalTarget} onChange={setGoalTarget} />
                <GoalInput label="Monthly Add ($)" value={goalMonthlyAdd} onChange={setGoalMonthlyAdd} />
              </div>
              <div className="mt-4 rounded-lg border border-border bg-surface p-4">
                <div className="font-display text-[26px] font-extrabold text-bullish">{ttg.label}</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">to reach target</div>
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  {ttg.achievable
                    ? `Final value: ${fmtFull(ttg.final_capital)} at current compound rate.`
                    : "Exceeds 50-year window. Increase contributions or risk tier."}
                </p>
              </div>
            </div>

            {/* Required Return Rate */}
            <div className="p-6">
              <span className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground">→ Required Return Rate</span>
              <div className="mt-4 space-y-3">
                <GoalInput label="Target Capital ($)" value={goalTarget} onChange={setGoalTarget} />
                <GoalInput label="Months to Get There" value={goalMonths} onChange={setGoalMonths} />
              </div>
              <div className="mt-4 rounded-lg border border-border bg-surface p-4">
                <div className="font-display text-[26px] font-extrabold text-bullish">{reverse.required_monthly_pct}%/mo</div>
                <div className="mt-1 font-mono text-[10px] text-muted-foreground">required monthly return</div>
                <p className={`mt-2.5 text-xs leading-relaxed ${reverse.is_achievable ? "text-muted-foreground" : "text-bearish"}`}>
                  {reverse.verdict}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Projection Table */}
        <div className="rounded-xl border border-border bg-card overflow-hidden animate-in fade-in slide-in-from-bottom-3">
          <div className="border-b border-border px-5 py-3.5 flex items-center justify-between">
            <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">Month-by-Month Projection</span>
            <span className="font-mono text-[10px] text-muted-foreground">Scroll to explore</span>
          </div>
          <div className="max-h-80 overflow-y-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {["Month", "Capital", "Monthly Return", "Return %", "Cumulative Gain", "All-Time %", "Tier", "Strategies", "Next Unlock"].map((h) => (
                    <th key={h} className="sticky top-0 bg-surface px-4 py-3 text-left font-mono text-[9px] font-normal uppercase tracking-[1px] text-muted-foreground whitespace-nowrap border-b border-border">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projection.map((r) => (
                  <tr key={r.month} className="border-b border-border/30 transition-colors hover:bg-accent/30">
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{r.month}</td>
                    <td className="px-4 py-2.5 font-mono text-xs font-medium text-foreground">{fmtFull(r.capital)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-bullish">{fmtFull(r.monthly_return_dollars)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.monthly_return_pct}%</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-bullish">{fmtFull(r.cumulative_return)}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.cumulative_return_pct}%</td>
                    <td className="px-4 py-2.5">
                      <span className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wide" style={{ backgroundColor: r.tier_color + "20", color: r.tier_color }}>
                        {r.tier_label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-neutral">{r.strategies_available}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{r.next_unlock}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// --- Sub-components ---

function InputCell({ label, prefix, suffix, value, onChange }: {
  label: string; prefix?: string; suffix?: string; value: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-r border-border p-5 last:border-r-0">
      <span className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground">{label}</span>
      <div className="relative flex items-center">
        {prefix && <span className="mr-1 font-mono text-sm text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-[15px] font-medium text-foreground outline-none transition-all focus:border-bullish focus:shadow-[0_0_0_2px_hsl(160_100%_45%/0.1)]"
        />
        {suffix && <span className="absolute right-3 font-mono text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, sub, accent, last }: {
  label: string; value: string; sub: string; accent: string; last?: boolean;
}) {
  const accentColors: Record<string, string> = {
    muted: "from-muted-foreground",
    blue: "from-neutral",
    green: "from-bullish",
    yellow: "from-watch",
    purple: "from-[hsl(270_91%_65%)]",
    red: "from-bearish",
  };
  return (
    <div className={`relative overflow-hidden p-5 ${!last ? "border-r border-border" : ""}`}>
      <div className={`absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r ${accentColors[accent] || ""} to-transparent`} />
      <div className="font-mono text-[9px] uppercase tracking-[1px] text-muted-foreground mb-1.5">{label}</div>
      <div className="font-display text-[22px] font-extrabold leading-none mb-1">{value}</div>
      <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      <div className={`h-0.5 w-5 rounded-full ${color}`} />
      {label}
    </div>
  );
}

function ProbItem({ value, label, green }: { value: string; label: string; green?: boolean }) {
  return (
    <div className="text-center">
      <div className={`font-display text-xl font-extrabold ${green ? "text-bullish" : "text-bearish"}`}>{value}</div>
      <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{label}</div>
    </div>
  );
}

function GoalInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 flex-shrink-0 text-xs text-muted-foreground">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-36 rounded-md border border-border bg-surface px-3 py-1.5 font-mono text-[13px] text-foreground outline-none transition-all focus:border-bullish"
      />
    </div>
  );
}
