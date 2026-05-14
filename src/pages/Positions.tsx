import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  TrendingUp, TrendingDown, ChevronDown, ChevronUp,
  Send, AlertCircle, Briefcase
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

// ── Order ticket defaults ───────────────────────────────────────────────────
const ORDER_TYPES = ["Market", "Limit", "Stop", "Stop-Limit"] as const;
const STRATEGY_TYPES = [
  "Momentum", "Covered Call", "Mean Reversion", "Breakout",
  "Swing Trade", "Long-Term Hold", "Crypto Spot", "Arbitrage",
] as const;
type OrderType = typeof ORDER_TYPES[number];
type Direction = "long" | "short";

export default function Positions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ── Order ticket state ───────────────────────────────────────────────────
  const [ticketOpen, setTicketOpen] = useState(true);
  const [ticker, setTicker] = useState("");
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [leverage, setLeverage] = useState(1);
  const [strategyType, setStrategyType] = useState<string>(STRATEGY_TYPES[0]);
  const [signalScore, setSignalScore] = useState("75");

  const { mutate: placeOrder, isPending: isPlacing } = useMutation({
    mutationFn: async () => {
      const entryPrice = parseFloat(price) || 100;
      const qty = parseFloat(quantity) || 1;
      const positionValue = entryPrice * qty * leverage;

      // Insert simulated position
      const { error } = await supabase.from("positions").insert({
        user_id: user?.id ?? "demo",
        ticker: ticker.toUpperCase(),
        strategy_type: strategyType,
        entry_price: entryPrice,
        current_price: entryPrice,
        shares_contracts: qty,
        value: positionValue,
        pnl_dollars: 0,
        pnl_percent: 0,
        signal_score: parseFloat(signalScore),
        status: "open",
        entry_date: new Date().toISOString().split("T")[0],
        direction,
        order_type: orderType,
        leverage,
      });
      if (error) throw error;

      // Update portfolio deployed capital
      if (user?.id) {
        const { data: portfolio } = await supabase
          .from("portfolios").select("deployed_capital, available_capital").eq("user_id", user.id).maybeSingle();
        if (portfolio) {
          await supabase.from("portfolios").update({
            deployed_capital: (portfolio.deployed_capital ?? 0) + positionValue,
            available_capital: Math.max(0, (portfolio.available_capital ?? 0) - positionValue),
          }).eq("user_id", user.id);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["positions"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      toast.success(`${direction === "long" ? "Long" : "Short"} ${ticker.toUpperCase()} order placed`);
      setTicker(""); setPrice(""); setQuantity("");
    },
    onError: (err: any) => toast.error(err.message ?? "Order failed"),
  });

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['positions', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
  });

  const { mutate: closePosition, isPending: isClosing } = useMutation({
    mutationFn: async (position: typeof positions[0]) => {
      await supabase.from('positions').update({ status: 'closed' }).eq('id', position.id);

      await supabase.from('transactions').insert({
        user_id: user!.id,
        position_id: position.id,
        ticker: position.ticker,
        action: 'close',
        strategy_type: position.strategy_type,
        price: position.current_price ?? position.entry_price,
        quantity: position.shares_contracts,
        total_value: position.value ?? 0,
        pnl_realized: position.pnl_dollars ?? 0,
      });

      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('deployed_capital, available_capital, total_pnl, total_trades')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (portfolio) {
        await supabase.from('portfolios').update({
          deployed_capital: Math.max(0, (portfolio.deployed_capital ?? 0) - (position.value ?? 0)),
          available_capital: (portfolio.available_capital ?? 0) + (position.value ?? 0),
          total_pnl: (portfolio.total_pnl ?? 0) + (position.pnl_dollars ?? 0),
          total_trades: (portfolio.total_trades ?? 0) + 1,
        }).eq('user_id', user!.id);
      }
    },
    onSuccess: (_, position) => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success(`${position.ticker} position closed`);
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to close position');
    },
  });

  const totalValue = positions.reduce((a, p) => a + (p.value ?? 0), 0);
  const totalPnl = positions.reduce((a, p) => a + (p.pnl_dollars ?? 0), 0);
  const best = positions.length
    ? positions.reduce((a, p) => ((p.pnl_percent ?? 0) > (a.pnl_percent ?? 0) ? p : a))
    : null;
  const worst = positions.length
    ? positions.reduce((a, p) => ((p.pnl_percent ?? 0) < (a.pnl_percent ?? 0) ? p : a))
    : null;

  const estimatedValue = (parseFloat(price) || 0) * (parseFloat(quantity) || 0) * leverage;

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Briefcase size={12} className="text-muted-foreground" />
          <span className="text-xs uppercase tracking-widest text-muted-foreground">Trading</span>
        </div>
        <h2 className="font-display text-3xl font-black tracking-tight">Positions</h2>
      </div>

      {/* ── Order Ticket ── */}
      <div className="mb-6 rounded-2xl border border-border bg-card overflow-hidden">
        <button
          onClick={() => setTicketOpen(v => !v)}
          className="flex w-full items-center justify-between px-5 py-4"
        >
          <div className="flex items-center gap-3">
            <Send size={14} className="text-primary" />
            <span className="font-display text-sm font-bold text-foreground">Order Ticket</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-bold uppercase text-primary">
              Simulated
            </span>
          </div>
          {ticketOpen
            ? <ChevronUp size={14} className="text-muted-foreground" />
            : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {ticketOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-border"
            >
              <div className="p-5 space-y-4">
                {/* Row 1: Symbol + Direction */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Symbol</label>
                    <input
                      value={ticker}
                      onChange={e => setTicker(e.target.value.toUpperCase())}
                      placeholder="AAPL"
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm font-bold text-foreground outline-none placeholder:text-muted-foreground/40 uppercase"
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Direction</label>
                    <div className="mt-1.5 flex overflow-hidden rounded-xl border border-border">
                      <button
                        onClick={() => setDirection("long")}
                        className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-xs font-bold transition-all ${
                          direction === "long" ? "bg-bullish text-background" : "bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <TrendingUp size={12} /> Long
                      </button>
                      <button
                        onClick={() => setDirection("short")}
                        className={`flex flex-1 items-center justify-center gap-1.5 py-2.5 font-mono text-xs font-bold transition-all ${
                          direction === "short" ? "bg-bearish text-background" : "bg-card text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <TrendingDown size={12} /> Short
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Order Type</label>
                    <select
                      value={orderType}
                      onChange={e => setOrderType(e.target.value as OrderType)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground outline-none"
                    >
                      {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Strategy</label>
                    <select
                      value={strategyType}
                      onChange={e => setStrategyType(e.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground outline-none"
                    >
                      {STRATEGY_TYPES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>

                {/* Row 2: Price + Quantity + Leverage + Signal */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">
                      {orderType === "Market" ? "Last Price ($)" : "Limit Price ($)"}
                    </label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                      <span className="font-mono text-xs text-muted-foreground">$</span>
                      <input
                        type="number"
                        value={price}
                        onChange={e => setPrice(e.target.value)}
                        placeholder="0.00"
                        className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                        min="0"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Quantity</label>
                    <input
                      type="number"
                      value={quantity}
                      onChange={e => setQuantity(e.target.value)}
                      placeholder="0"
                      className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-sm text-foreground outline-none"
                      min="0"
                      step="0.01"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-xs uppercase tracking-widest text-muted-foreground">Leverage</label>
                      <span className="font-mono text-xs font-black text-watch">{leverage}×</span>
                    </div>
                    <input
                      type="range" min={1} max={10} step={1}
                      value={leverage}
                      onChange={e => setLeverage(Number(e.target.value))}
                      className="mt-3 w-full"
                      style={{ accentColor: leverage > 5 ? "#ef4444" : "#F59E0B" }}
                    />
                  </div>

                  <div>
                    <label className="text-xs uppercase tracking-widest text-muted-foreground">Signal Score</label>
                    <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2.5">
                      <input
                        type="number"
                        value={signalScore}
                        onChange={e => setSignalScore(e.target.value)}
                        className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                        min="0" max="100"
                      />
                      <span className="font-mono text-xs text-muted-foreground">/100</span>
                    </div>
                  </div>
                </div>

                {/* Summary + Submit */}
                <div className="flex items-center justify-between border-t border-border pt-4">
                  <div className="space-y-0.5">
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">Position Value</p>
                    <p className="font-mono text-xl font-black text-foreground">
                      ${estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </p>
                    {leverage > 1 && (
                      <p className="text-xs text-watch">{leverage}× leverage applied</p>
                    )}
                  </div>

                  <div className="flex items-center gap-3">
                    {leverage >= 5 && (
                      <div className="flex items-center gap-1.5 rounded-lg border border-bearish/30 bg-bearish/5 px-3 py-2">
                        <AlertCircle size={11} className="text-bearish" />
                        <span className="text-xs text-bearish">High leverage</span>
                      </div>
                    )}
                    <button
                      onClick={() => placeOrder()}
                      disabled={isPlacing || !ticker.trim() || !price || !quantity}
                      className={`flex items-center gap-2 rounded-xl px-6 py-3 font-mono text-sm font-bold text-background transition-all hover:brightness-110 disabled:opacity-40 ${
                        direction === "long" ? "bg-bullish" : "bg-bearish"
                      }`}
                    >
                      <Send size={14} />
                      {isPlacing ? "Placing…" : `Place ${direction === "long" ? "Buy" : "Sell"} Order`}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Value", val: `$${totalValue.toLocaleString()}`, color: "text-foreground" },
          { label: "Total P&L", val: `${totalPnl >= 0 ? "+" : ""}$${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? "text-bullish" : "text-bearish" },
          { label: "Best", val: best ? `${best.ticker} +${(best.pnl_percent ?? 0).toFixed(2)}%` : "—", color: "text-bullish" },
          { label: "Worst", val: worst ? `${worst.ticker} ${(worst.pnl_percent ?? 0).toFixed(2)}%` : "—", color: "text-bearish" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3">
            <span className="block text-[10px] uppercase text-muted-foreground">{s.label}</span>
            <span className={`font-mono text-lg font-bold ${s.color}`}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* ── Positions table ── */}
      {isLoading ? (
        <div className="space-y-2 rounded-lg border border-border bg-card p-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-accent" />
          ))}
        </div>
      ) : positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-16">
          <p className="text-sm font-medium text-foreground">No open positions</p>
          <p className="mt-1 text-xs text-muted-foreground">Execute a trade from the Signals page to get started.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                {["Asset", "Strategy", "Entry", "Entry $", "Current $", "Value", "P&L ($)", "P&L (%)", "Signal", "Days", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => {
                const days = Math.floor((Date.now() - new Date(p.entry_date).getTime()) / 86400000);
                return (
                  <tr key={p.id} className="border-b border-border/50 transition-fast hover:bg-accent/30">
                    <td className="px-4 py-3 font-mono font-semibold text-foreground">{p.ticker}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.strategy_type ?? '—'}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{p.entry_date}</td>
                    <td className="px-4 py-3 font-mono">${p.entry_price}</td>
                    <td className="px-4 py-3 font-mono">${p.current_price ?? p.entry_price}</td>
                    <td className="px-4 py-3 font-mono">${(p.value ?? 0).toLocaleString()}</td>
                    <td className={`px-4 py-3 font-mono font-semibold ${(p.pnl_dollars ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {(p.pnl_dollars ?? 0) >= 0 ? "+" : ""}${(p.pnl_dollars ?? 0).toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 font-mono font-semibold ${(p.pnl_percent ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {(p.pnl_percent ?? 0) >= 0 ? "+" : ""}{(p.pnl_percent ?? 0).toFixed(2)}%
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs">
                        {p.signal_score ?? '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{days}d</td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => closePosition(p)}
                        disabled={isClosing}
                        className="rounded px-2 py-1 text-xs text-bearish transition-fast hover:bg-bearish/10 disabled:opacity-50"
                      >
                        Close
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      </div>
    </DashboardLayout>
  );
}

