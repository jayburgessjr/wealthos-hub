import { signals } from "@/data/mockData";

const actionColor: Record<string, string> = {
  "Strong Buy": "text-bullish bg-bullish/10 border-bullish/30 glow-green",
  Buy: "text-neutral bg-neutral/10 border-neutral/30 glow-blue",
  Watch: "text-watch bg-watch/10 border-watch/30 glow-yellow",
  Exit: "text-bearish bg-bearish/10 border-bearish/30 glow-red",
};

const barColor: Record<string, string> = {
  "Strong Buy": "bg-bullish",
  Buy: "bg-neutral",
  Watch: "bg-watch",
  Exit: "bg-bearish",
};

export default function SignalCards() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {signals.map((s) => (
        <div
          key={s.id}
          className={`rounded-lg border p-4 transition-fast hover:scale-[1.02] ${actionColor[s.action]} cursor-pointer`}
        >
          <div className="flex items-center justify-between">
            <span className="font-mono text-lg font-bold">{s.ticker}</span>
            <span className="rounded-md border px-2 py-0.5 font-mono text-xs font-semibold uppercase">
              {s.action}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{s.strategyType}</p>
          <div className="mt-3 flex items-end justify-between">
            <span className="font-mono text-2xl font-bold">{s.signalScore}</span>
            <span className="font-mono text-xs text-muted-foreground">/100</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-border">
            <div
              className={`h-full rounded-full transition-fast ${barColor[s.action]}`}
              style={{ width: `${s.signalScore}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{s.reasoning[0]}</p>
        </div>
      ))}
    </div>
  );
}
