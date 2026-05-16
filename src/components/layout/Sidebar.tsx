import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Radar, Briefcase, Zap, PieChart, ShieldAlert,
  Bot, Globe, BarChart3, Eye, ShieldCheck, FileText,
  Bitcoin, Newspaper, Cpu, Brain,
  CalendarDays, BookOpen, Calculator, Map, FlaskConical, Leaf, Crosshair,
  Bell, ScanSearch, CandlestickChart, Workflow, Users, Landmark, BookMarked,
  DollarSign, Wheat, LineChart, Vote, Activity, Trophy, Ticket, Rss, Layers,
  Building2, GitMerge, CreditCard, PiggyBank, Wallet, Repeat,
  Home, Package, BarChart2, Network, Scale, HandCoins, Flame,
  Rocket, TrendingUp, Infinity, Umbrella, ScrollText, CircleDot, CalendarRange,
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { toast } from "sonner";

const navSections = [
  {
    label: "Daily",
    items: [
      { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
      { to: "/decisions",  icon: Zap,             label: "Decision Hub" },
      { to: "/signals",    icon: Radar,           label: "Signals" },
      { to: "/alerts",     icon: Bell,            label: "Alert Engine" },
    ],
  },
  {
    label: "Portfolio",
    items: [
      { to: "/my-portfolio", icon: Layers,   label: "My Portfolio" },
      { to: "/positions",    icon: Briefcase, label: "Positions" },
      { to: "/watchlist",    icon: Eye,       label: "Watchlist" },
      { to: "/performance",  icon: BarChart3, label: "Performance" },
    ],
  },
  {
    label: "Trade",
    items: [
      { to: "/chart",          icon: CandlestickChart, label: "Chart" },
      { to: "/screener",       icon: ScanSearch,       label: "Asset Screener" },
      { to: "/paper-trading",  icon: FlaskConical,     label: "Paper Trading" },
      { to: "/position-sizer", icon: Calculator,       label: "Position Sizer" },
      { to: "/trading-journal",icon: BookOpen,         label: "Trading Journal" },
      { to: "/bots",           icon: Workflow,         label: "Trading Bots" },
    ],
  },
  {
    label: "Markets",
    items: [
      { to: "/markets",               icon: Globe,           label: "Overview" },
      { to: "/crypto",                icon: Bitcoin,         label: "Crypto" },
      { to: "/forex",                 icon: DollarSign,      label: "Forex" },
      { to: "/commodities",           icon: Wheat,           label: "Commodities" },
      { to: "/fixed-income",          icon: LineChart,       label: "Fixed Income" },
      { to: "/private-equity",        icon: Building2,       label: "Private Equity" },
      { to: "/mergers-acquisitions",  icon: GitMerge,        label: "M&A" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/financial-news",   icon: Rss,          label: "News Feed" },
      { to: "/news",             icon: Newspaper,    label: "Market Intel" },
      { to: "/macro",            icon: TrendingUp,   label: "Macro" },
      { to: "/market-regime",    icon: Activity,     label: "Market Regime" },
      { to: "/options-flow",     icon: Flame,        label: "Options Flow" },
      { to: "/ipo-tracker",      icon: Rocket,       label: "IPO Tracker" },
      { to: "/insider-activity", icon: Landmark,     label: "Insider Activity" },
      { to: "/earnings-calendar",icon: CalendarDays, label: "Earnings Calendar" },
      { to: "/heat-map",         icon: Map,          label: "Heat Map" },
    ],
  },
  {
    label: "Prediction Markets",
    items: [
      { to: "/kalshi",         icon: Vote,       label: "Kalshi" },
      { to: "/polymarket",     icon: CircleDot,  label: "Polymarket" },
      { to: "/sports-trading", icon: Trophy,     label: "Sports Trading" },
      { to: "/lottery-ev",     icon: Ticket,     label: "Lottery / EV" },
    ],
  },
  {
    label: "AI",
    items: [
      { to: "/ai-advisor",        icon: Bot,      label: "Trading AI" },
      { to: "/financial-advisor", icon: Brain,    label: "Wealth AI" },
      { to: "/compound",          icon: Infinity, label: "Compound Engine" },
      { to: "/strategy-allocator",icon: PieChart, label: "Strategy Allocator" },
      { to: "/quantum",           icon: Cpu,      label: "Quantum Engine" },
      { to: "/strategy-123",      icon: Crosshair,label: "1-2-3 Strategy" },
    ],
  },
  {
    label: "Wealth Planning",
    items: [
      { to: "/net-worth",         icon: Scale,      label: "Net Worth" },
      { to: "/cash-flow-planner", icon: Wallet,     label: "Cash Flow" },
      { to: "/debt-manager",      icon: CreditCard, label: "Debt Manager" },
      { to: "/retirement",        icon: PiggyBank,  label: "Retirement" },
      { to: "/dividend-tracker",  icon: Repeat,     label: "Dividends" },
      { to: "/real-estate",       icon: Home,       label: "Real Estate" },
      { to: "/collectibles",      icon: Package,    label: "Collectibles" },
      { to: "/insurance",         icon: Umbrella,   label: "Insurance" },
      { to: "/tax-harvesting",    icon: Leaf,       label: "Tax Harvesting" },
      { to: "/estate-planning",   icon: ScrollText, label: "Estate Planning" },
    ],
  },
  {
    label: "Business",
    items: [
      { to: "/entity-structure", icon: Network,    label: "Entity Structure" },
      { to: "/fundraising",      icon: HandCoins,  label: "Fundraising" },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/pnl-calendar",    icon: BarChart2,     label: "P&L Calendar" },
      { to: "/playbook",        icon: BookMarked,    label: "The Playbook" },
      { to: "/weekly-briefing", icon: CalendarRange, label: "Weekly Briefing" },
      { to: "/documents",       icon: FileText,      label: "Documents" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/security", icon: ShieldAlert, label: "Security & Audit" },
      { to: "/community",icon: Users,       label: "Community" },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/admin", icon: ShieldCheck, label: "Admin Hub", adminOnly: true },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { isAdmin } = useSubscription();

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-border bg-background lg:flex lg:flex-col overflow-y-auto">
      <nav className="flex flex-col gap-1 p-3">
        {navSections.map((section) => {
          const visibleItems = section.items;

          return (
            <div key={section.label} className="mb-2">
              <span className="mb-1 block px-3 font-body text-[10px] font-semibold uppercase tracking-widest text-bullish/50">
                {section.label}
              </span>
              {visibleItems.map((item) => {
                const active = location.pathname === item.to;
                const isRestricted = item.adminOnly && !isAdmin;

                return (
                  <RouterNavLink
                    key={item.to + item.label}
                    to={isRestricted ? "#" : item.to}
                    onClick={(e) => {
                      if (isRestricted) {
                        e.preventDefault();
                        toast.error("Admin permissions required");
                      }
                    }}
                    className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-fast ${
                      active
                        ? "bg-bullish/10 text-bullish"
                        : isRestricted
                        ? "text-muted-foreground/30 cursor-not-allowed"
                        : "text-muted-foreground hover:bg-bullish/5 hover:text-bullish"
                    }`}
                  >
                    <item.icon className={`h-4 w-4 ${isRestricted ? "opacity-20" : ""}`} />
                    {item.label}
                    {isRestricted && <ShieldAlert className="ml-auto h-3 w-3 opacity-50" />}
                  </RouterNavLink>
                );
              })}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
