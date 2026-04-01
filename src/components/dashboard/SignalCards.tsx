import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDemo } from "@/components/DemoProvider";
import { sandboxSignals } from "@/data/sandboxData";

const ACTION_LABELS: Record<string, string> = {
  strong_buy: "Strong Buy", buy: "Buy", hold: "Hold",
  watch: "Watch", exit: "Exit", strong_exit: "Strong Exit",
};

const actionColor: Record<string, string> = {
  strong_buy: "text-bullish bg-bullish/10 border-bullish/30 glow-green",
  buy: "text-neutral bg-neutral/10 border-neutral/30 glow-blue",
  hold: "text-muted-foreground bg-accent border-border",
  watch: "text-watch bg-watch/10 border-watch/30 glow-yellow",
  exit: "text-bearish bg-bearish/10 border-bearish/30 glow-red",
  strong_exit: "text-bearish bg-bearish/10 border-bearish/30 glow-red",
};

const barColor: Record<string, string> = {
  strong_buy: "bg-bullish", buy: "bg-neutral", hold: "bg-muted-foreground",
  watch: "bg-watch", exit: "bg-bearish", strong_exit: "bg-bearish",
};

export default function SignalCards({ onSelectTicker }: { onSelectTicker?: (ticker: string) => void }) {
  const { isDemoMode } = useDemo();
  const { data: signals = [], isLoading } = useQuery({
    queryKey: ['signals', isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals;
      const { data } = await supabase
        .from('signals')
        .select('*')
        .order('signal_score', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-36 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (!signals.length) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-muted-foreground">No signals yet — go to Signals page to generate them.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {signals.map((s) => {
        const action = s.action ?? 'hold';
        const reasons = (s.reasoning as string[] | null) ?? [];
        return (
          <div
            key={s.id}
            onClick={() => onSelectTicker?.(s.ticker)}
            className={`rounded-lg border p-4 transition-fast hover:scale-[1.02] ${actionColor[action] ?? ''} cursor-pointer`}
          >
            <div className="flex items-center justify-between">
              <span className="font-mono text-lg font-bold">{s.ticker}</span>
              <span className="rounded-md border px-2 py-0.5 font-mono text-xs font-semibold uppercase">
                {ACTION_LABELS[action]}
              </span>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-xs opacity-70">Signal Score</span>
              <span className="font-mono text-lg font-bold">{s.signal_score}</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-background/50">
              <div
                className={`h-full ${barColor[action]}`}
                style={{ width: `${s.signal_score}%` }}
              />
            </div>
            {reasons[0] && (
              <p className="mt-2 text-xs text-muted-foreground line-clamp-1">{reasons[0]}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
