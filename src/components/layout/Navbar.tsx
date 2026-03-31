import { portfolioStats } from "@/data/mockData";

const StatItem = ({ label, value, prefix = "", suffix = "", color }: {
  label: string; value: string | number; prefix?: string; suffix?: string; color?: string;
}) => (
  <div className="flex flex-col items-center gap-0.5 px-3">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className={`font-mono text-sm font-semibold ${color || "text-foreground"}`}>
      {prefix}{typeof value === "number" ? value.toLocaleString() : value}{suffix}
    </span>
  </div>
);

export default function Navbar() {
  const s = portfolioStats;
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-pulse-green rounded-full bg-bullish opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bullish" />
          </span>
          <h1 className="font-display text-lg font-bold tracking-tight text-foreground">WealthOS</h1>
        </div>
      </div>

      <div className="hidden items-center divide-x divide-border md:flex">
        <StatItem label="Total Capital" value={s.totalCapital} prefix="$" />
        <StatItem label="Today P&L" value={`+$${s.todayPnl.toFixed(2)}`} color="text-bullish" />
        <StatItem label="All-Time" value={s.allTimeReturn} suffix="%" color="text-bullish" />
        <StatItem label="Deployed" value={s.deployed} prefix="$" />
        <StatItem label="Available" value={s.available} prefix="$" />
        <StatItem label="Win Rate" value={s.winRate} suffix="%" />
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-md border border-neutral/30 bg-neutral/10 px-2.5 py-1 font-mono text-xs font-medium text-neutral">
          RISK-ON
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-bullish">
          <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse-green" />
          LIVE
        </span>
      </div>
    </header>
  );
}
