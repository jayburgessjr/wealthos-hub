import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Pin, PinOff } from "lucide-react";
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

  const [isPinned, setIsPinned] = useState(
    () => localStorage.getItem("sidebar-pinned") === "true"
  );
  const [isHovered, setIsHovered] = useState(false);

  const isOpen = isPinned || isHovered;

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
      <div className={`flex items-center px-3 pt-3 pb-1 ${isOpen ? "justify-end" : "justify-center"}`}>
        <button
          onClick={togglePin}
          title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
          className="rounded-md p-1 text-foreground/20 hover:text-foreground/50 transition-colors"
        >
          {isPinned
            ? <PinOff className="h-3 w-3" />
            : <Pin className="h-3 w-3" />
          }
        </button>
      </div>

      <nav className="flex flex-col gap-1 px-2 pb-4">
        {navSections.map((section) => {
          const visibleItems = section.items;

          return (
            <div key={section.label} className="mb-1">
              {/* Section label — hidden when collapsed */}
              <div className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-8 opacity-100" : "max-h-0 opacity-0"}`}>
                <span className="mb-0.5 block px-2 text-[9px] font-bold uppercase tracking-widest text-foreground/25">
                  {section.label}
                </span>
              </div>

              {visibleItems.map((item) => {
                const active = location.pathname === item.to;
                const isRestricted = item.adminOnly && !isAdmin;

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
                    <item.icon className={`h-[15px] w-[15px] shrink-0 ${isRestricted ? "opacity-30" : ""}`} />

                    {/* Label — slides in when open */}
                    <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                      isOpen ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                    }`}>
                      {item.label}
                    </span>

                    {isRestricted && isOpen && (
                      <ShieldAlert className="ml-auto h-3 w-3 shrink-0 opacity-30" />
                    )}
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
