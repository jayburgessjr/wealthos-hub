import { useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

const StatItem = ({ label, value, color }: { label: string; value: string; color?: string }) => (
  <div className="flex flex-col items-center gap-0.5 px-3">
    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
    <span className={`font-mono text-sm font-semibold ${color ?? "text-foreground"}`}>{value}</span>
  </div>
);

export default function Navbar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const hasCreated = useRef(false);

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ['portfolio', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { mutate: createPortfolio } = useMutation({
    mutationFn: async () => {
      await supabase.from('portfolios').insert({
        user_id: user!.id,
        total_capital: 0,
        available_capital: 0,
        deployed_capital: 0,
        total_pnl: 0,
        total_pnl_pct: 0,
        win_rate: 0,
        total_trades: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portfolio', user?.id] });
    },
  });

  useEffect(() => {
    if (user && portfolio === null && !isLoading && !hasCreated.current) {
      hasCreated.current = true;
      createPortfolio();
    }
  }, [user, portfolio, isLoading]);

  const totalCapital = portfolio?.total_capital ?? 0;
  const totalPnl = portfolio?.total_pnl ?? 0;
  const totalPnlPct = portfolio?.total_pnl_pct ?? 0;
  const deployed = portfolio?.deployed_capital ?? 0;
  const available = portfolio?.available_capital ?? 0;
  const winRate = portfolio?.win_rate ?? 0;

  const pnlColor = totalPnl >= 0 ? "text-bullish" : "text-bearish";
  const pnlLabel = `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <header className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <span className="relative flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-pulse-green rounded-full bg-bullish opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-bullish" />
        </span>
        <h1 className="font-display text-lg font-bold tracking-tight text-foreground">WealthOS</h1>
      </div>

      <div className="hidden items-center divide-x divide-border md:flex">
        {isLoading ? (
          <div className="flex gap-4 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 w-16 animate-pulse rounded bg-accent" />
            ))}
          </div>
        ) : (
          <>
            <StatItem label="Total Capital" value={`$${totalCapital.toLocaleString()}`} />
            <StatItem label="P&L" value={pnlLabel} color={pnlColor} />
            <StatItem label="Return" value={`${totalPnlPct.toFixed(1)}%`} color={pnlColor} />
            <StatItem label="Deployed" value={`$${deployed.toLocaleString()}`} />
            <StatItem label="Available" value={`$${available.toLocaleString()}`} />
            <StatItem label="Win Rate" value={`${winRate}%`} />
          </>
        )}
      </div>

      <div className="flex items-center gap-3">
        <span className="rounded-md border border-neutral/30 bg-neutral/10 px-2.5 py-1 font-mono text-xs font-medium text-neutral">
          RISK-ON
        </span>
        <span className="flex items-center gap-1.5 font-mono text-xs text-bullish">
          <span className="h-1.5 w-1.5 rounded-full bg-bullish animate-pulse-green" />
          LIVE
        </span>
        <div className="ml-2 border-l border-border pl-3">
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
