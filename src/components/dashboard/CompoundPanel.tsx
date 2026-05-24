import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { projectGrowth } from "@/lib/compoundEngine";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPortfolio, sandboxPositions } from "@/data/sandboxData";

export default function CompoundPanel() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: portfolio, isLoading: portLoading } = useQuery({
    queryKey: ["portfolio", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase
        .from("portfolios")
        .select("total_capital")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: settings, isLoading: settingsLoading } = useQuery({
    queryKey: ["compound-settings", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode)
        return {
          starting_capital: 100000,
          monthly_contribution: 2500,
          reinvestment_pct: 100,
          risk_tier: "moderate",
        };
      const { data } = await supabase
        .from("compound_settings")
        .select(
          "starting_capital, monthly_contribution, reinvestment_pct, risk_tier",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", user?.id, "open", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase
        .from("positions")
        .select("value, strategy_type")
        .eq("user_id", user!.id)
        .eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const startingCapital = settings?.starting_capital ?? 0;
  const currentCapital = portfolio?.total_capital ?? 0;
  const targetCapital = 52000; // Default or from settings if we added it

  const projections = projectGrowth({
    startingCapital: currentCapital,
    monthlyContribution: settings?.monthly_contribution ?? 0,
    timeHorizonMonths: 12,
    reinvestmentPct: settings?.reinvestment_pct ?? 100,
    riskTier: settings?.risk_tier || "moderate",
  });

  // Calculate strategy distribution from open positions
  const strategyDistribution: Record<string, number> = {};
  let totalValue = 0;
  positions.forEach((p) => {
    const val = p.value ?? 0;
    const strat = p.strategy_type || "Other";
    strategyDistribution[strat] = (strategyDistribution[strat] || 0) + val;
    totalValue += val;
  });

  const distributionList = Object.entries(strategyDistribution)
    .map(([label, val]) => ({
      label,
      pct: totalValue > 0 ? Math.round((val / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 3);

  if (portLoading || settingsLoading) {
    return <Skeleton className="h-64 w-full rounded-lg" />;
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="mb-1 font-display text-sm font-semibold text-foreground">
        Compound Engine
      </h3>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-mono text-xs text-muted-foreground">
          ${startingCapital.toLocaleString()}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="font-mono text-lg font-bold text-bullish">
          ${currentCapital.toLocaleString()}
        </span>
        <span className="text-muted-foreground">→</span>
        <span className="font-mono text-xs text-neutral">
          ${targetCapital.toLocaleString()} target
        </span>
      </div>
      <ResponsiveContainer width="100%" height={140}>
        <LineChart data={projections}>
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10, fill: "#7A8BA3" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelFormatter={(l) => `Month ${l}`}
          />
          <Line
            type="monotone"
            dataKey="capital"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            name="Projected"
          />
        </LineChart>
      </ResponsiveContainer>
      <div className="mt-3 space-y-1.5">
        {distributionList.length > 0 ? (
          distributionList.map((s) => (
            <div key={s.label} className="flex items-center gap-2 text-xs">
              <span className="w-28 text-muted-foreground truncate">
                {s.label}
              </span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                <div
                  className="h-full rounded-full bg-bullish/60"
                  style={{ width: `${s.pct}%` }}
                />
              </div>
              <span className="font-mono text-muted-foreground">{s.pct}%</span>
            </div>
          ))
        ) : (
          <p className="text-[10px] text-muted-foreground text-center py-2 uppercase font-bold tracking-widest">
            No active allocations
          </p>
        )}
      </div>
    </div>
  );
}
