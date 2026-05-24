import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Signal {
  ticker: string;
  signal_score: number;
}

function useHomeSignals() {
  return useQuery<Signal[]>({
    queryKey: ["home-signals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("signals")
        .select("ticker, signal_score")
        .order("signal_score", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function InvestPanel() {
  const { data: signals = [], isLoading } = useHomeSignals();
  const topSignal = signals[0] ?? null;
  const chipSignals = signals.slice(0, 5);

  return (
    <div className="rounded-xl border border-border border-t-2 border-t-emerald-500 bg-card p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-emerald-500">
            📈 Invest
          </p>
          <p className="mt-0.5 text-sm font-bold">Trading & Markets</p>
        </div>
        <Link
          to="/invs/dashboard"
          className="rounded-md bg-emerald-500 px-2 py-1 text-xs font-bold text-black hover:bg-emerald-400 transition-colors"
        >
          → Trading Desk
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Top Signal Today</p>
          {isLoading ? (
            <p className="font-mono text-base font-bold mt-0.5 text-muted-foreground">
              …
            </p>
          ) : topSignal ? (
            <>
              <p className="font-mono text-xl font-bold mt-0.5 text-emerald-500">
                {topSignal.ticker}
              </p>
              <p className="text-xs text-muted-foreground">
                Score: {topSignal.signal_score}/100
              </p>
            </>
          ) : (
            <p className="font-mono text-sm mt-0.5 text-muted-foreground">
              No signals today
            </p>
          )}
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Open P&L</p>
          <p className="font-mono text-xl font-bold mt-0.5">$—</p>
          <p className="text-xs text-muted-foreground">Connect broker</p>
        </div>
      </div>

      {chipSignals.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Recent signals</p>
          <div className="flex flex-wrap gap-1.5">
            {chipSignals.map((s) => (
              <span
                key={s.ticker}
                className={`rounded-md border px-2 py-0.5 text-xs font-mono ${
                  s.signal_score >= 50
                    ? "border-emerald-500/30 text-emerald-500"
                    : "border-red-500/30 text-red-400"
                }`}
              >
                {s.ticker} {s.signal_score >= 50 ? "▲" : "▼"}
              </span>
            ))}
            <Link
              to="/invs/discover"
              className="rounded-md border border-border px-2 py-0.5 text-xs font-mono text-muted-foreground hover:text-foreground transition-colors"
            >
              more →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
