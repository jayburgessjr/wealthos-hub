import { positions } from "@/data/mockData";

export default function PositionsTable() {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Open Positions</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="pb-2 font-medium">Asset</th>
              <th className="pb-2 font-medium">Type</th>
              <th className="pb-2 font-medium text-right">Value</th>
              <th className="pb-2 font-medium text-right">P&L</th>
              <th className="pb-2 font-medium text-right">Signal</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <tr key={p.id} className="border-b border-border/50 transition-fast hover:bg-accent/30">
                <td className="py-2.5 font-mono font-semibold text-foreground">{p.ticker}</td>
                <td className="py-2.5 text-muted-foreground">{p.strategy}</td>
                <td className="py-2.5 text-right font-mono text-foreground">${p.value.toLocaleString()}</td>
                <td className={`py-2.5 text-right font-mono font-semibold ${p.pnlDollars >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {p.pnlDollars >= 0 ? "+" : ""}${p.pnlDollars.toFixed(2)}
                </td>
                <td className="py-2.5 text-right">
                  <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs">{p.signalScore}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
