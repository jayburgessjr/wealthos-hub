import { useState, Fragment } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, FlaskConical, X, ChevronDown,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

// ── Types ──────────────────────────────────────────────────────────────────────
type Direction = "long" | "short";
type TradeStatus = "open" | "closed";

interface PaperTrade {
  id: string;
  ticker: string;
  company_name: string | null;
  direction: Direction;
  strategy_type: string;
  entry_price: number;
  current_price: number | null;
  quantity: number;
  total_value: number | null;
  pnl_dollars: number;
  pnl_percent: number;
  status: TradeStatus;
  entry_date: string;
  close_date: string | null;
  close_price: number | null;
  notes: string | null;
  created_at: string;
}

// ── Demo data ──────────────────────────────────────────────────────────────────
const DEMO_TRADES: PaperTrade[] = [
  {
    id: "demo-pt-1", ticker: "SPY", company_name: "SPDR S&P 500 ETF", direction: "long",
    strategy_type: "long_stock", entry_price: 498.20, current_price: 512.40, quantity: 10,
    total_value: 5124, pnl_dollars: 142, pnl_percent: 2.85, status: "open",
    entry_date: "2026-04-01", close_date: null, close_price: null, notes: null,
    created_at: "2026-04-01T00:00:00Z",
  },
  {
    id: "demo-pt-2", ticker: "QQQ", company_name: "Invesco QQQ Trust", direction: "long",
    strategy_type: "long_stock", entry_price: 430.10, current_price: 445.80, quantity: 5,
    total_value: 2229, pnl_dollars: 78.5, pnl_percent: 3.65, status: "open",
    entry_date: "2026-04-05", close_date: null, close_price: null, notes: null,
    created_at: "2026-04-05T00:00:00Z",
  },
  {
    id: "demo-pt-3", ticker: "AMD", company_name: "Advanced Micro Devices", direction: "long",
    strategy_type: "long_stock", entry_price: 148.30, current_price: 138.90, quantity: 20,
    total_value: 2778, pnl_dollars: -188, pnl_percent: -6.34, status: "open",
    entry_date: "2026-04-10", close_date: null, close_price: null, notes: null,
    created_at: "2026-04-10T00:00:00Z",
  },
  {
    id: "demo-pt-4", ticker: "GOOGL", company_name: "Alphabet Inc.", direction: "long",
    strategy_type: "long_stock", entry_price: 165.20, current_price: null, quantity: 8,
    total_value: 1379.2, pnl_dollars: 57.6, pnl_percent: 4.36, status: "closed",
    entry_date: "2026-03-15", close_date: "2026-04-05", close_price: 172.40, notes: null,
    created_at: "2026-03-15T00:00:00Z",
  },
  {
    id: "demo-pt-5", ticker: "COIN", company_name: "Coinbase Global", direction: "long",
    strategy_type: "long_stock", entry_price: 225.00, current_price: null, quantity: 4,
    total_value: 994, pnl_dollars: 94, pnl_percent: 10.44, status: "closed",
    entry_date: "2026-03-20", close_date: "2026-04-15", close_price: 248.50, notes: null,
    created_at: "2026-03-20T00:00:00Z",
  },
];

const STARTING_CAPITAL = 10_000;
const STRATEGY_OPTIONS = [
  { value: "long_stock", label: "Long Stock" },
  { value: "covered_call", label: "Covered Call" },
  { value: "put_option", label: "Put Option" },
  { value: "call_option", label: "Call Option" },
  { value: "other", label: "Other" },
];

type Tab = "open" | "closed" | "new";

// ── Helpers ───────────────────────────────────────────────────────────────────
function daysHeld(entryDate: string, closeDate?: string | null) {
  const end = closeDate ? new Date(closeDate) : new Date();
  return Math.max(0, Math.floor((end.getTime() - new Date(entryDate).getTime()) / 86_400_000));
}

function pnlColor(val: number) {
  return val >= 0 ? "text-bullish" : "text-bearish";
}

function fmtPnl(dollars: number, percent: number) {
  const sign = dollars >= 0 ? "+" : "";
  return `${sign}$${Math.abs(dollars).toFixed(2)} (${sign}${percent.toFixed(2)}%)`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PaperTrading() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isDemoMode = !user;

  const [activeTab, setActiveTab] = useState<Tab>("open");

  // Close-trade inline form state: keyed by trade id
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closePrice, setClosePrice] = useState("");
  const [closeDate, setCloseDateVal] = useState(new Date().toISOString().split("T")[0]);

  // New trade form state
  const [newTicker, setNewTicker] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newDirection, setNewDirection] = useState<Direction>("long");
  const [newStrategy, setNewStrategy] = useState("long_stock");
  const [newEntryPrice, setNewEntryPrice] = useState("");
  const [newQuantity, setNewQuantity] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // ── Query ──────────────────────────────────────────────────────────────────
  const { data: trades = [], isLoading } = useQuery<PaperTrade[]>({
    queryKey: ["paper_trades", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("paper_trades")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PaperTrade[];
    },
    enabled: !!user && !isDemoMode,
  });

  const displayTrades: PaperTrade[] = isDemoMode ? DEMO_TRADES : trades;
  const openTrades = displayTrades.filter((t) => t.status === "open");
  const closedTrades = displayTrades.filter((t) => t.status === "closed");

  // ── Account summary ────────────────────────────────────────────────────────
  const openValue = openTrades.reduce((acc, t) => acc + (t.total_value ?? t.entry_price * t.quantity), 0);
  const openPnl = openTrades.reduce((acc, t) => acc + t.pnl_dollars, 0);
  const currentValue = STARTING_CAPITAL + openPnl;
  const totalPnlPct = ((currentValue - STARTING_CAPITAL) / STARTING_CAPITAL) * 100;

  // ── Create trade mutation ──────────────────────────────────────────────────
  const { mutate: createTrade, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const entryPrice = parseFloat(newEntryPrice);
      const quantity = parseFloat(newQuantity);
      if (!entryPrice || !quantity) throw new Error("Entry price and quantity are required");

      const { error } = await supabase.from("paper_trades").insert({
        user_id: user!.id,
        ticker: newTicker.toUpperCase().trim(),
        company_name: newCompany.trim() || null,
        direction: newDirection,
        strategy_type: newStrategy,
        entry_price: entryPrice,
        current_price: entryPrice,
        quantity,
        total_value: entryPrice * quantity,
        pnl_dollars: 0,
        pnl_percent: 0,
        status: "open",
        entry_date: new Date().toISOString().split("T")[0],
        notes: newNotes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paper_trades"] });
      toast.success(`${newDirection === "long" ? "Long" : "Short"} ${newTicker.toUpperCase()} paper trade opened`);
      setNewTicker(""); setNewCompany(""); setNewEntryPrice(""); setNewQuantity(""); setNewNotes("");
      setActiveTab("open");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to open trade"),
  });

  // ── Close trade mutation ───────────────────────────────────────────────────
  const { mutate: closeTrade, isPending: isClosing } = useMutation({
    mutationFn: async ({ trade }: { trade: PaperTrade }) => {
      const cp = parseFloat(closePrice);
      if (!cp || cp <= 0) throw new Error("Enter a valid close price");

      const pnlDollars =
        trade.direction === "long"
          ? (cp - trade.entry_price) * trade.quantity
          : (trade.entry_price - cp) * trade.quantity;
      const pnlPercent = (pnlDollars / (trade.entry_price * trade.quantity)) * 100;

      const { error } = await supabase
        .from("paper_trades")
        .update({
          status: "closed",
          close_price: cp,
          close_date: closeDate,
          pnl_dollars: parseFloat(pnlDollars.toFixed(2)),
          pnl_percent: parseFloat(pnlPercent.toFixed(2)),
          total_value: cp * trade.quantity,
        })
        .eq("id", trade.id);
      if (error) throw error;
    },
    onSuccess: (_, { trade }) => {
      queryClient.invalidateQueries({ queryKey: ["paper_trades"] });
      toast.success(`${trade.ticker} paper trade closed`);
      setClosingId(null);
      setClosePrice("");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to close trade"),
  });

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <div className="space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <FlaskConical size={12} className="text-muted-foreground" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Trading</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-3xl font-black tracking-tight">Paper Trading</h2>
          <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Simulated — No Real Money
          </span>
        </div>
        {isDemoMode && (
          <p className="font-mono text-xs text-muted-foreground">
            Viewing demo data. Sign in to track your own paper trades.
          </p>
        )}
      </div>

      {/* Account summary */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          {
            label: "Starting Capital",
            val: `$${STARTING_CAPITAL.toLocaleString()}`,
            color: "text-foreground",
          },
          {
            label: "Current Value",
            val: `$${currentValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
            color: "text-foreground",
          },
          {
            label: "Total P&L",
            val: `${openPnl >= 0 ? "+" : ""}$${Math.abs(openPnl).toFixed(2)} (${totalPnlPct >= 0 ? "+" : ""}${totalPnlPct.toFixed(2)}%)`,
            color: pnlColor(openPnl),
          },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-4">
            <span className="block font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{s.label}</span>
            <span className={`mt-1 block font-mono text-lg font-bold ${s.color}`}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-xl border border-border bg-card p-1 w-fit">
        {(
          [
            { id: "open" as Tab, label: `Open Positions (${openTrades.length})` },
            { id: "closed" as Tab, label: `Closed Trades (${closedTrades.length})` },
            { id: "new" as Tab, label: "New Trade" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-lg px-4 py-2 font-mono text-xs font-bold transition-all ${
              activeTab === tab.id
                ? "bg-primary text-background"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Open Positions Tab ── */}
      <AnimatePresence mode="wait">
        {activeTab === "open" && (
          <motion.div
            key="open"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {isLoading ? (
              <div className="space-y-2 rounded-lg border border-border bg-card p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-accent" />
                ))}
              </div>
            ) : openTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
                <FlaskConical size={32} className="mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No open paper trades</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open your first trade using the "New Trade" tab.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      {["Ticker", "Direction", "Entry $", "Current $", "Qty", "Value", "P&L", "Days", ""].map((h) => (
                        <th key={h} className="px-4 py-3 font-mono font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {openTrades.map((trade) => (
                      <Fragment key={trade.id}>
                        <tr
                          className="border-b border-border/50 transition-colors hover:bg-accent/30"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-mono font-bold text-foreground">{trade.ticker}</span>
                              {trade.company_name && (
                                <span className="block font-mono text-[10px] text-muted-foreground">{trade.company_name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                trade.direction === "long"
                                  ? "bg-bullish/10 text-bullish"
                                  : "bg-bearish/10 text-bearish"
                              }`}
                            >
                              {trade.direction === "long" ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                              {trade.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">${trade.entry_price.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono">
                            ${(trade.current_price ?? trade.entry_price).toFixed(2)}
                          </td>
                          <td className="px-4 py-3 font-mono">{trade.quantity}</td>
                          <td className="px-4 py-3 font-mono">
                            ${(trade.total_value ?? trade.entry_price * trade.quantity).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </td>
                          <td className={`px-4 py-3 font-mono font-semibold ${pnlColor(trade.pnl_dollars)}`}>
                            {fmtPnl(trade.pnl_dollars, trade.pnl_percent)}
                          </td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {daysHeld(trade.entry_date)}d
                          </td>
                          <td className="px-4 py-3">
                            {isDemoMode ? (
                              <span className="font-mono text-[10px] text-muted-foreground">Demo</span>
                            ) : (
                              <button
                                onClick={() => {
                                  if (closingId === trade.id) {
                                    setClosingId(null);
                                  } else {
                                    setClosingId(trade.id);
                                    setClosePrice("");
                                    setCloseDateVal(new Date().toISOString().split("T")[0]);
                                  }
                                }}
                                className="flex items-center gap-1 rounded px-2 py-1 font-mono text-xs text-bearish transition-colors hover:bg-bearish/10"
                              >
                                {closingId === trade.id ? (
                                  <><X size={10} /> Cancel</>
                                ) : (
                                  <><ChevronDown size={10} /> Close</>
                                )}
                              </button>
                            )}
                          </td>
                        </tr>

                        {/* Inline close form */}
                        {closingId === trade.id && (
                          <tr key={`${trade.id}-close`} className="bg-accent/20">
                            <td colSpan={9} className="px-4 py-3">
                              <div className="flex flex-wrap items-end gap-3">
                                <div>
                                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                    Close Price ($)
                                  </label>
                                  <div className="mt-1 flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-2">
                                    <span className="font-mono text-xs text-muted-foreground">$</span>
                                    <input
                                      type="number"
                                      value={closePrice}
                                      onChange={(e) => setClosePrice(e.target.value)}
                                      placeholder="0.00"
                                      step="0.01"
                                      min="0"
                                      className="w-24 bg-transparent font-mono text-sm text-foreground outline-none"
                                      autoFocus
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                    Close Date
                                  </label>
                                  <input
                                    type="date"
                                    value={closeDate}
                                    onChange={(e) => setCloseDateVal(e.target.value)}
                                    className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none"
                                  />
                                </div>
                                {closePrice && (
                                  <div className="rounded-lg border border-border bg-card px-3 py-2">
                                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                                      Estimated P&L
                                    </span>
                                    {(() => {
                                      const cp = parseFloat(closePrice);
                                      const est =
                                        trade.direction === "long"
                                          ? (cp - trade.entry_price) * trade.quantity
                                          : (trade.entry_price - cp) * trade.quantity;
                                      return (
                                        <p className={`font-mono text-sm font-bold ${pnlColor(est)}`}>
                                          {est >= 0 ? "+" : ""}${est.toFixed(2)}
                                        </p>
                                      );
                                    })()}
                                  </div>
                                )}
                                <button
                                  onClick={() => closeTrade({ trade })}
                                  disabled={isClosing || !closePrice}
                                  className="rounded-lg bg-bearish px-4 py-2 font-mono text-xs font-bold text-background transition-all hover:brightness-110 disabled:opacity-40"
                                >
                                  {isClosing ? "Closing…" : "Confirm Close"}
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Closed Trades Tab ── */}
        {activeTab === "closed" && (
          <motion.div
            key="closed"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {closedTrades.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
                <p className="text-sm font-medium text-foreground">No closed trades yet</p>
                <p className="mt-1 text-xs text-muted-foreground">Close an open position to see it here.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-lg border border-border bg-card">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground">
                        {["Ticker", "Direction", "Entry $", "Close $", "Qty", "Days Held", "Realized P&L"].map((h) => (
                          <th key={h} className="px-4 py-3 font-mono font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {closedTrades.map((trade) => (
                        <tr
                          key={trade.id}
                          className="border-b border-border/50 transition-colors hover:bg-accent/30"
                        >
                          <td className="px-4 py-3">
                            <div>
                              <span className="font-mono font-bold text-foreground">{trade.ticker}</span>
                              {trade.company_name && (
                                <span className="block font-mono text-[10px] text-muted-foreground">{trade.company_name}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                                trade.direction === "long"
                                  ? "bg-bullish/10 text-bullish"
                                  : "bg-bearish/10 text-bearish"
                              }`}
                            >
                              {trade.direction === "long" ? <TrendingUp size={9} /> : <TrendingDown size={9} />}
                              {trade.direction}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-mono">${trade.entry_price.toFixed(2)}</td>
                          <td className="px-4 py-3 font-mono">
                            {trade.close_price != null ? `$${trade.close_price.toFixed(2)}` : "—"}
                          </td>
                          <td className="px-4 py-3 font-mono">{trade.quantity}</td>
                          <td className="px-4 py-3 font-mono text-muted-foreground">
                            {daysHeld(trade.entry_date, trade.close_date)}d
                          </td>
                          <td className={`px-4 py-3 font-mono font-semibold ${pnlColor(trade.pnl_dollars)}`}>
                            {fmtPnl(trade.pnl_dollars, trade.pnl_percent)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Realized P&L footer */}
                {(() => {
                  const totalRealized = closedTrades.reduce((a, t) => a + t.pnl_dollars, 0);
                  return (
                    <div className="mt-3 flex items-center justify-end gap-2 rounded-lg border border-border bg-card px-4 py-3">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Total Realized P&L
                      </span>
                      <span className={`font-mono text-base font-bold ${pnlColor(totalRealized)}`}>
                        {totalRealized >= 0 ? "+" : ""}${totalRealized.toFixed(2)}
                      </span>
                    </div>
                  );
                })()}
              </>
            )}
          </motion.div>
        )}

        {/* ── New Trade Tab ── */}
        {activeTab === "new" && (
          <motion.div
            key="new"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {isDemoMode ? (
              <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
                <FlaskConical size={32} className="mb-3 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">Sign in to open paper trades</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Create a free account to track your own simulated trades.
                </p>
              </div>
            ) : (
              <div className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-5 font-display text-base font-bold text-foreground">Open a Paper Trade</h3>

                <div className="space-y-4">
                  {/* Row 1: Ticker + Company */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Ticker
                      </label>
                      <input
                        value={newTicker}
                        onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
                        placeholder="SPY"
                        maxLength={10}
                        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm font-bold uppercase text-foreground outline-none placeholder:text-muted-foreground/40"
                      />
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Company Name
                      </label>
                      <input
                        value={newCompany}
                        onChange={(e) => setNewCompany(e.target.value)}
                        placeholder="Optional"
                        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                      />
                    </div>
                  </div>

                  {/* Row 2: Direction + Strategy */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Direction
                      </label>
                      <div className="mt-1.5 flex overflow-hidden rounded-xl border border-border">
                        <button
                          type="button"
                          onClick={() => setNewDirection("long")}
                          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-xs font-bold transition-all ${
                            newDirection === "long"
                              ? "bg-bullish text-background"
                              : "bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <TrendingUp size={12} /> Long
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewDirection("short")}
                          className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-xs font-bold transition-all ${
                            newDirection === "short"
                              ? "bg-bearish text-background"
                              : "bg-card text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          <TrendingDown size={12} /> Short
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Strategy Type
                      </label>
                      <select
                        value={newStrategy}
                        onChange={(e) => setNewStrategy(e.target.value)}
                        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground outline-none"
                      >
                        {STRATEGY_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Row 3: Entry Price + Quantity */}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Entry Price ($)
                      </label>
                      <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                        <span className="font-mono text-xs text-muted-foreground">$</span>
                        <input
                          type="number"
                          value={newEntryPrice}
                          onChange={(e) => setNewEntryPrice(e.target.value)}
                          placeholder="0.00"
                          step="0.01"
                          min="0"
                          className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Quantity (shares / contracts)
                      </label>
                      <input
                        type="number"
                        value={newQuantity}
                        onChange={(e) => setNewQuantity(e.target.value)}
                        placeholder="0"
                        step="0.01"
                        min="0"
                        className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none"
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Notes (optional)
                    </label>
                    <textarea
                      value={newNotes}
                      onChange={(e) => setNewNotes(e.target.value)}
                      placeholder="Thesis, risk level, catalyst..."
                      rows={3}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none placeholder:text-muted-foreground/40 resize-none"
                    />
                  </div>

                  {/* Position size preview + Submit */}
                  <div className="flex items-center justify-between border-t border-border pt-4">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Position Size
                      </p>
                      <p className="font-mono text-xl font-black text-foreground">
                        $
                        {((parseFloat(newEntryPrice) || 0) * (parseFloat(newQuantity) || 0)).toLocaleString(
                          undefined,
                          { maximumFractionDigits: 2 }
                        )}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => createTrade()}
                      disabled={isCreating || !newTicker.trim() || !newEntryPrice || !newQuantity}
                      className={`flex items-center gap-2 rounded-xl px-6 py-3 font-mono text-sm font-bold text-background transition-all hover:brightness-110 disabled:opacity-40 ${
                        newDirection === "long" ? "bg-bullish" : "bg-bearish"
                      }`}
                    >
                      <FlaskConical size={14} />
                      {isCreating ? "Opening…" : "Open Paper Trade"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
