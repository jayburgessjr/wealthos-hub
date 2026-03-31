import { watchlistItems, sentimentItems } from "@/data/mockData";

export default function WatchlistSentiment() {
  return (
    <div className="flex flex-col gap-4">
      {/* Watchlist */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Watchlist</h3>
        <div className="space-y-2">
          {watchlistItems.map((w) => (
            <div key={w.ticker} className="flex items-center justify-between rounded-md p-2 transition-fast hover:bg-accent/30">
              <div>
                <span className="font-mono text-sm font-semibold text-foreground">{w.ticker}</span>
                <span className="ml-2 text-xs text-muted-foreground">{w.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-foreground">${w.price}</span>
                <span className={`font-mono text-xs font-semibold ${w.change >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {w.change >= 0 ? "+" : ""}{w.change}%
                </span>
                <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs text-foreground">{w.signalScore}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sentiment Feed */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Sentiment Feed</h3>
        <div className="space-y-3">
          {sentimentItems.map((s, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-xs leading-relaxed text-foreground">{s.headline}</p>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-muted-foreground">{s.source} · {s.time}</span>
                <div className="flex h-1.5 w-16 overflow-hidden rounded-full bg-border">
                  <div className="h-full bg-bullish" style={{ width: `${s.sentiment}%` }} />
                  <div className="h-full bg-bearish" style={{ width: `${100 - s.sentiment}%` }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
