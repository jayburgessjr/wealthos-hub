import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { useDemo } from "@/components/DemoProvider";
import { sandboxMacro } from "@/data/sandboxData";
import { Card } from "@/components/ui/card";
import { STRATEGY_TIERS } from "@/data/strategyTiers";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format } from "date-fns";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Gauge,
  Landmark,
} from "lucide-react";

export default function MarketRegime() {
  const { isDemoMode } = useDemo();
  const { data, isLoading } = useQuery({
    queryKey: ["market-regime", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxMacro;
      const { data, error } = await supabase.functions.invoke(
        "generate-signals",
        {
          body: { mode: "macro" },
        },
      );
      if (error) throw error;
      return data.macro;
    },
    refetchInterval: isDemoMode ? false : 300000,
  });

  const getRegime = () => {
    if (!data) return { label: "LOADING", color: "bg-muted", icon: Activity };
    const { composite, vix } = data;
    if (vix.value > 25)
      return {
        label: "VOLATILE",
        color: "bg-orange-500",
        icon: Activity,
        description: "High uncertainty. Protection is priority.",
      };
    if (composite > 65)
      return {
        label: "BULL",
        color: "bg-bullish",
        icon: TrendingUp,
        description: "Conditions favor aggressive growth.",
      };
    if (composite < 35)
      return {
        label: "BEAR",
        color: "bg-bearish",
        icon: TrendingDown,
        description: "Defensive posturing recommended.",
      };
    return {
      label: "SIDEWAYS",
      color: "bg-watch",
      icon: Gauge,
      description: "Range-bound market. Focus on yield.",
    };
  };

  const regime = getRegime();
  const allStrategies = STRATEGY_TIERS.flatMap((t) => t.strategies);

  const getRegimeMultiplier = (type: string) => {
    const label = regime.label;
    if (label === "BULL") {
      if (type === "options") return 1.2;
      if (type === "equities") return 1.3;
      return 1.0;
    }
    if (label === "BEAR") {
      if (type === "options") return 0.9;
      if (type === "equities") return 0.7;
      if (type === "lending") return 1.1;
      return 1.0;
    }
    if (label === "VOLATILE") {
      if (type === "options") return 1.15;
      if (type === "equities") return 0.8;
      if (type === "lending") return 1.05;
      return 1.0;
    }
    if (label === "SIDEWAYS") {
      if (type === "options") return 1.05;
      if (type === "equities") return 0.9;
      if (type === "lending") return 1.05;
      return 1.0;
    }
    return 1.0;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h2 className="font-display text-2xl font-bold text-foreground">
          Market Regime Analysis
        </h2>

        {/* Top — Giant regime badge */}
        <Card className="border-border bg-card p-8">
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-6">
                <div
                  className={`flex h-20 w-20 items-center justify-center rounded-2xl ${regime.color} text-white shadow-lg`}
                >
                  <regime.icon size={40} />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <span className="font-display text-5xl font-black tracking-tighter">
                      {regime.label}
                    </span>
                    <span className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                      Current Regime
                    </span>
                  </div>
                  <p className="mt-2 text-lg text-muted-foreground">
                    {regime.description}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Last Updated
                </p>
                <p className="font-mono text-sm">
                  {data
                    ? format(new Date(data.updatedAt), "MMM dd, HH:mm:ss")
                    : "—"}
                </p>
              </div>
            </div>
          )}
        </Card>

        {/* Middle Row — 4 indicator cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <IndicatorCard
            label="Yield Curve"
            value={data?.yieldCurve.value.toFixed(2)}
            status={data?.yieldCurve.status}
            loading={isLoading}
            icon={Landmark}
          />
          <IndicatorCard
            label="VIX Proxy"
            value={data?.vix.value.toFixed(1)}
            status={data?.vix.label}
            loading={isLoading}
            icon={Activity}
          />
          <IndicatorCard
            label="Sector Momentum"
            value={`${data?.sector.value}%`}
            status={data?.sector.label}
            loading={isLoading}
            icon={TrendingUp}
          />
          <IndicatorCard
            label="Fed Environment"
            value={data?.fed.value}
            status={data?.fed.label}
            loading={isLoading}
            icon={Landmark}
          />
        </div>

        {/* Bottom — Strategy Impact table */}
        <Card className="border-border bg-card p-6">
          <h3 className="mb-6 font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Strategy Impact Analysis
          </h3>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="text-muted-foreground">
                    Strategy
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    Benchmark/mo
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    Regime-Adjusted
                  </TableHead>
                  <TableHead className="text-muted-foreground text-right">
                    Impact
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    Recommendation
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allStrategies.map((s, i) => {
                  const mult = getRegimeMultiplier(s.type);
                  const adjusted = s.avg_monthly_return * mult;
                  const impact = (mult - 1) * 100;

                  return (
                    <TableRow
                      key={i}
                      className="border-border hover:bg-accent/30 transition-fast"
                    >
                      <TableCell className="font-bold">{s.name}</TableCell>
                      <TableCell className="font-mono text-right">
                        {(s.avg_monthly_return * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell
                        className={`font-mono text-right font-bold ${mult > 1 ? "text-bullish" : mult < 1 ? "text-bearish" : ""}`}
                      >
                        {(adjusted * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell
                        className={`font-mono text-right text-xs ${impact > 0 ? "text-bullish" : impact < 0 ? "text-bearish" : ""}`}
                      >
                        {impact > 0 ? "+" : ""}
                        {impact.toFixed(0)}%
                      </TableCell>
                      <TableCell>
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            mult > 1.1
                              ? "bg-bullish/20 text-bullish border border-bullish/30"
                              : mult < 0.9
                                ? "bg-bearish/20 text-bearish border border-bearish/30"
                                : "bg-accent text-muted-foreground border border-border"
                          }`}
                        >
                          {mult > 1.1
                            ? "Overweight"
                            : mult < 0.9
                              ? "Underweight"
                              : "Neutral"}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function IndicatorCard({
  label,
  value,
  status,
  loading,
  icon: Icon,
}: {
  label: string;
  value?: string;
  status?: string;
  loading: boolean;
  icon: any;
}) {
  return (
    <Card className="border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          {label}
        </p>
        <Icon size={14} className="text-muted-foreground" />
      </div>
      {loading ? (
        <Skeleton className="h-10 w-full mt-1" />
      ) : (
        <>
          <p className="font-mono text-2xl font-bold text-foreground">
            {value || "—"}
          </p>
          <p
            className={`text-xs font-semibold mt-1 ${
              status?.toLowerCase().includes("bull") ||
              status?.toLowerCase() === "normal" ||
              status?.toLowerCase() === "low risk"
                ? "text-bullish"
                : status?.toLowerCase().includes("bear") ||
                    status?.toLowerCase() === "inverted" ||
                    status?.toLowerCase().includes("fear")
                  ? "text-bearish"
                  : "text-watch"
            }`}
          >
            {status || "—"}
          </p>
        </>
      )}
    </Card>
  );
}
