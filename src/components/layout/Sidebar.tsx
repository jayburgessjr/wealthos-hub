import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import { useState } from "react";
import { Pin, PinOff, ShieldAlert, Home as HomeIcon } from "lucide-react";
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
import { useNavMode } from "@/lib/navMode";
import { simpleNavItems, isSimpleItemActive } from "./simpleNav";

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

const deskNavSections = [
  {
    label: "Desk",
    items: [
      { to: "/desk", icon: LayoutDashboard, label: "Overview" },
      { to: "/desk/portfolio", icon: Briefcase, label: "Portfolio" },
      { to: "/desk/research", icon: Radar, label: "Research" },
      { to: "/desk/performance", icon: Trophy, label: "Performance" },
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
    items: [
      { to: "/household", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/household/money", icon: DollarSign, label: "Money coach" },
    ],
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

interface SidebarNavListProps {
  isOpen: boolean;
  onNavigate?: () => void;
}

/** The navigation list, shared by the desktop sidebar and the mobile drawer. */
export function SidebarNavList({ isOpen, onNavigate }: SidebarNavListProps) {
  const location = useLocation();
  const { isAdmin } = useSubscription();
  const { mode } = useNavMode();

  const isHousehold = location.pathname.startsWith("/household");
  const isWealth = location.pathname.startsWith("/wealth");
  const isDesk = location.pathname.startsWith("/desk");

  const sections = isHousehold
    ? householdNavSections
    : isWealth
      ? wealthNavSections
      : isDesk
        ? deskNavSections
        : navSections;

  const sectionLabelColor = "text-foreground/60";

  const linkBase =
    "relative flex items-center rounded-md mx-1 px-2 py-[7px] text-[13px] font-medium transition-colors duration-100";
  const activeCls =
    "bg-foreground/[0.07] text-foreground before:absolute before:left-0 before:top-[6px] before:bottom-[6px] before:w-[2px] before:rounded-r-full before:bg-primary before:content-['']";
  const idleCls = "text-foreground/70 hover:bg-foreground/[0.04] hover:text-foreground";

  if (mode === "simple") {
    return (
      <nav aria-label="Main" className="sidebar-scroll flex-1 overflow-y-auto px-2 py-2">
        {simpleNavItems.map((item) => {
          const active = isSimpleItemActive(item, location.pathname);
          return (
            <RouterNavLink
              key={item.to}
              to={item.to}
              title={!isOpen ? item.label : undefined}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              onClick={onNavigate}
              className={`${linkBase} ${isOpen ? "gap-2.5" : "justify-center"} ${active ? activeCls : idleCls}`}
            >
              <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span
                className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                  isOpen ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                }`}
              >
                {item.label}
              </span>
            </RouterNavLink>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Main" className="sidebar-scroll flex-1 overflow-y-auto px-2 py-2">
      {/* Home stays one click away in pro mode */}
      <RouterNavLink
        to="/home"
        title={!isOpen ? "Home" : undefined}
        aria-label="Home"
        onClick={onNavigate}
        className={`${linkBase} mb-1 ${isOpen ? "gap-2.5" : "justify-center"} ${
          location.pathname === "/home" ? activeCls : idleCls
        }`}
      >
        <HomeIcon className="h-[14px] w-[14px] shrink-0" aria-hidden="true" />
        <span
          className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
            isOpen ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
          }`}
        >
          Home
        </span>
      </RouterNavLink>

      {sections.map((section) => (
        <div key={section.label} className="mb-1">
          <div
            className={`overflow-hidden transition-all duration-200 ${isOpen ? "max-h-8 opacity-100" : "max-h-0 opacity-0"}`}
          >
            <span
              className={`mb-0.5 block px-2 text-xs font-bold uppercase tracking-[0.1em] ${sectionLabelColor}`}
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
                aria-label={item.label}
                onClick={(e) => {
                  if (isRestricted) {
                    e.preventDefault();
                    toast.error("Admin permissions required");
                  } else {
                    onNavigate?.();
                  }
                }}
                className={`${linkBase} ${isOpen ? "gap-2.5" : "justify-center"} ${
                  active
                    ? activeCls
                    : isRestricted
                      ? "text-foreground/40 cursor-not-allowed"
                      : idleCls
                }`}
              >
                <item.icon
                  className={`h-[14px] w-[14px] shrink-0 ${isRestricted ? "opacity-60" : ""}`}
                  aria-hidden="true"
                />
                <span
                  className={`overflow-hidden whitespace-nowrap transition-all duration-200 ${
                    isOpen ? "max-w-[160px] opacity-100" : "max-w-0 opacity-0"
                  }`}
                >
                  {item.label}
                </span>
                {isTabbed && isOpen && (
                  <span className="ml-auto flex shrink-0 gap-[3px]" aria-hidden="true">
                    <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
                    <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
                    <span className="h-[3px] w-[3px] rounded-full bg-current opacity-40" />
                  </span>
                )}
                {isRestricted && isOpen && (
                  <>
                    <ShieldAlert className="ml-auto h-3 w-3 shrink-0 opacity-60" aria-hidden="true" />
                    <span className="sr-only">(admin only)</span>
                  </>
                )}
              </RouterNavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export default function Sidebar() {
  const { user } = useAuth();

  const [isPinned, setIsPinned] = useState(() => {
    try {
      return localStorage.getItem("sidebar-pinned") === "true";
    } catch {
      return false;
    }
  });
  const [isHovered, setIsHovered] = useState(false);

  const isOpen = isPinned || isHovered;

  const togglePin = () => {
    const next = !isPinned;
    setIsPinned(next);
    try {
      localStorage.setItem("sidebar-pinned", String(next));
    } catch {
      // ignore
    }
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
              <span className="text-[13px] font-bold leading-tight text-foreground">BWH</span>
              <span className="text-xs leading-tight text-foreground/60">Build Wealth Here</span>
            </div>
            <button
              onClick={togglePin}
              title={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              aria-label={isPinned ? "Unpin sidebar" : "Pin sidebar open"}
              aria-pressed={isPinned}
              className="ml-auto shrink-0 rounded-md p-1 text-foreground/50 transition-colors hover:text-foreground"
            >
              {isPinned ? (
                <PinOff className="h-3 w-3" aria-hidden="true" />
              ) : (
                <Pin className="h-3 w-3" aria-hidden="true" />
              )}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center py-3">
            <AjeLogo size={22} />
          </div>
        )}
      </div>

      <SidebarNavList isOpen={isOpen} />

      {/* User footer */}
      <div className="shrink-0 border-t border-border/20 p-3">
        {isOpen ? (
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {avatarInitials}
            </div>
            <span className="min-w-0 truncate text-xs text-foreground/70">{user?.email ?? ""}</span>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {avatarInitials}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
