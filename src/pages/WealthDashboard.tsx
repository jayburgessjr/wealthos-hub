import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  PiggyBank,
  Home,
  Umbrella,
  Network,
  Leaf,
  Shield,
  TrendingUp,
  Landmark,
  Package,
  ArrowRight,
  Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { StatCard } from "@/components/household/dashboard/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";

function fmt(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

export default function WealthDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const uid = user?.id;

  const { data: retirementAccounts = [], isLoading: loadingRetirement } =
    useQuery({
      queryKey: ["retirement_accounts", uid],
      enabled: !!uid,
      queryFn: async () => {
        const { data } = await supabase
          .from("retirement_accounts")
          .select("current_balance, account_name, account_type")
          .eq("user_id", uid);
        return data ?? [];
      },
    });

  const { data: properties = [], isLoading: loadingRE } = useQuery({
    queryKey: ["real_estate_properties", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("real_estate_properties")
        .select("current_value, mortgage_balance, address, property_type")
        .eq("user_id", uid);
      return data ?? [];
    },
  });

  const { data: dividends = [], isLoading: loadingDiv } = useQuery({
    queryKey: ["dividend_holdings", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("dividend_holdings")
        .select("shares, current_price, annual_dividend_per_share, ticker")
        .eq("user_id", uid);
      return data ?? [];
    },
  });

  const { data: policies = [], isLoading: loadingIns } = useQuery({
    queryKey: ["insurance_policies", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("insurance_policies")
        .select("coverage_amount, annual_premium, policy_type, provider")
        .eq("user_id", uid);
      return data ?? [];
    },
  });

  const { data: collectibles = [], isLoading: loadingCol } = useQuery({
    queryKey: ["collectibles", uid],
    enabled: !!uid,
    queryFn: async () => {
      const { data } = await supabase
        .from("collectibles")
        .select("current_value, name, category")
        .eq("user_id", uid);
      return data ?? [];
    },
  });

  const isLoading =
    loadingRetirement || loadingRE || loadingDiv || loadingIns || loadingCol;

  const kpis = useMemo(() => {
    const retirementTotal = retirementAccounts.reduce(
      (s, a) => s + (a.current_balance ?? 0),
      0,
    );

    const reValue = properties.reduce((s, p) => s + (p.current_value ?? 0), 0);
    const reMortgage = properties.reduce(
      (s, p) => s + (p.mortgage_balance ?? 0),
      0,
    );
    const reEquity = reValue - reMortgage;

    const divPortfolioValue = dividends.reduce(
      (s, h) => s + (h.current_price ?? 0) * (h.shares ?? 0),
      0,
    );
    const annualDividendIncome = dividends.reduce(
      (s, h) => s + (h.annual_dividend_per_share ?? 0) * (h.shares ?? 0),
      0,
    );

    const collectiblesValue = collectibles.reduce(
      (s, c) => s + (c.current_value ?? 0),
      0,
    );

    const totalCoverage = policies.reduce(
      (s, p) => s + (p.coverage_amount ?? 0),
      0,
    );
    const annualPremiums = policies.reduce(
      (s, p) => s + (p.annual_premium ?? 0),
      0,
    );

    const totalWealth =
      retirementTotal + reEquity + divPortfolioValue + collectiblesValue;

    return {
      totalWealth,
      retirementTotal,
      reEquity,
      reValue,
      divPortfolioValue,
      annualDividendIncome,
      collectiblesValue,
      totalCoverage,
      annualPremiums,
    };
  }, [retirementAccounts, properties, dividends, policies, collectibles]);

  const composition = useMemo(() => {
    const {
      totalWealth,
      retirementTotal,
      reEquity,
      divPortfolioValue,
      collectiblesValue,
    } = kpis;
    if (totalWealth === 0) return [];
    return [
      { label: "Retirement", value: retirementTotal, color: "bg-amber-400" },
      { label: "Real Estate", value: reEquity, color: "bg-blue-400" },
      { label: "Dividends", value: divPortfolioValue, color: "bg-emerald-400" },
      {
        label: "Collectibles",
        value: collectiblesValue,
        color: "bg-purple-400",
      },
    ]
      .filter((s) => s.value > 0)
      .map((s) => ({ ...s, pct: (s.value / totalWealth) * 100 }));
  }, [kpis]);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header */}
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/40">
            WEALTH COMMAND CENTER
          </p>
          <h1 className="text-[28px] font-bold leading-tight">
            <span className="text-foreground">Wealth </span>
            <span className="text-primary">Dashboard</span>
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your complete picture of long-term wealth — assets, protection, and
            growth.
          </p>
        </div>

        {/* KPI grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Total Net Worth"
              value={fmt(kpis.totalWealth)}
              description="All wealth assets combined"
              icon={<TrendingUp />}
              tone="success"
            />
            <StatCard
              title="Retirement"
              value={fmt(kpis.retirementTotal)}
              description={`${retirementAccounts.length} account${retirementAccounts.length !== 1 ? "s" : ""}`}
              icon={<PiggyBank />}
              tone="default"
            />
            <StatCard
              title="Real Estate Equity"
              value={fmt(kpis.reEquity)}
              description={`${fmt(kpis.reValue)} total value · ${properties.length} propert${properties.length !== 1 ? "ies" : "y"}`}
              icon={<Home />}
              tone="default"
            />
            <StatCard
              title="Dividend Portfolio"
              value={fmt(kpis.divPortfolioValue)}
              description={`${fmt(kpis.annualDividendIncome)}/yr income`}
              icon={<Leaf />}
              tone={kpis.annualDividendIncome > 0 ? "success" : "default"}
            />
            <StatCard
              title="Collectibles"
              value={fmt(kpis.collectiblesValue)}
              description={`${collectibles.length} item${collectibles.length !== 1 ? "s" : ""} tracked`}
              icon={<Package />}
              tone="default"
            />
            <StatCard
              title="Insurance Coverage"
              value={fmt(kpis.totalCoverage)}
              description={`${policies.length} polic${policies.length !== 1 ? "ies" : "y"}`}
              icon={<Shield />}
              tone="default"
            />
            <StatCard
              title="Annual Premiums"
              value={fmt(kpis.annualPremiums)}
              description="Total insurance cost/yr"
              icon={<Umbrella />}
              tone="default"
            />
            <StatCard
              title="Annual Dividends"
              value={fmt(kpis.annualDividendIncome)}
              description={`${dividends.length} holding${dividends.length !== 1 ? "s" : ""}`}
              icon={<Landmark />}
              tone={kpis.annualDividendIncome > 0 ? "info" : "default"}
            />
          </div>
        )}

        {/* Wealth composition bar */}
        {!isLoading && composition.length > 0 && (
          <div className="rounded-xl border border-border/20 bg-card px-5 py-4 space-y-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">
              Wealth Composition
            </p>
            <div className="flex h-2 w-full overflow-hidden rounded-full gap-0.5">
              {composition.map((s) => (
                <div
                  key={s.label}
                  className={`${s.color} rounded-full`}
                  style={{ width: `${s.pct}%` }}
                  title={`${s.label}: ${s.pct.toFixed(1)}%`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {composition.map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${s.color}`} />
                  <span className="text-[11px] text-muted-foreground">
                    {s.label}
                  </span>
                  <span className="text-[11px] font-medium text-foreground">
                    {s.pct.toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SectionCard
            label="LONG-TERM WEALTH"
            title="Long-term"
            icon={PiggyBank}
            accentColor="text-amber-400"
            borderColor="border-amber-400/20"
            bgColor="bg-amber-400/[0.04]"
            path="/wealth/long-term"
            stats={[
              {
                label: "Retirement Balance",
                value: fmt(kpis.retirementTotal),
              },
              {
                label: "Accounts",
                value: String(retirementAccounts.length),
              },
            ]}
            tabs={[
              { label: "Retirement", path: "/wealth/long-term/retirement" },
              {
                label: "Estate Planning",
                path: "/wealth/long-term/estate-planning",
              },
            ]}
            navigate={navigate}
            isLoading={isLoading}
          />

          <SectionCard
            label="WEALTH ASSETS"
            title="Assets"
            icon={Home}
            accentColor="text-blue-400"
            borderColor="border-blue-400/20"
            bgColor="bg-blue-400/[0.04]"
            path="/wealth/assets"
            stats={[
              { label: "Real Estate Equity", value: fmt(kpis.reEquity) },
              {
                label: "Dividend Income/yr",
                value: fmt(kpis.annualDividendIncome),
              },
            ]}
            tabs={[
              { label: "Real Estate", path: "/wealth/assets/real-estate" },
              { label: "Collectibles", path: "/wealth/assets/collectibles" },
              { label: "Dividends", path: "/wealth/assets/dividends" },
            ]}
            navigate={navigate}
            isLoading={isLoading}
          />

          <SectionCard
            label="PROTECTION & TAX"
            title="Protection"
            icon={Umbrella}
            accentColor="text-purple-400"
            borderColor="border-purple-400/20"
            bgColor="bg-purple-400/[0.04]"
            path="/wealth/protection"
            stats={[
              { label: "Total Coverage", value: fmt(kpis.totalCoverage) },
              { label: "Annual Premiums", value: fmt(kpis.annualPremiums) },
            ]}
            tabs={[
              { label: "Insurance", path: "/wealth/protection/insurance" },
              {
                label: "Tax Harvesting",
                path: "/wealth/protection/tax-harvesting",
              },
            ]}
            navigate={navigate}
            isLoading={isLoading}
          />

          <SectionCard
            label="BUSINESS & CAPITAL"
            title="Business"
            icon={Network}
            accentColor="text-emerald-400"
            borderColor="border-emerald-400/20"
            bgColor="bg-emerald-400/[0.04]"
            path="/wealth/business"
            stats={[
              { label: "Entity Structure", value: "Manage →" },
              { label: "Fundraising", value: "Plan →" },
            ]}
            tabs={[
              {
                label: "Entity Structure",
                path: "/wealth/business/entity-structure",
              },
              { label: "Fundraising", path: "/wealth/business/fundraising" },
            ]}
            navigate={navigate}
            isLoading={isLoading}
          />
        </div>
      </div>
    </DashboardLayout>
  );
}

interface SectionCardProps {
  label: string;
  title: string;
  icon: React.ElementType;
  accentColor: string;
  borderColor: string;
  bgColor: string;
  path: string;
  stats: { label: string; value: string }[];
  tabs: { label: string; path: string }[];
  navigate: (path: string) => void;
  isLoading: boolean;
}

function SectionCard({
  label,
  title,
  icon: Icon,
  accentColor,
  borderColor,
  bgColor,
  path,
  stats,
  tabs,
  navigate,
  isLoading,
}: SectionCardProps) {
  return (
    <div
      className={`rounded-xl border ${borderColor} ${bgColor} p-5 cursor-pointer hover:bg-opacity-80 transition-all duration-150 group`}
      onClick={() => navigate(path)}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-foreground/[0.04]">
            <Icon className={`h-5 w-5 ${accentColor}`} />
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">
              {label}
            </p>
            <p className="text-[15px] font-semibold text-foreground leading-tight">
              {title}
            </p>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors mt-1" />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {isLoading
          ? stats.map((s) => (
              <Skeleton key={s.label} className="h-10 rounded-lg" />
            ))
          : stats.map((s) => (
              <div key={s.label}>
                <p className="text-[10px] uppercase tracking-[0.1em] text-muted-foreground/50 mb-0.5">
                  {s.label}
                </p>
                <p className="text-[16px] font-bold text-foreground leading-tight">
                  {s.value}
                </p>
              </div>
            ))}
      </div>

      {/* Tab pills */}
      <div className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab.path}
            onClick={(e) => {
              e.stopPropagation();
              navigate(tab.path);
            }}
            className="rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] px-3 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}
