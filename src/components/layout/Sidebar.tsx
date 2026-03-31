import { NavLink as RouterNavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Radar, Briefcase, ShoppingCart, Zap, PieChart, ShieldAlert,
  Bot, Globe, MessageSquare, BarChart3, FlaskConical, FileText, Settings, Eye,
} from "lucide-react";

const navSections = [
  {
    label: "Core",
    items: [
      { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/signals", icon: Radar, label: "Signals" },
      { to: "/positions", icon: Briefcase, label: "Positions" },
      { to: "/watchlist", icon: Eye, label: "Watchlist" },
    ],
  },
  {
    label: "Capital",
    items: [
      { to: "/compound", icon: Zap, label: "Compound Engine" },
      { to: "#", icon: PieChart, label: "Strategy Allocator" },
      { to: "/settings", icon: ShieldAlert, label: "Risk Controls" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/ai-advisor", icon: Bot, label: "AI Advisor" },
      { to: "#", icon: Globe, label: "Market Regime" },
      { to: "#", icon: MessageSquare, label: "Sentiment Feed" },
      { to: "#", icon: ShoppingCart, label: "Options Flow" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { to: "#", icon: BarChart3, label: "Performance" },
      { to: "#", icon: FlaskConical, label: "Backtests" },
      { to: "#", icon: FileText, label: "Reports" },
    ],
  },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-[220px] shrink-0 border-r border-border bg-surface lg:flex lg:flex-col overflow-y-auto">
      <nav className="flex flex-col gap-1 p-3">
        {navSections.map((section) => (
          <div key={section.label} className="mb-2">
            <span className="mb-1 block px-3 font-body text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {section.label}
            </span>
            {section.items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <RouterNavLink
                  key={item.to + item.label}
                  to={item.to}
                  className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-fast ${
                    active
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </RouterNavLink>
              );
            })}
          </div>
        ))}
        <div className="mt-auto pt-4 border-t border-border">
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
        </div>
      </nav>
    </aside>
  );
}
