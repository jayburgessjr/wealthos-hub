import DashboardLayout from "@/components/layout/DashboardLayout";
import { positions } from "@/data/mockData";

export default function Positions() {
  const totalValue = positions.reduce((a, p) => a + p.value, 0);
  const totalPnl = positions.reduce((a, p) => a + p.pnlDollars, 0);
  const best = positions.reduce((a, p) => (p.pnlPercent > a.pnlPercent ? p : a));
  const worst = positions.reduce((a, p) => (p.pnlPercent < a.pnlPercent ? p : a));

  return (
    <DashboardLayout>
      <h2 className="mb-4 font-display text-xl font-bold text-foreground">Positions</h2>

      {/* Summary bar */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Value", val: `$${totalValue.toLocaleString()}`, color: "text-foreground" },
          { label: "Total P&L", val: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "text-bullish" : "text-bearish" },
          { label: "Best", val: `${best.ticker} +${best.pnlPercent}%`, color: "text-bullish" },
          { label: "Worst", val: `${worst.ticker} ${worst.pnlPercent}%`, color: "text-bearish" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <span className="block text-[10px] uppercase text-muted-foreground">{s.label}</span>
            <span className={`font-mono text-lg font-bold ${s.color}`}>{s.val}</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {["Asset", "Strategy", "Entry", "Entry $", "Current $", "Value", "P&L ($)", "P&L (%)", "Signal", "Days", ""].map((h) => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => {
              const days = Math.floor((Date.now() - new Date(p.entryDate).getTime()) / 86400000);
              return (
                <tr key={p.id} className="border-b border-border/50 transition-fast hover:bg-accent/30">
                  <td className="px-4 py-3 font-mono font-semibold text-foreground">{p.ticker}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.strategy}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{p.entryDate}</td>
                  <td className="px-4 py-3 font-mono">${p.entryPrice}</td>
                  <td className="px-4 py-3 font-mono">${p.currentPrice}</td>
                  <td className="px-4 py-3 font-mono">${p.value.toLocaleString()}</td>
                  <td className={`px-4 py-3 font-mono font-semibold ${p.pnlDollars >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {p.pnlDollars >= 0 ? "+" : ""}${p.pnlDollars.toFixed(2)}
                  </td>
                  <td className={`px-4 py-3 font-mono font-semibold ${p.pnlPercent >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {p.pnlPercent >= 0 ? "+" : ""}{p.pnlPercent}%
                  </td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs">{p.signalScore}</span>
                  </td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{days}d</td>
                  <td className="px-4 py-3">
                    <button className="rounded px-2 py-1 text-xs text-bearish hover:bg-bearish/10 transition-fast">Close</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
