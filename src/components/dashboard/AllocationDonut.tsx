import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPositions } from "@/data/sandboxData";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";

const ASSET_CLASS_CONFIG: Record<string, { label: string; color: string }> = {
  equity:      { label: "Equities",     color: "#3D8EFF" },
  crypto:      { label: "Crypto",       color: "#F59E0B" },
  forex:       { label: "Forex",        color: "#00E5A0" },
  commodity:   { label: "Commodities",  color: "#FF6B35" },
  bond:        { label: "Bonds",        color: "#8B5CF6" },
  reit:        { label: "REITs",        color: "#EC4899" },
  etf:         { label: "ETFs",         color: "#06B6D4" },
  alternative: { label: "Alternatives", color: "#84CC16" },
};

const STRATEGY_FALLBACK: Record<string, string> = {
  long_stock:        "equity",
  short_stock:       "equity",
  covered_call:      "equity",
  cash_secured_put:  "equity",
  call_debit:        "equity",
  put_debit:         "equity",
  call_spread:       "equity",
  put_spread:        "equity",
  hard_money:        "alternative",
  tax_lien:          "alternative",
  p2p_lending:       "alternative",
};

function deriveAssetClass(position: any): string {
  if (position.asset_class && position.asset_class !== "equity") return position.asset_class;
  // Infer from ticker patterns
  const ticker = position.ticker?.toUpperCase() ?? "";
  const crypto = ["BTC","ETH","SOL","BNB","XRP","ADA","AVAX","DOT","MATIC","LINK","DOGE","SHIB","UNI","AAVE","LTC"];
  if (crypto.some(c => ticker === c || ticker.startsWith(`${c}-`))) return "crypto";
  // Infer from strategy
  return STRATEGY_FALLBACK[position.strategy_type] ?? "equity";
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 shadow-lg">
      <p className="font-display text-sm font-bold text-foreground">{d.label}</p>
      <p className="font-mono text-sm text-muted-foreground">{d.pct.toFixed(1)}% · ${d.value.toLocaleString()}</p>
    </div>
  );
}

export default function AllocationDonut() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ["positions-alloc", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase
        .from("positions")
        .select("ticker, value, asset_class, strategy_type")
        .eq("user_id", user!.id)
        .eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  // Aggregate by asset class
  const buckets = positions.reduce((acc: Record<string, number>, p) => {
    const cls = deriveAssetClass(p);
    acc[cls] = (acc[cls] ?? 0) + (p.value ?? 0);
    return acc;
  }, {});

  const totalValue = Object.values(buckets).reduce((a, b) => a + b, 0);

  const chartData = Object.entries(buckets)
    .map(([cls, value]) => ({
      cls,
      label: ASSET_CLASS_CONFIG[cls]?.label ?? cls,
      color: ASSET_CLASS_CONFIG[cls]?.color ?? "#7A8BA3",
      value,
      pct: totalValue > 0 ? (value / totalValue) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  const topClass = chartData[0];

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold text-foreground">Portfolio Allocation</h3>
        <Link to="/positions" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          View all <ArrowRight size={10} />
        </Link>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="h-32 w-32 animate-pulse rounded-full bg-accent/40" />
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-2">
          <p className="text-xs uppercase tracking-widest text-muted-foreground/50">No open positions</p>
          <Link to="/signals" className="text-xs text-primary hover:underline">Browse signals →</Link>
        </div>
      ) : (
        <>
          <div className="relative h-44">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={76}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.cls} fill={entry.color} style={{ filter: `drop-shadow(0 0 4px ${entry.color}50)` }} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            {/* Center label */}
            {topClass && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="font-display text-2xl font-black" style={{ color: topClass.color }}>
                  {topClass.pct.toFixed(0)}%
                </p>
                <p className="font-mono text-xs font-semibold text-muted-foreground">{topClass.label}</p>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="mt-2 space-y-1.5">
            {chartData.map(d => (
              <div key={d.cls} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="font-mono text-xs text-muted-foreground">{d.label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground">{d.pct.toFixed(1)}%</span>
                  <span className="font-mono text-xs font-bold text-foreground">${d.value.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
