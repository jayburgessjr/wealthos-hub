import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Radar, Briefcase, Zap, PieChart, ShieldAlert,
  Bot, Globe, BarChart3, Settings, Eye, ShieldCheck, LogOut, FileText,
  Bitcoin, TrendingUp, Newspaper, Cpu, Shield, Brain,
  CalendarDays, BookOpen, Calculator, Map, FlaskConical, Leaf, Megaphone
} from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const navSections = [
  {
    label: "Core",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/decisions", icon: Zap, label: "Decision Hub" },
      { to: "/signals", icon: Radar, label: "Signals" },
      { to: "/positions", icon: Briefcase, label: "Positions" },
      { to: "/watchlist", icon: Eye, label: "Watchlist" },
    ],
  },
  {
    label: "Capital",
    items: [
      { to: "/compound", icon: Zap, label: "Compound Engine" },
      { to: "/strategy-allocator", icon: PieChart, label: "Strategy Allocator" },
      { to: "/quantum", icon: Cpu, label: "Quantum Engine" },
      { to: "/settings", icon: ShieldAlert, label: "Risk Controls" },
    ],
  },
  {
    label: "Markets",
    items: [
      { to: "/crypto",  icon: Bitcoin,    label: "Crypto" },
      { to: "/markets", icon: TrendingUp, label: "Forex & Commodities" },
    ],
  },
  {
    label: "AI",
    items: [
      { to: "/financial-advisor", icon: Brain, label: "Financial Advisor" },
      { to: "/ai-advisor", icon: Bot, label: "AI Advisor" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/market-regime", icon: Globe, label: "Market Regime" },
      { to: "/news", icon: Newspaper, label: "News & Intel" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "/performance", icon: BarChart3, label: "Performance" },
      { to: "/pnl-calendar", icon: CalendarDays, label: "P&L Calendar" },
      { to: "/heat-map", icon: Map, label: "Heat Map" },
      { to: "/earnings-calendar", icon: Megaphone, label: "Earnings Calendar" },
      { to: "/documents", icon: FileText, label: "Documents" },
      { to: "/security", icon: Shield, label: "Security & Audit" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/position-sizer", icon: Calculator, label: "Position Sizer" },
      { to: "/paper-trading", icon: FlaskConical, label: "Paper Trading" },
      { to: "/trading-journal", icon: BookOpen, label: "Trading Journal" },
      { to: "/tax-harvesting", icon: Leaf, label: "Tax Harvesting" },
    ],
  },
  {
    label: "Reports",
    items: [
      { to: "/weekly-briefing", icon: Newspaper, label: "Weekly Briefing" },
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
  const { isAdmin, profile } = useSubscription();
  const { user } = useAuth();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      window.location.href = "/";
    }
  };

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-border bg-background lg:flex lg:flex-col overflow-y-auto">
      <nav className="flex flex-col gap-1 p-3">
        {navSections.map((section) => {
          // Force items to be visible if they are in the Admin section for testing
          const visibleItems = section.items;

          return (
            <div key={section.label} className="mb-2">
              <span className="mb-1 block px-3 font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
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
                        ? "bg-accent text-foreground"
                        : isRestricted
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
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

        <div className="mt-auto pt-4 border-t border-border flex flex-col gap-1">
          <RouterNavLink
            to="/settings"
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-fast ${
              location.pathname === "/settings"
                ? "bg-accent text-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </RouterNavLink>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-bearish transition-fast hover:bg-bearish/10"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
          
          {user && (
            <div className="mt-2 flex flex-col gap-1 px-3 py-2 border-t border-border/50">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[10px] font-bold">
                  {user.email?.substring(0, 2).toUpperCase()}
                </div>
                <div className="overflow-hidden">
                  <p className="truncate text-[10px] font-medium text-foreground">{user.email}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
