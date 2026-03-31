import DashboardLayout from "@/components/layout/DashboardLayout";
import { watchlistItems } from "@/data/mockData";
import { Plus } from "lucide-react";

export default function Watchlist() {
  return (
    <DashboardLayout>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-display text-xl font-bold text-foreground">Watchlist</h2>
        <button className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs text-muted-foreground transition-fast hover:border-bullish/30 hover:text-foreground">
          <Plus className="h-3.5 w-3.5" /> Add Asset
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="px-4 py-3 text-xs font-medium">Ticker</th>
              <th className="px-4 py-3 text-xs font-medium">Name</th>
              <th className="px-4 py-3 text-xs font-medium text-right">Price</th>
              <th className="px-4 py-3 text-xs font-medium text-right">Change</th>
              <th className="px-4 py-3 text-xs font-medium text-right">Signal</th>
            </tr>
          </thead>
          <tbody>
            {watchlistItems.map((w) => (
              <tr key={w.ticker} className="border-b border-border/50 transition-fast hover:bg-accent/30 cursor-pointer">
                <td className="px-4 py-4 font-mono font-bold text-foreground">{w.ticker}</td>
                <td className="px-4 py-4 text-muted-foreground">{w.name}</td>
                <td className="px-4 py-4 text-right font-mono text-foreground">${w.price}</td>
                <td className={`px-4 py-4 text-right font-mono font-semibold ${w.change >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {w.change >= 0 ? "+" : ""}{w.change}%
                </td>
                <td className="px-4 py-4 text-right">
                  <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-semibold ${
                    w.signalScore >= 75 ? "bg-bullish/10 text-bullish" :
                    w.signalScore >= 60 ? "bg-neutral/10 text-neutral" :
                    "bg-watch/10 text-watch"
                  }`}>
                    {w.signalScore}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}
