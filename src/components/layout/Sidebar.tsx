import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Pin, PinOff } from "lucide-react";
import {
  LayoutDashboard,
  Radar,
  Briefcase,
  Zap,
  PieChart,
  ShieldAlert,
  Bot,
  Globe,
  BarChart3,
  Eye,
  ShieldCheck,
  FileText,
  Bitcoin,
  Newspaper,
  Cpu,
  Brain,
  CalendarDays,
  BookOpen,
  Calculator,
  Map,
  FlaskConical,
  Leaf,
  Crosshair,
  Bell,
  ScanSearch,
  CandlestickChart,
  Workflow,
  Users,
  Landmark,
  BookMarked,
  DollarSign,
  Wheat,
  LineChart,
  Vote,
  Activity,
  Trophy,
  Ticket,
  Rss,
  Layers,
  Building2,
  GitMerge,
  CreditCard,
  PiggyBank,
  Wallet,
  Repeat,
  Home,
  Package,
  BarChart2,
  Network,
  Scale,
  HandCoins,
  Flame,
  Rocket,
  TrendingUp,
  Infinity,
  Umbrella,
  ScrollText,
  CircleDot,
  CalendarRange,
  Target,
  Receipt,
  CalendarCheck,
  ListTodo,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

const WEALTH_ROUTES = new Set([
  "/retirement",
  "/dividend-tracker",
  "/real-estate",
  "/collectibles",
  "/insurance",
  "/tax-harvesting",
  "/estate-planning",
  "/entity-structure",
  "/fundraising",
]);

const navSections = [
  {
    label: "1 · Orient",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/alerts", icon: Bell, label: "Alert Engine" },
    ],
  },
  {
    label: "2 · Read the Market",
    items: [
      { to: "/markets", icon: Globe, label: "Markets Overview" },
      { to: "/macro", icon: TrendingUp, label: "Macro" },
      { to: "/market-regime", icon: Activity, label: "Market Regime" },
      { to: "/financial-news", icon: Rss, label: "News Feed" },
      { to: "/news", icon: Newspaper, label: "Market Intel" },
    ],
  },
  {
    label: "3 · Discover",
    items: [
      { to: "/signals", icon: Radar, label: "Signals" },
      { to: "/heat-map", icon: Map, label: "Heat Map" },
      { to: "/options-flow", icon: Flame, label: "Options Flow" },
      {
        to: "/earnings-calendar",
        icon: CalendarDays,
        label: "Earnings Calendar",
      },
      { to: "/ipo-tracker", icon: Rocket, label: "IPO Tracker" },
      { to: "/insider-activity", icon: Landmark, label: "Insider Activity" },
    ],
  },
  {
    label: "4 · Go Deep",
    items: [
      { to: "/crypto", icon: Bitcoin, label: "Crypto" },
      { to: "/forex", icon: DollarSign, label: "Forex" },
      { to: "/commodities", icon: Wheat, label: "Commodities" },
      { to: "/fixed-income", icon: LineChart, label: "Fixed Income" },
      { to: "/private-equity", icon: Building2, label: "Private Equity" },
      { to: "/mergers-acquisitions", icon: GitMerge, label: "M&A" },
    ],
  },
  {
    label: "5 · Research",
    items: [
      { to: "/chart", icon: CandlestickChart, label: "Chart" },
      { to: "/screener", icon: ScanSearch, label: "Asset Screener" },
      { to: "/watchlist", icon: Eye, label: "Watchlist" },
    ],
  },
  {
    label: "6 · Decide",
    items: [
      { to: "/decisions", icon: Zap, label: "Decision Hub" },
      { to: "/ai-advisor", icon: Bot, label: "Trading AI" },
      { to: "/financial-advisor", icon: Brain, label: "Wealth AI" },
      { to: "/strategy-123", icon: Crosshair, label: "1-2-3 Strategy" },
      {
        to: "/strategy-allocator",
        icon: PieChart,
        label: "Strategy Allocator",
      },
      { to: "/position-sizer", icon: Calculator, label: "Position Sizer" },
    ],
  },
  {
    label: "7 · Execute",
    items: [
      { to: "/paper-trading", icon: FlaskConical, label: "Paper Trading" },
      { to: "/positions", icon: Briefcase, label: "Positions" },
      { to: "/my-portfolio", icon: Layers, label: "My Portfolio" },
    ],
  },
  {
    label: "8 · Automate",
    items: [{ to: "/bots", icon: Workflow, label: "Trading Bots" }],
  },
  {
    label: "9 · Review",
    items: [
      { to: "/trading-journal", icon: BookOpen, label: "Trading Journal" },
      { to: "/performance", icon: BarChart3, label: "Performance" },
      { to: "/pnl-calendar", icon: BarChart2, label: "P&L Calendar" },
      { to: "/weekly-briefing", icon: CalendarRange, label: "Weekly Briefing" },
      { to: "/playbook", icon: BookMarked, label: "The Playbook" },
      { to: "/documents", icon: FileText, label: "Documents" },
    ],
  },
  {
    label: "AI Engines",
    items: [
      { to: "/compound", icon: Infinity, label: "Compound Engine" },
      { to: "/quantum", icon: Cpu, label: "Quantum Engine" },
    ],
  },
  {
    label: "Prediction Markets",
    items: [
      { to: "/kalshi", icon: Vote, label: "Kalshi" },
      { to: "/polymarket", icon: CircleDot, label: "Polymarket" },
      { to: "/sports-trading", icon: Trophy, label: "Sports Trading" },
      { to: "/lottery-ev", icon: Ticket, label: "Lottery / EV" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/security", icon: ShieldAlert, label: "Security & Audit" },
      { to: "/community", icon: Users, label: "Community" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/admin", icon: ShieldCheck, label: "Admin Hub", adminOnly: true },
    ],
  },
];

const wealthNavSections = [
  {
    label: "Long-term",
    items: [
      { to: "/retirement", icon: PiggyBank, label: "Retirement" },
      { to: "/estate-planning", icon: ScrollText, label: "Estate Planning" },
    ],
  },
  {
    label: "Assets",
    items: [
      { to: "/real-estate", icon: Home, label: "Real Estate" },
      { to: "/collectibles", icon: Package, label: "Collectibles" },
      { to: "/dividend-tracker", icon: Repeat, label: "Dividends" },
    ],
  },
  {
    label: "Protection & Tax",
    items: [
      { to: "/insurance", icon: Umbrella, label: "Insurance" },
      { to: "/tax-harvesting", icon: Leaf, label: "Tax Harvesting" },
    ],
  },
  {
    label: "Business",
    items: [
      { to: "/entity-structure", icon: Network, label: "Entity Structure" },
      { to: "/fundraising", icon: HandCoins, label: "Fundraising" },
    ],
  },
];

const householdNavSections = [
  {
    label: "Home",
    items: [
      { to: "/household", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/household/command-center", icon: Home, label: "Command Center" },
    ],
  },
  {
    label: "Money In",
    items: [
      { to: "/household/income", icon: DollarSign, label: "Income" },
      {
        to: "/household/bank-accounts",
        icon: Landmark,
        label: "Bank Accounts",
      },
    ],
  },
  {
    label: "Money Out",
    items: [
      { to: "/household/budget", icon: Wallet, label: "Budget & Expenses" },
      { to: "/household/bills", icon: Receipt, label: "Bills" },
      { to: "/household/subscriptions", icon: Repeat, label: "Subscriptions" },
      { to: "/household/debts", icon: CreditCard, label: "Debts" },
    ],
  },
  {
    label: "Future",
    items: [
      { to: "/household/goals", icon: Target, label: "Goals" },
      { to: "/household/net-worth", icon: Scale, label: "Net Worth" },
      { to: "/household/simulator", icon: FlaskConical, label: "Simulator" },
    ],
  },
  {
    label: "Insights",
    items: [
      { to: "/household/ai-assistant", icon: Bot, label: "AI Assistant" },
      { to: "/household/cfo-reports", icon: BarChart3, label: "CFO Reports" },
      {
        to: "/household/weekly-meeting",
        icon: CalendarCheck,
        label: "Weekly Meeting",
      },
      {
        to: "/household/monthly-closeout",
        icon: CalendarRange,
        label: "Monthly Closeout",
      },
      {
        to: "/household/quarterly-review",
        icon: CalendarDays,
        label: "Quarterly Review",
      },
    ],
  },
  {
    label: "Life",
    items: [
      { to: "/household/careers", icon: Briefcase, label: "Career Profiles" },
      { to: "/household/vision", icon: Eye, label: "Vision Board" },
      { to: "/household/tasks", icon: ListTodo, label: "Tasks" },
    ],
  },
  {
    label: "Household",
    items: [
      { to: "/household/settings", icon: ShieldAlert, label: "Settings" },
      { to: "/household/members", icon: Users, label: "Members & Invites" },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { isAdmin } = useSubscription();

  const [isPinned, setIsPinned] = useState(
    () => localStorage.getItem("sidebar-pinned") === "true",
  );
  const [isHovered, setIsHovered] = useState(false);

  const isOpen = isPinned || isHovered;

  const isHousehold = location.pathname.startsWith("/household");
  const isWealth = WEALTH_ROUTES.has(location.pathname);

  const sections = isHousehold
    ? householdNavSections
    : isWealth
      ? wealthNavSections
      : navSections;

  const sectionLabelColor = isHousehold
    ? "text-emerald-500/70"
    : isWealth
      ? "text-amber-500/70"
      : "text-foreground/25";

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    localStorage.setItem("sidebar-pinned", String(next));
  };

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`hidden shrink-0 lg:flex lg:flex-col overflow-y-auto overflow-x-hidden transition-all duration-200 ease-in-out
        sidebar-scroll border-r border-black/[0.06] dark:border-white/[0.06]
        bg-[#f2f2f2] dark:bg-[#111111]
        ${isOpen ? "w-[220px]" : "w-[52px]"}`}
    >
      {/* Pin toggle */}
      <div
        className={`flex items-center px-3 pt-3 pb-2 ${isOpen ? "justify-end" : "justify-center"}`}
      >
        <button
          onClick={togglePin}
          title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
          className="rounded-md p-1 text-foreground/20 hover:text-foreground/50 transition-colors"
        >
          {isPinned ? (
            <PinOff className="h-3 w-3" />
          ) : (
            <Pin className="h-3 w-3" />
          )}
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-2 pb-4">
        {sections.map((section) => (
          <div key={section.label} className="mb-1">
            {/* Section label — hidden when collapsed */}
            <div
              className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-8 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <span
                className={`mb-0.5 block px-2 text-[9px] font-bold uppercase tracking-widest ${sectionLabelColor}`}
              >
                {section.label}
              </span>
            </div>

            {section.items.map((item) => {
              const active = location.pathname === item.to;
              const isRestricted = (item as any).adminOnly && !isAdmin;

              return (
                <RouterNavLink
                  key={item.to + item.label}
                  to={isRestricted ? "#" : item.to}
                  title={!isOpen ? item.label : undefined}
                  onClick={(e) => {
                    if (isRestricted) {
                      e.preventDefault();
                      toast.error("Admin permissions required");
                    }
                  }}
                  className={`flex items-center rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors duration-100 ${
                    isOpen ? "gap-2.5" : "justify-center"
                  } ${
                    active
                      ? "bg-foreground/[0.08] text-foreground"
                      : isRestricted
                        ? "text-foreground/20 cursor-not-allowed"
                        : "text-foreground/40 hover:bg-foreground/[0.05] hover:text-foreground/80"
                  }`}
                >
                  <item.icon
                    className={`h-[15px] w-[15px] shrink-0 ${isRestricted ? "opacity-30" : ""}`}
                  />
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                      isOpen ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                    }`}
                  >
                    {item.label}
                  </span>
                  {isRestricted && isOpen && (
                    <ShieldAlert className="ml-auto h-3 w-3 shrink-0 opacity-30" />
                  )}
                </RouterNavLink>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
