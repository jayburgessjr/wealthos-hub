import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { strategyThresholds } from "@/data/mockData";

export default function Compound() {
  const [starting, setStarting] = useState(500);
  const [monthly, setMonthly] = useState(200);
  const [returnPct, setReturnPct] = useState(8);
  const [months, setMonths] = useState(24);

  const data = useMemo(() => {
    const rows = [];
    let capital = starting;
    for (let m = 0; m <= months; m++) {
      rows.push({ month: m, capital: Math.round(capital), ret: m === 0 ? 0 : Math.round(capital * returnPct / 100) });
      capital = capital * (1 + returnPct / 100) + monthly;
    }
    return rows;
  }, [starting, monthly, returnPct, months]);

  const finalCapital = data[data.length - 1]?.capital || 0;

  return (
    <DashboardLayout>
      <h2 className="mb-6 font-display text-xl font-bold text-foreground">Compound Growth Engine</h2>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Inputs */}
        <div className="space-y-4 rounded-lg border border-border bg-card p-5">
          {[
            { label: "Starting Capital ($)", val: starting, set: setStarting },
            { label: "Monthly Contribution ($)", val: monthly, set: setMonthly },
            { label: "Target Return (%)", val: returnPct, set: setReturnPct },
            { label: "Time Horizon (months)", val: months, set: setMonths },
          ].map((f) => (
            <div key={f.label}>
              <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
              <input
                type="number"
                value={f.val}
                onChange={(e) => f.set(+e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none focus:border-bullish transition-fast"
              />
            </div>
          ))}
          <div className="rounded-lg bg-bullish/10 p-3 text-center">
            <span className="block text-[10px] uppercase text-muted-foreground">Projected Value</span>
            <span className="font-mono text-2xl font-bold text-bullish">${finalCapital.toLocaleString()}</span>
          </div>
        </div>

        {/* Chart + unlocks */}
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-5">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#7A8BA3" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: "#7A8BA3" }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}K`} />
                <Tooltip contentStyle={{ background: "#111820", border: "1px solid #1C2535", borderRadius: 8, fontSize: 12 }} formatter={(v: number) => [`$${v.toLocaleString()}`, "Capital"]} />
                <Line type="monotone" dataKey="capital" stroke="#00E5A0" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Strategy Unlocks */}
          <div className="rounded-lg border border-border bg-card p-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Strategy Unlock Timeline</h3>
            <div className="space-y-3">
              {strategyThresholds.map((t) => {
                const unlocked = finalCapital >= t.capital;
                return (
                  <div key={t.label} className={`flex items-start gap-3 rounded-md p-2 transition-fast ${unlocked ? "bg-bullish/5" : "opacity-50"}`}>
                    <div className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${unlocked ? "bg-bullish" : "bg-border"}`} />
                    <div>
                      <span className="font-mono text-xs font-semibold text-foreground">{t.label}</span>
                      <p className="text-xs text-muted-foreground">{t.strategies.join(", ")}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Projection Table */}
      <div className="mt-6 overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 font-medium">Month</th>
              <th className="px-4 py-3 font-medium">Capital</th>
              <th className="px-4 py-3 font-medium">Return</th>
              <th className="px-4 py-3 font-medium">Cumulative</th>
            </tr>
          </thead>
          <tbody>
            {data.filter((_, i) => i % 3 === 0 || i === data.length - 1).map((r) => (
              <tr key={r.month} className="border-b border-border/50 transition-fast hover:bg-accent/30">
                <td className="px-4 py-2.5 font-mono">{r.month}</td>
                <td className="px-4 py-2.5 font-mono text-foreground">${r.capital.toLocaleString()}</td>
                <td className="px-4 py-2.5 font-mono text-bullish">${r.ret.toLocaleString()}</td>
                <td className="px-4 py-2.5 font-mono text-foreground">${r.capital.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
