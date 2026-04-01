import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

export default function Positions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { mutate: closePosition, isPending: isClosing } = useMutation({
    mutationFn: async (position: typeof positions[0]) => {
      await supabase.from('positions').update({ status: 'closed' }).eq('id', position.id);

      await supabase.from('transactions').insert({
        user_id: user!.id,
        position_id: position.id,
        ticker: position.ticker,
        action: 'close',
        strategy_type: position.strategy_type,
        price: position.current_price ?? position.entry_price,
        quantity: position.shares_contracts,
        total_value: position.value ?? 0,
        pnl_realized: position.pnl_dollars ?? 0,
      });

      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('deployed_capital, available_capital, total_pnl, total_trades')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (portfolio) {
        await supabase.from('portfolios').update({
          deployed_capital: Math.max(0, (portfolio.deployed_capital ?? 0) - (position.value ?? 0)),
          available_capital: (portfolio.available_capital ?? 0) + (position.value ?? 0),
          total_pnl: (portfolio.total_pnl ?? 0) + (position.pnl_dollars ?? 0),
          total_trades: (portfolio.total_trades ?? 0) + 1,
        }).eq('user_id', user!.id);
      }
    },
    onSuccess: (_, position) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success(`${position.ticker} position closed`);
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to close position');
    },
  });

  const totalValue = positions.reduce((a, p) => a + (p.value ?? 0), 0);
  const totalPnl = positions.reduce((a, p) => a + (p.pnl_dollars ?? 0), 0);
  const best = positions.length
    ? positions.reduce((a, p) => ((p.pnl_percent ?? 0) > (a.pnl_percent ?? 0) ? p : a))
    : null;
  const worst = positions.length
    ? positions.reduce((a, p) => ((p.pnl_percent ?? 0) < (a.pnl_percent ?? 0) ? p : a))
    : null;

  return (
    <DashboardLayout>
      <h2 className="mb-4 font-display text-xl font-bold text-foreground">Positions</h2>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Value", val: `$${totalValue.toLocaleString()}`, color: "text-foreground" },
          { label: "Total P&L", val: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "text-bullish" : "text-bearish" },
          { label: "Best", val: best ? `${best.ticker} +${(best.pnl_percent ?? 0).toFixed(2)}%` : "—", color: "text-bullish" },
          { label: "Worst", val: worst ? `${worst.ticker} ${(worst.pnl_percent ?? 0).toFixed(2)}%` : "—", color: "text-bearish" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <span className="block text-[10px] uppercase text-muted-foreground">{s.label}</span>
            <span className={`font-mono text-lg font-bold ${s.color}`}>{s.val}</span>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-accent" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
          <p className="text-sm font-medium text-foreground">No open positions</p>
          <p className="mt-1 text-xs text-muted-foreground">Execute a trade from the Signals page to get started.</p>
        </div>
      ) : (
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
                const days = Math.floor((Date.now() - new Date(p.entry_date).getTime()) / 86400000);
                return (
                  <tr key={p.id} className="border-b border-border/50 transition-fast hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{p.ticker}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.strategy_type ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{p.entry_date}</td>
                    <td className="px-4 py-3 font-mono">${p.entry_price}</td>
                    <td className="px-4 py-3 font-mono">${p.current_price ?? p.entry_price}</td>
                    <td className="px-4 py-3 font-mono">${(p.value ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${(p.pnl_dollars ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {(p.pnl_dollars ?? 0) >= 0 ? "+" : ""}${(p.pnl_dollars ?? 0).toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 font-mono font-semibold ${(p.pnl_percent ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {(p.pnl_percent ?? 0) >= 0 ? "+" : ""}{(p.pnl_percent ?? 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs">
                        {p.signal_score ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{days}d</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => closePosition(p)}
                        disabled={isClosing}
                        className="rounded px-2 py-1 text-xs text-bearish transition-fast hover:bg-bearish/10 disabled:opacity-50"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </DashboardLayout>
  );
}
