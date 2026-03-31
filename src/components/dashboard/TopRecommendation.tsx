import { signals } from "@/data/mockData";

export default function TopRecommendation() {
  const top = signals[0];
  return (
    <div className="rounded-lg border border-bullish/30 bg-card p-5 glow-green">
      <div className="mb-1 flex items-center justify-between">
        <span className="font-body text-xs font-semibold uppercase tracking-widest text-bullish">Top Pick</span>
        <span className="rounded-full bg-bullish/15 px-2 py-0.5 font-mono text-xs font-bold text-bullish">
          {top.signalScore}/100
        </span>
      </div>
      <h3 className="font-display text-2xl font-bold text-foreground">{top.ticker}</h3>
      <span className="mt-0.5 inline-block rounded bg-bullish/10 px-2 py-0.5 font-mono text-xs font-semibold text-bullish">
        {top.action}
      </span>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {[
          { label: "Entry", val: `$${top.entryPrice}` },
          { label: "Target", val: `$${top.targetPrice}` },
          { label: "Stop", val: `$${top.stopPrice}` },
        ].map((i) => (
          <div key={i.label} className="rounded-md bg-background p-2 text-center">
            <span className="block text-[10px] uppercase text-muted-foreground">{i.label}</span>
            <span className="font-mono text-sm font-semibold text-foreground">{i.val}</span>
          </div>
        ))}
      </div>
      <div className="mt-3">
        <span className="text-[10px] uppercase text-muted-foreground">Position Size</span>
        <p className="font-mono text-sm text-foreground">
          ${top.positionSizeDollar.toLocaleString()} ({top.positionSizePct}%)
        </p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {top.reasoning.map((r, i) => (
          <li key={i} className="flex gap-2 text-xs text-muted-foreground">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-bullish" />
            {r}
          </li>
        ))}
      </ul>
      <button className="mt-4 w-full rounded-lg bg-bullish py-2.5 font-body text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110">
        Execute Trade
      </button>
    </div>
  );
}
