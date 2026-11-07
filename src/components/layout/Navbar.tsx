import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, TrendingUp, Landmark, Home, Terminal, Menu, House } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SidebarNavList } from "./Sidebar";
import { useNavMode } from "@/lib/navMode";
import { useIsOwner } from "@/lib/desk/hooks";
import { toast } from "sonner";

const StatItem = ({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) => (
  <div className="flex items-center gap-1.5 px-3">
    <span className="text-xs text-muted-foreground">
      {label}
    </span>
    <span
      className={`font-mono text-xs font-semibold ${color ?? "text-foreground"}`}
    >
      {value}
    </span>
  </div>
);

export default function Navbar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const hasCreated = useRef(false);

  const isHousehold = location.pathname.startsWith("/household");
  const isWealth = location.pathname.startsWith("/wealth");
  const isDesk = location.pathname.startsWith("/desk");
  const mode = location.pathname === "/home" ? "home" : isHousehold ? "household" : isWealth ? "wealth" : isDesk ? "desk" : "invest";
  const { mode: navMode, setMode: setNavMode } = useNavMode();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isPro = navMode === "pro";
  const { data: isDeskOwner } = useIsOwner();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      navigate("/");
    }
  };

  const { data: portfolio, isLoading } = useQuery({
    queryKey: ["portfolio", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("portfolios")
        .select(
          "total_capital, total_pnl, total_pnl_pct, deployed_capital, available_capital, win_rate",
        )
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { mutate: createPortfolio } = useMutation({
    mutationFn: async () => {
      await supabase.from("portfolios").insert({
        user_id: user!.id,
        total_capital: 0,
        available_capital: 0,
        deployed_capital: 0,
        total_pnl: 0,
        total_pnl_pct: 0,
        win_rate: 0,
        total_trades: 0,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", user?.id] });
    },
  });

  useEffect(() => {
    if (user && portfolio === null && !isLoading && !hasCreated.current) {
      hasCreated.current = true;
      createPortfolio();
    }
  }, [user, portfolio, isLoading]);

  const totalCapital = portfolio?.total_capital ?? 0;
  const totalPnl = portfolio?.total_pnl ?? 0;
  const totalPnlPct = portfolio?.total_pnl_pct ?? 0;
  const deployed = portfolio?.deployed_capital ?? 0;
  const available = portfolio?.available_capital ?? 0;
  const winRate = portfolio?.win_rate ?? 0;

  const pnlColor = totalPnl >= 0 ? "text-bullish" : "text-bearish";
  const pnlLabel = `${totalPnl >= 0 ? "+" : ""}$${Math.abs(totalPnl).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <header className="sticky top-0 z-50 flex h-10 items-center justify-between border-b border-border/40 bg-background/95 backdrop-blur-sm px-3 gap-3">
      {/* Mobile drawer trigger (below lg) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetTrigger asChild>
          <button
            aria-label="Open navigation menu"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[280px] flex-col p-0">
          <SheetTitle className="px-4 pt-4 text-base">Menu</SheetTitle>
          <SheetDescription className="sr-only">Site navigation</SheetDescription>
          <SidebarNavList isOpen onNavigate={() => setDrawerOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Left — mode switcher */}
      <div className="flex items-center gap-0.5 shrink-0 overflow-x-auto">
        <button
          onClick={() => navigate("/home")}
          className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
            mode === "home"
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <House className="h-3 w-3" aria-hidden="true" />
          <span>Home</span>
        </button>
        {isPro && (
          <div className="hidden items-center gap-0.5 sm:flex">
            <button
              onClick={() => navigate("/invs/dashboard")}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                mode === "invest"
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TrendingUp className="h-3 w-3" aria-hidden="true" />
              <span>Invest</span>
            </button>
            <button
              onClick={() => navigate("/wealth")}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                mode === "wealth"
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Landmark className="h-3 w-3" aria-hidden="true" />
              <span>Wealth</span>
            </button>
            <button
              onClick={() => navigate("/household")}
              className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
                mode === "household"
                  ? "bg-emerald-600/15 text-emerald-400"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Home className="h-3 w-3" aria-hidden="true" />
              <span>Household</span>
            </button>
          </div>
        )}
        {isDeskOwner === true && (
          <button
            onClick={() => navigate("/desk")}
            className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs font-semibold transition-colors ${
              mode === "desk"
                ? "bg-orange-500/15 text-orange-400"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Terminal className="h-3 w-3" />
            <span>Desk</span>
          </button>
        )}
      </div>

      {/* Center — portfolio stats */}
      {isPro && mode === "invest" && (
        <div className="hidden items-center divide-x divide-border/40 xl:flex flex-1 justify-center">
          {isLoading ? (
            <div className="flex gap-3 px-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 w-12 animate-pulse rounded bg-muted"
                />
              ))}
            </div>
          ) : (
            <>
              <StatItem
                label="Capital"
                value={`$${totalCapital.toLocaleString()}`}
              />
              <StatItem label="P&L" value={pnlLabel} color={pnlColor} />
              <StatItem
                label="Return"
                value={`${totalPnlPct.toFixed(1)}%`}
                color={pnlColor}
              />
              <StatItem
                label="Deployed"
                value={`$${deployed.toLocaleString()}`}
              />
              <StatItem
                label="Available"
                value={`$${available.toLocaleString()}`}
              />
              <StatItem label="Win Rate" value={`${winRate}%`} />
            </>
          )}
        </div>
      )}

      {/* Right — theme + user */}
      <div className="flex items-center gap-2 shrink-0 ml-auto">
        <div
          role="group"
          aria-label="Navigation mode"
          className="flex items-center rounded-md border border-border/60 p-0.5 text-xs font-semibold"
        >
          {(["simple", "pro"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setNavMode(m)}
              aria-pressed={navMode === m}
              className={`rounded px-2 py-0.5 transition-colors ${
                navMode === m ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {m === "simple" ? "Simple" : "Pro"}
            </button>
          ))}
        </div>
        <ThemeToggle />
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button aria-label="Account menu" className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition-colors focus:outline-none">
                {user.email?.substring(0, 2).toUpperCase()}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <div className="px-3 py-2">
                <p className="text-xs text-muted-foreground truncate">
                  {user.email}
                </p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate("/settings")}
                className="cursor-pointer"
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-bearish focus:text-bearish"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
