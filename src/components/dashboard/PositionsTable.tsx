import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPositions } from "@/data/sandboxData";

export default function PositionsTable() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(4);
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Open Positions</h3>
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded bg-accent" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">No open positions</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="pb-2 font-medium">Asset</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 text-right font-medium">Value</th>
                <th className="pb-2 text-right font-medium">P&L</th>
                <th className="pb-2 text-right font-medium">Signal</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.id} className="border-b border-border/50 transition-fast hover:bg-accent/30">
                  <td className="py-2.5 font-mono font-semibold text-foreground">{p.ticker}</td>
                  <td className="py-2.5 text-muted-foreground">{p.strategy_type ?? '—'}</td>
                  <td className="py-2.5 text-right font-mono text-foreground">
                    ${(p.value ?? 0).toLocaleString()}
                  </td>
                  <td className={`py-2.5 text-right font-mono font-semibold ${(p.pnl_dollars ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {(p.pnl_dollars ?? 0) >= 0 ? "+" : ""}${(p.pnl_dollars ?? 0).toFixed(2)}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs">
                      {p.signal_score ?? '—'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
