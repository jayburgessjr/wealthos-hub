import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

type Tab = { label: string; path: string };

const TAB_GROUPS: Record<
  string,
  { sectionLabel: string; title: string; subtitle: string; tabs: Tab[] }
> = {
  market: {
    sectionLabel: "MARKET INTELLIGENCE",
    title: "Market",
    subtitle: "Real-time market data, macro signals, and regime analysis",
    tabs: [
      { label: "Overview", path: "/invs/market" },
      { label: "Macro", path: "/invs/market/macro" },
      { label: "Regime", path: "/invs/market/regime" },
    ],
  },
  discover: {
    sectionLabel: "SIGNAL DISCOVERY",
    title: "Discover",
    subtitle: "Surface opportunities across signals, flows, and events",
    tabs: [
      { label: "Signals", path: "/invs/discover" },
      { label: "Heat Map", path: "/invs/discover/heat-map" },
      { label: "Options Flow", path: "/invs/discover/options-flow" },
      { label: "Earnings", path: "/invs/discover/earnings" },
      { label: "IPO Tracker", path: "/invs/discover/ipo" },
      { label: "Insider", path: "/invs/discover/insider" },
    ],
  },
  assets: {
    sectionLabel: "ASSET CLASSES",
    title: "Assets",
    subtitle:
      "Deep-dive into crypto, forex, commodities, and alternative classes",
    tabs: [
      { label: "Crypto", path: "/invs/assets" },
      { label: "Forex", path: "/invs/assets/forex" },
      { label: "Commodities", path: "/invs/assets/commodities" },
      { label: "Fixed Income", path: "/invs/assets/fixed-income" },
      { label: "Private Equity", path: "/invs/assets/private-equity" },
      { label: "M&A", path: "/invs/assets/ma" },
    ],
  },
  strategy: {
    sectionLabel: "STRATEGY & WEALTH",
    title: "Strategy",
    subtitle: "AI-powered allocation, position sizing, and wealth frameworks",
    tabs: [
      { label: "Wealth AI", path: "/invs/strategy" },
      { label: "1-2-3 Strategy", path: "/invs/strategy/123" },
      { label: "Allocator", path: "/invs/strategy/allocator" },
      { label: "Position Sizer", path: "/invs/strategy/sizer" },
    ],
  },
  execute: {
    sectionLabel: "EXECUTION",
    title: "Execute",
    subtitle: "Manage live positions, portfolio exposure, and paper trades",
    tabs: [
      { label: "Positions", path: "/invs/execute" },
      { label: "Portfolio", path: "/invs/execute/portfolio" },
      { label: "Paper Trading", path: "/invs/execute/paper" },
    ],
  },
  review: {
    sectionLabel: "REVIEW & ANALYSIS",
    title: "Review",
    subtitle: "Journal trades, track performance, and refine your playbook",
    tabs: [
      { label: "Journal", path: "/invs/review" },
      { label: "Performance", path: "/invs/review/performance" },
      { label: "P&L", path: "/invs/review/pnl" },
      { label: "Weekly Briefing", path: "/invs/review/briefing" },
      { label: "Playbook", path: "/invs/review/playbook" },
    ],
  },
  "ai-engines": {
    sectionLabel: "AI ENGINES",
    title: "AI",
    subtitle: "Algorithmic engines for compound growth and quantum strategies",
    tabs: [
      { label: "Compound Engine", path: "/invs/ai-engines" },
      { label: "Quantum Engine", path: "/invs/ai-engines/quantum" },
    ],
  },
  "prediction-markets": {
    sectionLabel: "PREDICTION MARKETS",
    title: "Prediction",
    subtitle:
      "Trade prediction markets across finance, sports, and live events",
    tabs: [
      { label: "Kalshi", path: "/invs/prediction-markets" },
      { label: "Polymarket", path: "/invs/prediction-markets/polymarket" },
      { label: "Sports", path: "/invs/prediction-markets/sports" },
      { label: "Lottery / EV", path: "/invs/prediction-markets/lottery" },
    ],
  },

  // ── Household groups ───────────────────────────────────────────────────
  "household-money-in": {
    sectionLabel: "HOUSEHOLD FINANCE",
    title: "Money",
    subtitle: "Track income sources and manage your bank accounts",
    tabs: [
      { label: "Income", path: "/household/money-in/income" },
      { label: "Bank Accounts", path: "/household/money-in/bank-accounts" },
    ],
  },
  "household-money-out": {
    sectionLabel: "HOUSEHOLD FINANCE",
    title: "Money",
    subtitle: "Budget, bills, subscriptions, and debt obligations",
    tabs: [
      { label: "Budget & Expenses", path: "/household/money-out/budget" },
      { label: "Bills", path: "/household/money-out/bills" },
      { label: "Subscriptions", path: "/household/money-out/subscriptions" },
      { label: "Debts", path: "/household/money-out/debts" },
    ],
  },
  "household-future": {
    sectionLabel: "FINANCIAL FUTURE",
    title: "Future",
    subtitle: "Set goals, track net worth, and run financial simulations",
    tabs: [
      { label: "Goals", path: "/household/future/goals" },
      { label: "Net Worth", path: "/household/future/net-worth" },
      { label: "Simulator", path: "/household/future/simulator" },
    ],
  },
  "household-insights": {
    sectionLabel: "HOUSEHOLD INSIGHTS",
    title: "Insights",
    subtitle: "AI analysis, CFO reports, and periodic financial reviews",
    tabs: [
      { label: "AI Assistant", path: "/household/insights/ai-assistant" },
      { label: "CFO Reports", path: "/household/insights/cfo-reports" },
      { label: "Weekly Meeting", path: "/household/insights/weekly-meeting" },
      {
        label: "Monthly Closeout",
        path: "/household/insights/monthly-closeout",
      },
      {
        label: "Quarterly Review",
        path: "/household/insights/quarterly-review",
      },
    ],
  },
  "household-life": {
    sectionLabel: "LIFE & CAREER",
    title: "Life",
    subtitle: "Careers, vision board, and household task management",
    tabs: [
      { label: "Career Profiles", path: "/household/life/careers" },
      { label: "Vision Board", path: "/household/life/vision" },
      { label: "Tasks", path: "/household/life/tasks" },
    ],
  },
  "household-manage": {
    sectionLabel: "HOUSEHOLD MANAGEMENT",
    title: "Household",
    subtitle: "Settings, members, and household configuration",
    tabs: [
      { label: "Settings", path: "/household/manage/settings" },
      { label: "Members & Invites", path: "/household/manage/members" },
    ],
  },

  // ── Wealth groups ──────────────────────────────────────────────────────
  "wealth-long-term": {
    sectionLabel: "LONG-TERM WEALTH",
    title: "Long-term",
    subtitle:
      "Plan for retirement, preserve your estate, and secure your legacy",
    tabs: [
      { label: "Retirement", path: "/wealth/long-term/retirement" },
      { label: "Estate Planning", path: "/wealth/long-term/estate-planning" },
    ],
  },
  "wealth-assets": {
    sectionLabel: "WEALTH ASSETS",
    title: "Assets",
    subtitle:
      "Track real estate, collectibles, and dividend-generating investments",
    tabs: [
      { label: "Real Estate", path: "/wealth/assets/real-estate" },
      { label: "Collectibles", path: "/wealth/assets/collectibles" },
      { label: "Dividends", path: "/wealth/assets/dividends" },
    ],
  },
  "wealth-protection": {
    sectionLabel: "PROTECTION & TAX",
    title: "Protection",
    subtitle: "Manage insurance coverage and optimize your tax efficiency",
    tabs: [
      { label: "Insurance", path: "/wealth/protection/insurance" },
      { label: "Tax Harvesting", path: "/wealth/protection/tax-harvesting" },
    ],
  },
  "wealth-business": {
    sectionLabel: "BUSINESS & CAPITAL",
    title: "Business",
    subtitle: "Structure your entities and plan your fundraising strategy",
    tabs: [
      {
        label: "Entity Structure",
        path: "/wealth/business/entity-structure",
      },
      { label: "Fundraising", path: "/wealth/business/fundraising" },
    ],
  },
};

interface TabNavProps {
  group: keyof typeof TAB_GROUPS;
}

export default function TabNav({ group }: TabNavProps) {
  const location = useLocation();
  const config = TAB_GROUPS[group];
  if (!config) return null;

  const activeTab =
    config.tabs.find((t) => location.pathname === t.path) ?? config.tabs[0];

  return (
    <div className="mb-6">
      {/* Section label */}
      <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground/40">
        {config.sectionLabel}
      </p>

      {/* Two-tone heading */}
      <h1 className="text-[28px] font-bold leading-tight">
        <span className="text-foreground">{config.title} </span>
        <span className="text-primary">{activeTab.label}</span>
      </h1>

      {/* Subtitle */}
      <p className="mt-1 mb-5 text-sm text-muted-foreground">
        {config.subtitle}
      </p>

      {/* Pill tab bar */}
      <div className="inline-flex items-center rounded-full bg-foreground/[0.06] p-1 gap-0.5 overflow-x-auto scrollbar-none">
        {config.tabs.map((tab) => {
          const isActive = location.pathname === tab.path;
          return (
            <Link
              key={tab.path}
              to={tab.path}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground/80",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
