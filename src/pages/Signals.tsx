import DashboardLayout from "@/components/layout/DashboardLayout";
import { signals } from "@/data/mockData";
import { useState } from "react";

const actionColor: Record<string, string> = {
  "Strong Buy": "text-bullish border-bullish/30 bg-bullish/5 glow-green",
  Buy: "text-neutral border-neutral/30 bg-neutral/5 glow-blue",
  Watch: "text-watch border-watch/30 bg-watch/5 glow-yellow",
  Exit: "text-bearish border-bearish/30 bg-bearish/5 glow-red",
};

export default function Signals() {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? signals : signals.filter((s) => s.action === filter);

  return (
    <DashboardLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="font-display text-xl font-bold text-foreground">AI Signals</h2>
        <div className="flex gap-2">
          {["all", "Strong Buy", "Buy", "Watch", "Exit"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 font-body text-xs font-medium transition-fast ${
                filter === f ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {f === "all" ? "All" : f}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {filtered.sort((a, b) => b.signalScore - a.signalScore).map((s) => (
          <div key={s.id} className={`rounded-lg border p-5 transition-fast hover:scale-[1.01] ${actionColor[s.action]}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-xl font-bold">{s.ticker}</span>
                <span className="ml-2 text-xs text-muted-foreground">{s.strategyType}</span>
              </div>
              <span className="font-mono text-2xl font-bold">{s.signalScore}</span>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { l: "Entry", v: `$${s.entryPrice}` },
                { l: "Target", v: `$${s.targetPrice}` },
                { l: "Stop", v: `$${s.stopPrice}` },
              ].map((i) => (
                <div key={i.l} className="rounded bg-background p-2 text-center">
                  <span className="block text-[10px] uppercase text-muted-foreground">{i.l}</span>
                  <span className="font-mono text-sm font-semibold text-foreground">{i.v}</span>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <span className="text-[10px] uppercase text-muted-foreground">Size: </span>
              <span className="font-mono text-xs">${s.positionSizeDollar.toLocaleString()} ({s.positionSizePct}%)</span>
            </div>
            <ul className="mt-3 space-y-1">
              {s.reasoning.map((r, i) => (
                <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                  <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
                  {r}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
