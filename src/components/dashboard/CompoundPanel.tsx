import { compoundData } from "@/data/mockData";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

export default function CompoundPanel() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-1 font-display text-sm font-semibold text-foreground">Compound Engine</h3>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground">$0</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-mono text-lg font-bold text-bullish">$24,830</span>
        <span className="text-muted-foreground">→</span>
        <span className="font-mono text-xs text-neutral">$52K target</span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={compoundData}>
          <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#7A8BA3" }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: "#111820", border: "1px solid #1C2535", borderRadius: 8, fontSize: 12 }}
            labelFormatter={(l) => `Month ${l}`}
          />
          <Line type="monotone" dataKey="actual" stroke="#00E5A0" strokeWidth={2} dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="projected" stroke="#3D8EFF" strokeWidth={1.5} strokeDasharray="5 5" dot={false} />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {[
          { label: "Options Premium", pct: 42 },
          { label: "Momentum Trades", pct: 35 },
          { label: "Hard Money Lending", pct: 23 },
        ].map((s) => (
          <div key={s.label} className="flex items-center gap-2 text-xs">
            <span className="w-28 text-muted-foreground">{s.label}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
              <div className="h-full rounded-full bg-bullish/60" style={{ width: `${s.pct}%` }} />
            </div>
            <span className="font-mono text-muted-foreground">{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
