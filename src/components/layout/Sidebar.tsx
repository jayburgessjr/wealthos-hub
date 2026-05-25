import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Pin, PinOff, Search, ShieldAlert } from "lucide-react";
import {
  LayoutDashboard,
  Radar,
  Briefcase,
  Zap,
  PieChart,
  ShieldCheck,
  Bot,
  Globe,
  BarChart3,
  Eye,
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
import AjeLogo from "@/components/AjeLogo";
import { useAuth } from "@/components/AuthProvider";

const navSections = [
  {
    label: "Orient",
    items: [
      { to: "/invs/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/invs/alerts", icon: Bell, label: "Alerts" },
    ],
  },
  {
    label: "Market",
    items: [
      { to: "/invs/market", icon: Globe, label: "Market", tabbed: true },
      { to: "/invs/news", icon: Newspaper, label: "News" },
    ],
  },
  {
    label: "Discover",
    items: [
      { to: "/invs/discover", icon: Radar, label: "Discover", tabbed: true },
    ],
  },
  {
    label: "Research",
    items: [
      { to: "/invs/chart", icon: CandlestickChart, label: "Chart" },
      { to: "/invs/screener", icon: ScanSearch, label: "Screener" },
      { to: "/invs/watchlist", icon: Eye, label: "Watchlist" },
    ],
  },
  {
    label: "Decide",
    items: [
      { to: "/invs/decisions", icon: Zap, label: "Decision Hub" },
      { to: "/invs/trading-ai", icon: Bot, label: "Trading AI" },
      {
        to: "/invs/strategy",
        icon: Brain,
        label: "Strategy & Wealth",
        tabbed: true,
      },
    ],
  },
  {
    label: "Assets",
    items: [
      { to: "/invs/assets", icon: Bitcoin, label: "Assets", tabbed: true },
    ],
  },
  {
    label: "Execute",
    items: [
      { to: "/invs/execute", icon: Briefcase, label: "Execute", tabbed: true },
      { to: "/invs/bots", icon: Workflow, label: "Trading Bots" },
    ],
  },
  {
    label: "Review",
    items: [
      { to: "/invs/review", icon: BookOpen, label: "Review", tabbed: true },
      { to: "/invs/documents", icon: FileText, label: "Documents" },
    ],
  },
  {
    label: "Engines",
    items: [
      {
        to: "/invs/ai-engines",
        icon: Infinity,
        label: "AI Engines",
        tabbed: true,
      },
      {
        to: "/invs/prediction-markets",
        icon: Vote,
        label: "Prediction Markets",
        tabbed: true,
      },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/invs/security", icon: ShieldAlert, label: "Security & Audit" },
      { to: "/invs/community", icon: Users, label: "Community" },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        to: "/invs/admin",
        icon: ShieldCheck,
        label: "Admin Hub",
        adminOnly: true,
      },
    ],
  },
];

const wealthNavSections = [
  {
    label: "Overview",
    items: [{ to: "/wealth", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Long-term",
    items: [
      {
        to: "/wealth/long-term",
        icon: PiggyBank,
        label: "Long-term",
        tabbed: true,
      },
    ],
  },
  {
    label: "Assets",
    items: [
      {
        to: "/wealth/assets",
        icon: Home,
        label: "Assets",
        tabbed: true,
      },
    ],
  },
  {
    label: "Protection & Tax",
    items: [
      {
        to: "/wealth/protection",
        icon: Umbrella,
        label: "Protection",
        tabbed: true,
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        to: "/wealth/business",
        icon: Network,
        label: "Business",
        tabbed: true,
      },
    ],
  },
];

const householdNavSections = [
  {
    label: "Home",
    items: [{ to: "/household", icon: LayoutDashboard, label: "Dashboard" }],
  },
  {
    label: "Money In",
    items: [
      {
        to: "/household/money-in",
        icon: DollarSign,
        label: "Money In",
        tabbed: true,
      },
    ],
  },
  {
    label: "Money Out",
    items: [
      {
        to: "/household/money-out",
        icon: Wallet,
        label: "Money Out",
        tabbed: true,
      },
    ],
  },
  {
    label: "Future",
    items: [
      { to: "/household/future", icon: Target, label: "Future", tabbed: true },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        to: "/household/insights",
        icon: Brain,
        label: "Insights",
        tabbed: true,
      },
    ],
  },
  {
    label: "Life",
    items: [
      { to: "/household/life", icon: Rocket, label: "Life", tabbed: true },
    ],
  },
  {
    label: "Manage",
    items: [
      {
        to: "/household/manage",
        icon: ShieldAlert,
        label: "Household",
        tabbed: true,
      },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();
  const { isAdmin } = useSubscription();
  const { user } = useAuth();

  const [isPinned, setIsPinned] = useState(
    () => localStorage.getItem("sidebar-pinned") === "true",
  );
  const [isHovered, setIsHovered] = useState(false);

  const isOpen = isPinned || isHovered;

  const isHousehold = location.pathname.startsWith("/household");
  const isWealth = location.pathname.startsWith("/wealth");

  const sections = isHousehold
    ? householdNavSections
    : isWealth
      ? wealthNavSections
      : navSections;

  const sectionLabelColor = isHousehold
    ? "text-emerald-500/50"
    : isWealth
      ? "text-amber-500/50"
      : "text-foreground/20";

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    localStorage.setItem("sidebar-pinned", String(next));
  };

  const avatarInitials = user?.email?.substring(0, 2).toUpperCase() ?? "??";

  return (
    <aside
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`hidden shrink-0 lg:flex lg:flex-col overflow-hidden transition-all duration-200 ease-in-out
        border-r border-black/[0.06] dark:border-white/[0.06]
        bg-[#f4f4f5] dark:bg-[#111111]
        ${isOpen ? "w-[240px]" : "w-[52px]"}`}
    >
      {/* Header */}
      <div className="shrink-0 border-b border-border/20">
        {isOpen ? (
          <div className="flex items-center gap-2 px-3 py-2.5">
            <AjeLogo size={22} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[13px] font-bold leading-tight text-foreground">
                BWH
              </span>
              <span className="text-[9px] leading-tight text-foreground/30">
                Build Wealth Here
              </span>
            </div>
            <button
              onClick={togglePin}
              title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              className="ml-auto shrink-0 rounded-md p-1 text-foreground/20 transition-colors hover:text-foreground/50"
            >
              {isPinned ? (
                <PinOff className="h-3 w-3" />
              ) : (
                <Pin className="h-3 w-3" />
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-3">
            <AjeLogo size={22} />
          </div>
        )}
      </div>

      {/* Search bar — only when open */}
      <div
        className={`shrink-0 overflow-hidden border-b border-border/20 transition-all duration-200 ${isOpen ? "max-h-12 opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-3 py-2">
          <div className="flex items-center gap-2 rounded-md bg-foreground/[0.05] px-3 py-1.5">
            <Search className="h-[14px] w-[14px] shrink-0 text-foreground/30" />
            <span className="flex-1 text-xs text-foreground/30">Search...</span>
            <span className="text-[10px] text-foreground/20">⌘K</span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-scroll flex-1 overflow-y-auto px-2 py-2">
        {sections.map((section) => (
          <div key={section.label} className="mb-1">
            {/* Section label */}
            <div
              className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-8 opacity-100" : "max-h-0 opacity-0"}`}
            >
              <span
                className={`mb-0.5 block px-2 text-[9px] font-bold uppercase tracking-[0.14em] ${sectionLabelColor}`}
              >
                {section.label}
              </span>
            </div>

            {section.items.map((item) => {
              const isTabbed = (item as any).tabbed;
              const active = isTabbed
                ? location.pathname.startsWith(item.to)
                : location.pathname === item.to;
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
                  className={`relative flex items-center rounded-md mx-1 px-2 py-[7px] text-[12.5px] font-medium transition-colors duration-100 ${
                    isOpen ? "gap-2.5" : "justify-center"
                  } ${
                    active
                      ? "bg-foreground/[0.07] text-foreground before:absolute before:left-0 before:top-[6px] before:bottom-[6px] before:w-[2px] before:rounded-r-full before:bg-primary before:content-['']"
                      : isRestricted
                        ? "text-foreground/15 cursor-not-allowed"
                        : "text-foreground/35 hover:bg-foreground/[0.04] hover:text-foreground/70"
                  }`}
                >
                  <item.icon
                    className={`h-[14px] w-[14px] shrink-0 ${isRestricted ? "opacity-30" : ""}`}
                  />
                  <span
                    className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                      isOpen ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                    }`}
                  >
                    {item.label}
                  </span>
                  {isTabbed && isOpen && (
                    <span className="ml-auto flex shrink-0 gap-[3px]">
                      <span className="h-[3px] w-[3px] rounded-full bg-current opacity-25" />
                      <span className="h-[3px] w-[3px] rounded-full bg-current opacity-25" />
                      <span className="h-[3px] w-[3px] rounded-full bg-current opacity-25" />
                    </span>
                  )}
                  {isRestricted && isOpen && (
                    <ShieldAlert className="ml-auto h-3 w-3 shrink-0 opacity-30" />
                  )}
                </RouterNavLink>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="shrink-0 border-t border-border/20 p-3">
        {isOpen ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {avatarInitials}
            </div>
            <span className="min-w-0 truncate text-[12px] text-foreground/60">
              {user?.email ?? ""}
            </span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
              {avatarInitials}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
