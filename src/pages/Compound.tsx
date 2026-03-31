import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { STRATEGY_TIERS, getCurrentTier, getNextTierUnlock, getAvailableStrategies } from "@/data/strategyTiers";
import { projectGrowth, monteCarlo, reverseCalc, timeToGoal } from "@/lib/compoundEngine";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function InputField({ label, value, onChange, suffix }: { label: string; value: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-muted-foreground">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(+e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-primary transition-all"
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

export default function Compound() {
  const [starting, setStarting] = useState(500);
  const [monthly, setMonthly] = useState(200);
  const [months, setMonths] = useState(24);
  const [riskTier, setRiskTier] = useState<string>("moderate");
  const [reinvestPct, setReinvestPct] = useState(100);
  const [goalTarget, setGoalTarget] = useState(50000);

  const projection = useMemo(() => projectGrowth({
    startingCapital: starting, monthlyContribution: monthly, timeHorizonMonths: months, riskTier, reinvestmentPct: reinvestPct,
  }), [starting, monthly, months, riskTier, reinvestPct]);

  const mc = useMemo(() => monteCarlo({
    startingCapital: starting, monthlyContribution: monthly, timeHorizonMonths: months, riskTier,
  }), [starting, monthly, months, riskTier]);

  const reverse = useMemo(() => reverseCalc({
    startingCapital: starting, monthlyContribution: monthly, targetCapital: goalTarget, timeHorizonMonths: months,
  }), [starting, monthly, goalTarget, months]);

  const ttg = useMemo(() => timeToGoal({
    startingCapital: starting, monthlyContribution: monthly, targetCapital: goalTarget, riskTier,
  }), [starting, monthly, goalTarget, riskTier]);

  const finalRow = projection[projection.length - 1];
  const currentTier = getCurrentTier(finalRow?.capital || 0);
  const nextUnlock = getNextTierUnlock(starting);

  return (
    <DashboardLayout>
      <h2 className="mb-6 font-display text-xl font-bold text-foreground">Compound Growth Engine</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Inputs Panel */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          <InputField label="Starting Capital ($)" value={starting} onChange={setStarting} />
          <InputField label="Monthly Contribution ($)" value={monthly} onChange={setMonthly} />
          <InputField label="Time Horizon (months)" value={months} onChange={setMonths} />
          <InputField label="Reinvestment (%)" value={reinvestPct} onChange={setReinvestPct} suffix="%" />

          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Risk Tier</label>
            <div className="flex gap-1">
              {["conservative", "moderate", "aggressive"].map((t) => (
                <button
                  key={t}
                  onClick={() => setRiskTier(t)}
                  className={`flex-1 rounded-md px-2 py-1.5 text-xs font-medium capitalize transition-all ${riskTier === t ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Projected Value */}
          <div className="rounded-lg bg-primary/10 p-3 text-center">
            <span className="block text-[10px] uppercase text-muted-foreground">Projected Value</span>
            <span className="font-mono text-2xl font-bold text-primary">${Math.round(finalRow?.capital || 0).toLocaleString()}</span>
            <span className="mt-1 block text-xs text-muted-foreground">+{finalRow?.cumulative_return_pct}% return</span>
          </div>

          {/* Monte Carlo Summary */}
          <div className="rounded-lg border border-border p-3 space-y-1.5">
            <span className="block text-[10px] uppercase text-muted-foreground font-semibold">Monte Carlo (500 runs)</span>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                { label: "Worst 10%", val: mc.p10, color: "text-destructive" },
                { label: "Median", val: mc.p50, color: "text-primary" },
                { label: "Best 10%", val: mc.p90, color: "text-primary" },
              ].map((s) => (
                <div key={s.label}>
                  <span className="block text-[9px] text-muted-foreground">{s.label}</span>
                  <span className={`font-mono text-xs font-bold ${s.color}`}>${Math.round(s.val).toLocaleString()}</span>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Loss prob: {mc.probability_of_loss.toFixed(1)}%</span>
              <span>2x prob: {mc.probability_double.toFixed(1)}%</span>
            </div>
          </div>

          {/* Next Tier Unlock */}
          {nextUnlock && (
            <div className="rounded-lg border border-border p-3">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Next: <span className="font-semibold text-foreground">{nextUnlock.tier.label}</span></span>
                <span className="font-mono text-muted-foreground">${nextUnlock.amount_needed.toLocaleString()} away</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-border">
                <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, nextUnlock.pct_of_way)}%`, backgroundColor: nextUnlock.tier.color }} />
              </div>
            </div>
          )}
        </div>

        {/* Main Content */}
        <div className="space-y-4">
          <Tabs defaultValue="projection" className="w-full">
            <TabsList className="mb-4 bg-card border border-border">
              <TabsTrigger value="projection">Projection</TabsTrigger>
              <TabsTrigger value="tiers">Strategy Tiers</TabsTrigger>
              <TabsTrigger value="goal">Goal Calculator</TabsTrigger>
            </TabsList>

            {/* Projection Chart */}
            <TabsContent value="projection">
              <div className="rounded-lg border border-border bg-card p-5">
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={projection}>
                    <defs>
                      <linearGradient id="capitalGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                    <Tooltip
                      contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      formatter={(v: number, name: string) => {
                        if (name === "capital") return [`$${v.toLocaleString()}`, "Capital"];
                        return [`$${v.toLocaleString()}`, name];
                      }}
                    />
                    <Area type="monotone" dataKey="capital" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#capitalGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Projection Table */}
              <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="px-4 py-3 font-medium">Month</th>
                      <th className="px-4 py-3 font-medium">Capital</th>
                      <th className="px-4 py-3 font-medium">Return</th>
                      <th className="px-4 py-3 font-medium">Tier</th>
                      <th className="px-4 py-3 font-medium">Strategies</th>
                      <th className="px-4 py-3 font-medium">Next Unlock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projection.filter((_, i) => i % 3 === 0 || i === projection.length - 1).map((r) => (
                      <tr key={r.month} className="border-b border-border/50 transition-all hover:bg-accent/30">
                        <td className="px-4 py-2.5 font-mono">{r.month}</td>
                        <td className="px-4 py-2.5 font-mono text-foreground">${r.capital.toLocaleString()}</td>
                        <td className="px-4 py-2.5 font-mono text-primary">${r.monthly_return_dollars.toLocaleString()}</td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: r.tier_color + "20", color: r.tier_color }}>
                            {r.tier_label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">{r.strategies_available}</td>
                        <td className="px-4 py-2.5 text-muted-foreground text-[11px]">{r.next_unlock}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* Strategy Tiers */}
            <TabsContent value="tiers">
              <div className="space-y-3">
                {STRATEGY_TIERS.map((tier) => {
                  const unlocked = (finalRow?.capital || 0) >= tier.min_capital;
                  return (
                    <div key={tier.label} className={`rounded-lg border border-border bg-card p-4 transition-all ${unlocked ? "" : "opacity-40"}`}>
                      <div className="mb-3 flex items-center gap-3">
                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tier.color }} />
                        <span className="font-display text-sm font-bold text-foreground">{tier.label}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          ${tier.min_capital.toLocaleString()}{tier.max_capital < Infinity ? ` – $${tier.max_capital.toLocaleString()}` : "+"}
                        </span>
                        {unlocked && <span className="ml-auto rounded bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">UNLOCKED</span>}
                      </div>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {tier.strategies.map((s) => (
                          <div key={s.name} className="rounded-md bg-secondary/50 p-2.5">
                            <span className="block text-xs font-semibold text-foreground">{s.name}</span>
                            <span className="block text-[11px] text-muted-foreground">{s.description}</span>
                            <span className="mt-1 block font-mono text-[10px] text-primary">{(s.avg_monthly_return * 100).toFixed(1)}%/mo</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </TabsContent>

            {/* Goal Calculator */}
            <TabsContent value="goal">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <h3 className="font-display text-sm font-semibold text-foreground">Reverse Calculator</h3>
                  <InputField label="Goal Amount ($)" value={goalTarget} onChange={setGoalTarget} />
                  <div className="rounded-lg bg-secondary p-3 space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Required Monthly</span>
                      <span className="font-mono font-bold text-foreground">{reverse.required_monthly_pct}%</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Required Annual</span>
                      <span className="font-mono font-bold text-foreground">{reverse.required_annual_pct}%</span>
                    </div>
                    <p className={`text-xs mt-2 ${reverse.is_achievable ? "text-primary" : "text-destructive"}`}>{reverse.verdict}</p>
                    {reverse.suggested_strategies.length > 0 && (
                      <div className="mt-2">
                        <span className="text-[10px] uppercase text-muted-foreground">Suggested Strategies</span>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {reverse.suggested_strategies.map((s) => (
                            <span key={s} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{s}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border border-border bg-card p-5 space-y-4">
                  <h3 className="font-display text-sm font-semibold text-foreground">Time to Goal</h3>
                  <div className="flex items-center justify-center py-6">
                    <div className="text-center">
                      <span className="font-mono text-4xl font-bold text-primary">{ttg.label}</span>
                      <p className="mt-1 text-xs text-muted-foreground">to reach ${goalTarget.toLocaleString()}</p>
                      <p className="mt-2 text-xs text-muted-foreground">Final value: <span className="font-mono text-foreground">${ttg.final_capital.toLocaleString()}</span></p>
                    </div>
                  </div>
                  {!ttg.achievable && <p className="text-xs text-destructive text-center">Exceeds 50-year projection window. Increase contributions or risk tier.</p>}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
