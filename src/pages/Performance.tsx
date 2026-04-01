import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxTransactions, sandboxPositions } from "@/data/sandboxData";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from "recharts";
import { format } from "date-fns";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function Performance() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ['transactions', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxTransactions;
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user!.id)
        .order('executed_at', { ascending: true });
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const { data: closedPositions = [] } = useQuery({
    queryKey: ['positions', user?.id, 'closed', isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return []; // Just use transactions for demo
      const { data } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'closed');
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  // Calculate stats
  const totalTrades = transactions.length;
  const winningTrades = transactions.filter(t => (t.pnl_realized ?? 0) > 0).length;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  
  const avgHoldDays = closedPositions.length > 0
    ? closedPositions.reduce((acc, p) => {
        const entry = new Date(p.entry_date);
        const exit = p.expiry_date ? new Date(p.expiry_date) : new Date(); // Using expiry_date as proxy for exit if status closed
        return acc + (exit.getTime() - entry.getTime()) / (1000 * 3600 * 24);
      }, 0) / closedPositions.length
    : 0;

  const bestTrade = transactions.length > 0 ? Math.max(...transactions.map(t => t.pnl_realized ?? 0)) : 0;
  const worstTrade = transactions.length > 0 ? Math.min(...transactions.map(t => t.pnl_realized ?? 0)) : 0;

  // Equity Curve Data
  let cumulativePnl = 0;
  const equityCurveData = transactions.map(t => {
    cumulativePnl += (t.pnl_realized ?? 0);
    return {
      date: format(new Date(t.executed_at!), 'MMM dd'),
      pnl: cumulativePnl
    };
  });
  if (equityCurveData.length > 0) {
    equityCurveData.unshift({ date: 'Start', pnl: 0 });
  }

  // Strategy Breakdown Data
  const strategyMap: Record<string, number> = {};
  transactions.forEach(t => {
    const strat = t.strategy_type || 'Unknown';
    strategyMap[strat] = (strategyMap[strat] || 0) + (t.pnl_realized ?? 0);
  });
  const strategyData = Object.entries(strategyMap).map(([name, value]) => ({ name, value }));

  const sortedTransactions = [...transactions].reverse();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-display text-2xl font-bold text-foreground">Performance Analytics</h2>

        {/* Top Row — Stats */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard label="Total Trades" value={totalTrades.toString()} />
          <StatCard label="Overall Win Rate" value={`${winRate.toFixed(1)}%`} />
          <StatCard label="Avg Hold Days" value={`${avgHoldDays.toFixed(1)}d`} />
          <StatCard label="Best Trade" value={`$${bestTrade.toLocaleString()}`} color="text-bullish" />
          <StatCard label="Worst Trade" value={`$${worstTrade.toLocaleString()}`} color="text-bearish" />
        </div>

        {/* Middle Row — Charts */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="border-border bg-card p-6">
            <h3 className="mb-6 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Equity Curve (Cumulative PnL)</h3>
            <div className="h-[300px] w-full">
              {equityCurveData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={equityCurveData}>
                    <defs>
                      <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      itemStyle={{ color: 'hsl(var(--primary))' }}
                    />
                    <Area type="monotone" dataKey="pnl" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorPnl)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  Execute your first trade to see your equity curve
                </div>
              )}
            </div>
          </Card>

          <Card className="border-border bg-card p-6">
            <h3 className="mb-6 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Strategy PnL Breakdown</h3>
            <div className="h-[300px] w-full">
              {strategyData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={strategyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                      cursor={{ fill: 'hsl(var(--accent))', opacity: 0.1 }}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {strategyData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.value >= 0 ? 'hsl(var(--bullish))' : 'hsl(var(--bearish))'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground">
                  No strategy data available
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Bottom Row — Trade History */}
        <Card className="border-border bg-card">
          <div className="p-6">
            <h3 className="mb-4 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trade History</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-muted-foreground">Date</TableHead>
                    <TableHead className="text-muted-foreground">Ticker</TableHead>
                    <TableHead className="text-muted-foreground">Strategy</TableHead>
                    <TableHead className="text-muted-foreground">Action</TableHead>
                    <TableHead className="text-muted-foreground text-right">Price</TableHead>
                    <TableHead className="text-muted-foreground text-right">Qty</TableHead>
                    <TableHead className="text-muted-foreground text-right">Total</TableHead>
                    <TableHead className="text-muted-foreground text-right">P&L</TableHead>
                    <TableHead className="text-muted-foreground text-right">Signal Score</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i} className="border-border">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : sortedTransactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">No transactions found</TableCell>
                    </TableRow>
                  ) : (
                    sortedTransactions.map((t) => (
                      <TableRow key={t.id} className="border-border hover:bg-accent/30 transition-fast">
                        <TableCell className="font-mono text-xs">{format(new Date(t.executed_at!), 'yyyy-MM-dd')}</TableCell>
                        <TableCell className="font-mono font-bold">{t.ticker}</TableCell>
                        <TableCell className="text-xs">{t.strategy_type}</TableCell>
                        <TableCell className="uppercase text-[10px] font-bold tracking-tighter">{t.action}</TableCell>
                        <TableCell className="font-mono text-right text-xs">${t.price.toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-right text-xs">{t.quantity}</TableCell>
                        <TableCell className="font-mono text-right text-xs font-bold">${t.total_value.toLocaleString()}</TableCell>
                        <TableCell className={`font-mono text-right text-xs font-bold ${(t.pnl_realized ?? 0) >= 0 ? 'text-bullish' : 'text-bearish'}`}>
                          {(t.pnl_realized ?? 0) >= 0 ? '+' : ''}${t.pnl_realized?.toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-right text-xs">
                          <span className="rounded bg-accent px-1.5 py-0.5">{t.signal_score_at_entry ?? '—'}</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <Card className="border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`mt-1 font-mono text-2xl font-bold ${color ?? 'text-foreground'}`}>{value}</p>
    </Card>
  );
}
