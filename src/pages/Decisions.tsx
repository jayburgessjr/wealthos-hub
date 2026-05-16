import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { streamInvoke } from "@/lib/streamInvoke";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPositions, sandboxSignals, sandboxPortfolio, sandboxMacro } from "@/data/sandboxData";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef } from "react";
import { NavLink } from "react-router-dom";
import {
  TrendingUp, TrendingDown, Activity, Gauge, Sparkles,
  Loader2, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, DollarSign, BarChart3, Zap, Target, Brain,
  BookOpen, Calculator, FlaskConical, Leaf, PieChart,
  Cpu, Globe, Radar, Briefcase, Map, CalendarDays,
  ArrowRight, CircleDot, Shield, CalendarRange,
} from "lucide-react";
import GoalEngine from "@/components/dashboard/GoalEngine";

// ─── Types ─────────────────────────────────────────────────────────────────

type Urgency = "critical" | "high" | "medium";
type Side = "do" | "dont" | "watch";

interface Directive {
  id: string;
  ticker: string;
  company?: string;
  command: string;
  reasoning: string;
  tag: string;
  urgency: Urgency;
  side: Side;
  link: string;
  linkLabel: string;
  metric?: string;
}

interface CapitalOption {
  title: string;
  detail: string;
  link: string;
  icon: React.ElementType;
}

interface FeatureRec {
  label: string;
  reason: string;
  link: string;
  icon: React.ElementType;
}

// ─── Decision Engine ───────────────────────────────────────────────────────

function buildDirectives(
  positions: any[],
  signals: any[],
  portfolio: any,
  regime: string
): Directive[] {
  const existingTickers = new Set(positions.map((p) => p.ticker));
  const out: Directive[] = [];
  let seq = 0;

  // ── Portfolio-level ──────────────────────────────────────────────────────
  if (portfolio) {
    const availPct = portfolio.available_capital / portfolio.total_capital;
    const deployedPct = portfolio.deployed_capital / portfolio.total_capital;

    if (portfolio.win_rate < 50) {
      out.push({
        id: `port-${seq++}`, ticker: "STRATEGY", company: "Portfolio",
        command: "Stop trading — review your system",
        reasoning: `Win rate is ${portfolio.win_rate.toFixed(1)}%. Below 50% means the edge is gone or market conditions have changed. No new positions until you identify why.`,
        tag: `Win Rate ${portfolio.win_rate.toFixed(0)}%`, urgency: "critical", side: "dont",
        link: "/performance", linkLabel: "Review Performance",
        metric: `${portfolio.win_rate.toFixed(1)}% win rate`,
      });
    }

    if (deployedPct > 0.92) {
      out.push({
        id: `port-${seq++}`, ticker: "CAPITAL", company: "Portfolio",
        command: "Do not open new positions",
        reasoning: `${(deployedPct * 100).toFixed(0)}% of capital is deployed. You have no margin of safety. Wait for an exit before adding exposure.`,
        tag: "Fully Deployed", urgency: "high", side: "dont",
        link: "/positions", linkLabel: "Review Positions",
        metric: `${(deployedPct * 100).toFixed(0)}% deployed`,
      });
    }

    if (availPct > 0.5 && regime === "BULL") {
      out.push({
        id: `port-${seq++}`, ticker: "CASH", company: "Portfolio",
        command: "Deploy idle capital — market is bullish",
        reasoning: `$${portfolio.available_capital.toLocaleString()} (${(availPct * 100).toFixed(0)}%) is sitting in cash during a BULL regime. That is opportunity cost. Review top signals and size in.`,
        tag: "Underinvested", urgency: "high", side: "do",
        link: "/signals", linkLabel: "Browse Signals",
        metric: `$${portfolio.available_capital.toLocaleString()} available`,
      });
    }
  }

  // ── Open positions ───────────────────────────────────────────────────────
  for (const p of positions) {
    const score = p.signal_score || 0;
    const pnl = p.pnl_percent || 0;
    const company = p.company_name || p.ticker;

    if (pnl < -10) {
      out.push({
        id: `pos-${seq++}`, ticker: p.ticker, company,
        command: "Exit immediately — stop loss hit",
        reasoning: `Down ${Math.abs(pnl).toFixed(1)}%. This trade has moved against your thesis. Every point lower is avoidable loss. No hope trading.`,
        tag: `−${Math.abs(pnl).toFixed(1)}%`, urgency: "critical", side: "dont",
        link: "/positions", linkLabel: "Manage Position",
        metric: `P&L: ${pnl > 0 ? "+" : ""}${pnl.toFixed(1)}%`,
      });
    } else if (pnl < -5 && score < 55) {
      out.push({
        id: `pos-${seq++}`, ticker: p.ticker, company,
        command: "Reduce position size — signal weakening",
        reasoning: `Down ${Math.abs(pnl).toFixed(1)}% with signal score at ${score}. The setup is losing its edge. Cut size by 50% and let the rest ride to your stop.`,
        tag: `Score ${score}`, urgency: "high", side: "dont",
        link: "/positions", linkLabel: "Manage Position",
        metric: `Score: ${score} | P&L: ${pnl.toFixed(1)}%`,
      });
    } else if (pnl > 50 && score >= 80) {
      out.push({
        id: `pos-${seq++}`, ticker: p.ticker, company,
        command: "Take partial profits — lock in gains",
        reasoning: `Up ${pnl.toFixed(1)}% with score still at ${score}. Sell 30–50% to de-risk, trail stop on the rest. Don't give it all back.`,
        tag: `+${pnl.toFixed(1)}%`, urgency: "high", side: "do",
        link: "/positions", linkLabel: "Manage Position",
        metric: `P&L: +${pnl.toFixed(1)}%`,
      });
    } else if (pnl > 20 && score >= 70) {
      out.push({
        id: `pos-${seq++}`, ticker: p.ticker, company,
        command: "Trail your stop — protect gains",
        reasoning: `Up ${pnl.toFixed(1)}%. Move stop to breakeven minimum, ideally trail to the most recent pullback low. You are playing with house money.`,
        tag: `+${pnl.toFixed(1)}%`, urgency: "medium", side: "do",
        link: "/position-sizer", linkLabel: "Recalculate Stop",
        metric: `P&L: +${pnl.toFixed(1)}%`,
      });
    } else if (pnl >= 0 && score >= 70) {
      out.push({
        id: `pos-${seq++}`, ticker: p.ticker, company,
        command: "Hold — setup still valid",
        reasoning: `Score ${score} and P&L ${pnl > 0 ? "+" : ""}${pnl.toFixed(1)}%. The original thesis is intact. Nothing to do — let the trade work.`,
        tag: `Score ${score}`, urgency: "medium", side: "do",
        link: "/positions", linkLabel: "View Position",
        metric: `Score: ${score}`,
      });
    } else if (score < 40 && pnl < 5) {
      out.push({
        id: `pos-${seq++}`, ticker: p.ticker, company,
        command: "Exit — signal has collapsed",
        reasoning: `Signal score dropped to ${score}. When the thesis dies, the position dies. Close it and redeploy into stronger setups.`,
        tag: `Score ${score}`, urgency: "high", side: "dont",
        link: "/signals", linkLabel: "Find Replacement",
        metric: `Score: ${score}`,
      });
    }
  }

  // ── Fresh signals ────────────────────────────────────────────────────────
  for (const s of signals) {
    if (existingTickers.has(s.ticker)) continue;
    const score = s.signal_score || 0;
    const company = s.company_name || s.ticker;

    if (score >= 90) {
      out.push({
        id: `sig-${seq++}`, ticker: s.ticker, company,
        command: "Enter now — elite setup",
        reasoning: s.reasoning?.[0]
          ? `${s.reasoning[0]}. Score ${score}/100. This is a tier-1 setup. Size appropriately and set your stop before clicking buy.`
          : `Score ${score}/100 — highest conviction tier. Use Position Sizer to calculate correct size.`,
        tag: `Score ${score}`, urgency: "critical", side: "do",
        link: "/strategy-123", linkLabel: "Build Setup",
        metric: `Score: ${score}/100`,
      });
    } else if (score >= 80) {
      out.push({
        id: `sig-${seq++}`, ticker: s.ticker, company,
        command: "Enter — strong signal",
        reasoning: s.reasoning?.[0]
          ? `${s.reasoning[0]}. Score ${score}/100. Run the 1-2-3 setup to confirm entry point and define your risk.`
          : `Score ${score}/100. Check regime alignment, then size in with defined risk.`,
        tag: `Score ${score}`, urgency: "high", side: "do",
        link: "/signals", linkLabel: "View Signal",
        metric: `Score: ${score}/100`,
      });
    } else if (score >= 70) {
      out.push({
        id: `sig-${seq++}`, ticker: s.ticker, company,
        command: "Watch for entry trigger",
        reasoning: `Score ${score}/100 — setup is forming but not confirmed. Add to watchlist and wait for the P2 breakout on the 1-2-3 pattern.`,
        tag: `Score ${score}`, urgency: "medium", side: "watch",
        link: "/watchlist", linkLabel: "Add to Watchlist",
        metric: `Score: ${score}/100`,
      });
    }
  }

  // Sort: critical → high → medium, then do → watch → dont
  const urgencyOrder: Record<Urgency, number> = { critical: 0, high: 1, medium: 2 };
  out.sort((a, b) => urgencyOrder[a.urgency] - urgencyOrder[b.urgency]);

  return out;
}

function buildCapitalOptions(portfolio: any, regime: string): CapitalOption[] {
  if (!portfolio) return [];
  const avail = portfolio.available_capital;
  const availPct = (avail / portfolio.total_capital) * 100;
  const opts: CapitalOption[] = [];

  if (regime === "BULL" || regime === "SIDEWAYS") {
    opts.push({
      title: "Run the 1-2-3 Strategy",
      detail: `Use $${Math.round(avail * 0.02).toLocaleString()} (2% risk) per setup on your highest-scored signals right now.`,
      link: "/strategy-123", icon: Target,
    });
    opts.push({
      title: "Compound engine allocation",
      detail: `With $${avail.toLocaleString()} available, set a compounding target in the Compound Engine to model growth scenarios.`,
      link: "/compound", icon: Zap,
    });
  }

  if (regime === "BEAR") {
    opts.push({
      title: "Defensive allocation",
      detail: `BEAR regime. Keep ${Math.max(50, 100 - availPct).toFixed(0)}%+ in cash or short positions. Don't chase longs.`,
      link: "/market-regime", icon: TrendingDown,
    });
    opts.push({
      title: "Tax-loss harvesting",
      detail: `Review losing positions for tax harvesting opportunities. Turn losses into future tax savings.`,
      link: "/tax-harvesting", icon: Leaf,
    });
  }

  if (regime === "VOLATILE") {
    opts.push({
      title: "Run portfolio stress test",
      detail: `High VIX environment. Run the Quantum Engine to see Monte Carlo outcomes for your current allocation.`,
      link: "/quantum", icon: Cpu,
    });
    opts.push({
      title: "Reduce position sizes",
      detail: `In volatile markets, cut normal position size by 30–50%. Use the Position Sizer to recalculate all entries.`,
      link: "/position-sizer", icon: Calculator,
    });
  }

  if (avail > 0) {
    opts.push({
      title: "Strategy allocation review",
      detail: `Run the Strategy Allocator to see if your capital is optimally split across your active strategies.`,
      link: "/strategy-allocator", icon: PieChart,
    });
  }

  return opts.slice(0, 3);
}

function buildFeatureRecs(regime: string, positions: any[], portfolio: any): FeatureRec[] {
  const recs: FeatureRec[] = [];

  recs.push({
    label: "1-2-3 Strategy",
    reason: "Identify P1 → P2 → P3 setups on your current watchlist tickers.",
    link: "/strategy-123", icon: Target,
  });

  if (positions.length > 0) {
    recs.push({
      label: "Position Sizer",
      reason: "Recalculate correct share count and risk for each open position.",
      link: "/position-sizer", icon: Calculator,
    });
  }

  recs.push({
    label: "Market Regime",
    reason: `Current regime: ${regime}. Understand the macro context driving all price action.`,
    link: "/market-regime", icon: Globe,
  });

  if (regime === "BULL" || regime === "SIDEWAYS") {
    recs.push({
      label: "Signals",
      reason: "Check top-scored AI signals for new entry opportunities.",
      link: "/signals", icon: Radar,
    });
    recs.push({
      label: "Compound Engine",
      reason: "Model how consistent position sizing compounds your capital over time.",
      link: "/compound", icon: Zap,
    });
  }

  if (regime === "VOLATILE") {
    recs.push({
      label: "Quantum Engine",
      reason: "Run Monte Carlo simulation to stress-test your portfolio in a volatile regime.",
      link: "/quantum", icon: Cpu,
    });
  }

  if (regime === "BEAR") {
    recs.push({
      label: "Tax Harvesting",
      reason: "Convert unrealized losses into tax alpha while holding through the bear.",
      link: "/tax-harvesting", icon: Leaf,
    });
    recs.push({
      label: "Performance",
      reason: "Analyse win rate and drawdown metrics — key in a bear market.",
      link: "/performance", icon: BarChart3,
    });
  }

  recs.push({
    label: "Trading Journal",
    reason: "Log every decision you make today for pattern review next week.",
    link: "/trading-journal", icon: BookOpen,
  });

  recs.push({
    label: "P&L Calendar",
    reason: "See which days and weeks produce the most/least edge for your style.",
    link: "/pnl-calendar", icon: CalendarDays,
  });

  return recs.slice(0, 6);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function getRegimeLabel(macro: any): string {
  if (!macro) return "UNKNOWN";
  const { composite, vix } = macro;
  if (vix?.value > 25) return "VOLATILE";
  if (composite > 65) return "BULL";
  if (composite < 35) return "BEAR";
  return "SIDEWAYS";
}

const REGIME_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ElementType; desc: string }> = {
  BULL:     { color: "text-bullish", bg: "bg-bullish/10", border: "border-bullish/25", icon: TrendingUp,   desc: "Risk-on. Favor longs, size up winners." },
  BEAR:     { color: "text-bearish", bg: "bg-bearish/10", border: "border-bearish/25", icon: TrendingDown,  desc: "Risk-off. Reduce exposure, hold cash." },
  VOLATILE: { color: "text-watch",   bg: "bg-watch/10",   border: "border-watch/25",   icon: Activity,     desc: "High VIX. Cut size, manage risk tightly." },
  SIDEWAYS: { color: "text-primary", bg: "bg-primary/10", border: "border-primary/25", icon: Gauge,        desc: "Neutral. Wait for directional confirmation." },
  UNKNOWN:  { color: "text-muted-foreground", bg: "bg-muted/20", border: "border-border", icon: Gauge, desc: "Loading market regime..." },
};

const URGENCY_STYLE: Record<Urgency, { border: string; bg: string; dot: string; accent: string }> = {
  critical: { border: "border-bearish/30", bg: "bg-bearish/5",  dot: "bg-bearish",               accent: "border-l-4 border-l-bearish" },
  high:     { border: "border-border",     bg: "bg-card",       dot: "bg-primary",                accent: "border-l-4 border-l-primary" },
  medium:   { border: "border-border/50",  bg: "bg-card/60",    dot: "bg-muted-foreground/40",    accent: "border-l-4 border-l-muted-foreground/30" },
};

const SIDE_LABEL: Record<Side, { text: string; color: string; accentOverride?: string }> = {
  do:    { text: "ACT",   color: "text-bullish", accentOverride: "border-l-bullish" },
  dont:  { text: "AVOID", color: "text-bearish", accentOverride: "border-l-bearish" },
  watch: { text: "WATCH", color: "text-watch",   accentOverride: "border-l-watch" },
};


// ─── Stat Card ─────────────────────────────────────────────────────────────

function StatCard({
  label, value, sub, icon: Icon, accent, custom,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; accent: string; custom?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-4 flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${accent}`} />
        <span className="text-xs uppercase tracking-widest text-muted-foreground">{label}</span>
      </div>
      {custom ?? (
        <>
          <div className={`font-display text-[22px] font-extrabold leading-none ${accent}`}>{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </>
      )}
    </div>
  );
}

// ─── Directive Card ────────────────────────────────────────────────────────

function DirectiveCard({ item, index }: { item: Directive; index: number }) {
  const u = URGENCY_STYLE[item.urgency];
  const s = SIDE_LABEL[item.side];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={`rounded-xl border ${u.border} ${u.bg} border-l-4 ${s.accentOverride ?? u.accent} p-4 flex flex-col gap-3 overflow-hidden`}
    >
      {/* Top row */}
      <div className="flex items-start gap-3">
        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${u.dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-black uppercase tracking-[1.5px] ${s.color}`}>
              {s.text}
            </span>
            <span className="font-display text-[15px] font-black text-foreground">{item.ticker}</span>
            {item.company && item.company !== item.ticker && (
              <span className="text-xs text-muted-foreground truncate">{item.company}</span>
            )}
            <span className="ml-auto text-xs uppercase tracking-widest text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5 whitespace-nowrap">
              {item.tag}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground leading-snug">{item.command}</p>
        </div>
      </div>

      {/* Reasoning */}
      <p className="text-sm leading-relaxed text-muted-foreground pl-5">
        {item.reasoning}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pl-5">
        {item.metric && (
          <span className="text-xs text-muted-foreground/60">{item.metric}</span>
        )}
        <NavLink
          to={item.link}
          className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline whitespace-nowrap"
        >
          {item.linkLabel} <ChevronRight className="h-3 w-3" />
        </NavLink>
      </div>
    </motion.div>
  );
}

// ─── Regime Plays ─────────────────────────────────────────────────────────

interface RegimePlay {
  ticker: string;
  name: string;
  action: "BUY" | "SELL" | "ADD" | "ROTATE" | "HOLD";
  thesis: string;
  type: "stock" | "etf" | "sector" | "theme";
  conviction: "high" | "medium";
}

const REGIME_PLAYS: Record<string, RegimePlay[]> = {
  BULL: [
    { ticker: "QQQ",   name: "Invesco NASDAQ-100 ETF",     action: "BUY",    thesis: "BULL regime favors momentum. QQQ captures the top 100 non-financial NASDAQ companies — tech, semi, AI. Core long in risk-on markets.", type: "etf", conviction: "high" },
    { ticker: "NVDA",  name: "NVIDIA Corporation",          action: "BUY",    thesis: "AI infrastructure buildout is the dominant secular trend. NVDA is the picks-and-shovels play — data center GPU demand is not slowing.", type: "stock", conviction: "high" },
    { ticker: "SMH",   name: "VanEck Semiconductor ETF",    action: "ADD",    thesis: "Semiconductors lead the market cycle. Broad exposure via SMH captures NVDA, AMD, AVGO, TSM — diversified chip upside in a bull run.", type: "etf", conviction: "high" },
    { ticker: "AMZN",  name: "Amazon.com Inc.",             action: "BUY",    thesis: "Cloud (AWS) + AI + retail flywheel. AMZN benefits from every dollar of AI capex through cloud infrastructure. Compounding moat.", type: "stock", conviction: "medium" },
    { ticker: "IWM",   name: "iShares Russell 2000 ETF",    action: "ADD",    thesis: "Small caps outperform in late bull phases and rate-cut cycles. IWM gives broad exposure to 2,000 domestic growth companies.", type: "etf", conviction: "medium" },
    { ticker: "META",  name: "Meta Platforms Inc.",         action: "BUY",    thesis: "Ad revenue leverage + AI Llama + Ray-Ban AI glasses. Meta is executing across every product line. Cheapest mega-cap on earnings growth.", type: "stock", conviction: "medium" },
  ],
  BEAR: [
    { ticker: "GLD",   name: "SPDR Gold Shares ETF",        action: "BUY",    thesis: "Gold is the premier safe haven in a bear market. Central bank buying + de-dollarization + real yield decline = sustained bid. Non-correlated to equities.", type: "etf", conviction: "high" },
    { ticker: "VYM",   name: "Vanguard High Dividend ETF",  action: "ROTATE", thesis: "Rotate from growth to dividend income. VYM holds 400+ high-yield companies — defensive sectors like utilities, consumer staples, financials dominate.", type: "etf", conviction: "high" },
    { ticker: "TLT",   name: "iShares 20+ Year Treasury",   action: "BUY",    thesis: "Long duration Treasuries rally when the Fed pivots or recession fears peak. TLT is the textbook bear market bond play.", type: "etf", conviction: "high" },
    { ticker: "BRK.B", name: "Berkshire Hathaway B",        action: "ADD",    thesis: "Buffett holds $160B+ in cash — outperforms in downturns as they deploy capital. Defensive mega-cap with real earnings and zero debt stress.", type: "stock", conviction: "medium" },
    { ticker: "SCHD",  name: "Schwab US Dividend Equity",   action: "ROTATE", thesis: "Quality dividend screen (5yr growth, payout ratio, yield) filters for companies that survive bear markets. Lower volatility with real income.", type: "etf", conviction: "medium" },
    { ticker: "SH",    name: "ProShares Short S&P500",      action: "BUY",    thesis: "Simple 1x inverse SPY. If you believe the decline continues, SH is the cleanest hedge — no leverage, no bleed from daily compounding.", type: "etf", conviction: "medium" },
  ],
  VOLATILE: [
    { ticker: "IEF",   name: "iShares 7-10 Year Treasury",  action: "ROTATE", thesis: "Intermediate bonds reduce portfolio volatility without the duration risk of TLT. Parking capital here while waiting for clarity.", type: "etf", conviction: "high" },
    { ticker: "GLD",   name: "SPDR Gold Shares ETF",        action: "ADD",    thesis: "High VIX periods see gold outperform as fear-driven capital seeks non-correlated assets. Add to existing position or initiate.", type: "etf", conviction: "high" },
    { ticker: "USMV",  name: "iShares MSCI Min Vol USA",    action: "ROTATE", thesis: "Minimum volatility factor ETF. Systematic tilt toward lower-beta names in tech, healthcare, consumer staples. Smoother ride in choppy markets.", type: "etf", conviction: "high" },
    { ticker: "CASH",  name: "T-Bills / Money Market",      action: "HOLD",   thesis: "5%+ annualized in money market funds with zero duration risk. In volatile regimes, cash is a position — not a failure.", type: "theme", conviction: "medium" },
    { ticker: "VZ",    name: "Verizon Communications",      action: "ADD",    thesis: "Telco with 6%+ dividend yield, regulated revenues, and essentially zero economic cyclicality. Classic 'hide in plain sight' defensive.", type: "stock", conviction: "medium" },
  ],
  SIDEWAYS: [
    { ticker: "SCHD",  name: "Schwab US Dividend Equity",   action: "BUY",    thesis: "Sideways markets reward income over growth. SCHD's dividend-growth screen selects companies returning cash to shareholders while waiting for direction.", type: "etf", conviction: "high" },
    { ticker: "O",     name: "Realty Income Corp.",         action: "ADD",    thesis: "Monthly dividend REIT with 30-year track record of increases. Commercial real estate with triple-net leases provides steady income in flat markets.", type: "stock", conviction: "high" },
    { ticker: "JPM",   name: "JPMorgan Chase & Co.",        action: "BUY",    thesis: "Best-in-class bank. In sideways/rate-stable environments, banks earn spread income. JPM's diversified model (IB + retail + wealth) is all-weather.", type: "stock", conviction: "medium" },
    { ticker: "JEPI",  name: "JPMorgan Equity Premium",     action: "BUY",    thesis: "Covered call strategy on S&P 500. Generates 7-9% annual income via options premium in low-momentum markets. Designed exactly for sideways conditions.", type: "etf", conviction: "high" },
    { ticker: "MO",    name: "Altria Group Inc.",           action: "ADD",    thesis: "8%+ dividend yield, defensive consumer staples, pricing power. Tobacco demand is inelastic — revenue holds through any macro regime.", type: "stock", conviction: "medium" },
  ],
};

const ACTION_CFG = {
  BUY:    { color: "text-bullish", bg: "bg-bullish/10 border-bullish/20",   border: "border-l-bullish" },
  ADD:    { color: "text-bullish", bg: "bg-bullish/5 border-bullish/15",    border: "border-l-bullish" },
  ROTATE: { color: "text-neutral", bg: "bg-neutral/10 border-neutral/20",   border: "border-l-neutral" },
  SELL:   { color: "text-bearish", bg: "bg-bearish/10 border-bearish/20",   border: "border-l-bearish" },
  HOLD:   { color: "text-watch",   bg: "bg-watch/5 border-watch/15",        border: "border-l-watch" },
};

// ─── Economic Events ───────────────────────────────────────────────────────

const ECONOMIC_EVENTS = [
  { date: "May 20", label: "FOMC Minutes", full: "Minutes from Apr 29-30 Meeting", impact: "medium" as const, type: "fed" as const },
  { date: "May 28", label: "GDP", full: "Q1 GDP Second Estimate", impact: "medium" as const, type: "macro" as const },
  { date: "Jun 5", label: "NFP", full: "Non-Farm Payrolls (May)", impact: "high" as const, type: "macro" as const },
  { date: "Jun 11", label: "CPI", full: "Consumer Price Index (May)", impact: "high" as const, type: "macro" as const },
  { date: "Jun 17–18", label: "FOMC", full: "Federal Reserve Rate Decision", impact: "critical" as const, type: "fed" as const },
  { date: "Jul 3", label: "NFP", full: "Non-Farm Payrolls (Jun)", impact: "high" as const, type: "macro" as const },
  { date: "Jul 15", label: "CPI", full: "Consumer Price Index (Jun)", impact: "high" as const, type: "macro" as const },
  { date: "Jul 29–30", label: "FOMC", full: "Federal Reserve Rate Decision", impact: "critical" as const, type: "fed" as const },
];

const OPTION_EXPIRIES = [
  { date: "May 15, 2026", label: "Monthly Expiry", type: "today" as const },
  { date: "Jun 19, 2026", label: "Monthly + Quarterly (Triple Witching)", type: "triple" as const },
  { date: "Jul 17, 2026", label: "Monthly Expiry", type: "monthly" as const },
  { date: "Aug 21, 2026", label: "Monthly Expiry", type: "monthly" as const },
  { date: "Sep 18, 2026", label: "Monthly + Quarterly (Triple Witching)", type: "triple" as const },
  { date: "Jan 16, 2027", label: "LEAPS Expiry", type: "leaps" as const },
];

// ─── Main Page ─────────────────────────────────────────────────────────────

export default function Decisions() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [briefText, setBriefText] = useState("");
  const [isBriefing, setIsBriefing] = useState(false);
  const [briefGenerated, setBriefGenerated] = useState(false);
  const [decisionTab, setDecisionTab] = useState<"today" | "risk" | "calendar" | "plays">("today");
  const briefRef = useRef<HTMLDivElement>(null);

  // ── Data fetching ──────────────────────────────────────────────────────
  const { data: portfolio } = useQuery({
    queryKey: ["portfolio", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase.from("portfolios").select("*").eq("user_id", user!.id).single();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase.from("positions").select("*").eq("user_id", user!.id).eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const { data: signals = [] } = useQuery({
    queryKey: ["signals", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals;
      const { data } = await supabase.from("signals").select("*").order("signal_score", { ascending: false }).limit(10);
      return data ?? [];
    },
  });

  const { data: macroData } = useQuery({
    queryKey: ["regime-decisions"],
    queryFn: async () => {
      if (isDemoMode) return sandboxMacro;
      const { data, error } = await supabase.functions.invoke("generate-signals", { body: { mode: "macro" } });
      if (error) throw error;
      return data?.macro ?? null;
    },
    enabled: !isDemoMode || isDemoMode,
    staleTime: 5 * 60 * 1000,
  });

  // ── Derived state ──────────────────────────────────────────────────────
  const regime = getRegimeLabel(macroData);
  const regimeCfg = REGIME_CFG[regime];
  const RegimeIcon = regimeCfg.icon;

  const directives = buildDirectives(positions, signals, portfolio, regime);
  const doItems = directives.filter((d) => d.side === "do");
  const dontItems = directives.filter((d) => d.side === "dont");
  const watchItems = directives.filter((d) => d.side === "watch");
  const criticalCount = directives.filter((d) => d.urgency === "critical").length;
  const topCritical = directives.find((d) => d.urgency === "critical");

  const capitalOptions = buildCapitalOptions(portfolio, regime);
  const featureRecs = buildFeatureRecs(regime, positions, portfolio);

  const availPct = portfolio
    ? ((portfolio.available_capital / portfolio.total_capital) * 100).toFixed(0)
    : "—";

  const deployedPct = portfolio ? portfolio.deployed_capital / portfolio.total_capital : 0;
  const availPctNum = portfolio ? portfolio.available_capital / portfolio.total_capital : 0;
  const positionsAtRisk = positions.filter((p: any) => p.pnl_percent < -5 || p.signal_score < 50);

  // ── AI Session Brief ───────────────────────────────────────────────────
  const generateBrief = async () => {
    setIsBriefing(true);
    setBriefText("");
    setBriefGenerated(true);
    setTimeout(() => briefRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);

    const positionSummary = positions.slice(0, 5).map((p: any) =>
      `- ${p.ticker}: ${p.pnl_percent > 0 ? "+" : ""}${p.pnl_percent?.toFixed(1)}% P&L, score ${p.signal_score}`
    ).join("\n") || "No open positions";

    const signalSummary = signals.slice(0, 3).map((s: any) =>
      `- ${s.ticker} (${s.company_name}): score ${s.signal_score}/100`
    ).join("\n") || "No active signals";

    const prompt = `You are a senior portfolio manager delivering a morning decision brief for a personal hedge fund operator.

Current market context:
- Market regime: ${regime}${macroData?.composite ? ` (composite score: ${macroData.composite})` : ""}
${macroData?.vix ? `- VIX: ${macroData.vix.value} (${macroData.vix.label})` : ""}

Portfolio status:
- Total capital: $${portfolio?.total_capital?.toLocaleString() ?? "unknown"}
- Available cash: $${portfolio?.available_capital?.toLocaleString() ?? "unknown"} (${availPct}%)
- Win rate: ${portfolio?.win_rate?.toFixed(1) ?? "unknown"}%
- Open positions: ${positions.length}

Open positions:
${positionSummary}

Top signals available:
${signalSummary}

Priority issues identified: ${criticalCount} critical action(s) requiring immediate attention.

Write a concise 4-5 sentence session brief that covers: (1) the single most important thing to do right now given the regime and positions, (2) whether to be adding or reducing exposure, (3) which feature or tool in the platform to use first today, and (4) the key risk to watch. Be direct and specific — no hedging, no fluff. Write as a professional, not a chatbot.`;

    await streamInvoke(
      "ai-advisor",
      { messages: [{ role: "user", content: prompt }] },
      {
        onDelta: (delta) => setBriefText((prev) => prev + delta),
        onDone: () => setIsBriefing(false),
        onError: (msg) => { setBriefText(msg); setIsBriefing(false); },
      }
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-bullish opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-bullish" />
              </span>
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Live intelligence feed</span>
            </div>
            <h1 className="font-display text-[28px] font-extrabold leading-none tracking-tight">
              Decision <span className="text-primary">Hub</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Every decision you need to make today — ranked by urgency, backed by context.
            </p>
          </div>

          <button
            onClick={generateBrief}
            disabled={isBriefing}
            className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold uppercase tracking-wider transition-all ${
              isBriefing
                ? "border-primary/30 bg-primary/5 text-primary/60 cursor-not-allowed"
                : "border-primary/40 bg-primary/8 text-primary hover:bg-primary/15 hover:border-primary/60"
            }`}
          >
            {isBriefing
              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating brief...</>
              : <><Sparkles className="h-3.5 w-3.5" /> {briefGenerated ? "Regenerate Brief" : "Generate Session Brief"}</>}
          </button>
        </div>

        {/* ── Tab Switcher ───────────────────────────────────────────────── */}
        <div className="border border-border bg-card rounded-xl p-1 flex gap-1 w-fit">
          {(["today", "plays", "risk", "calendar"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDecisionTab(tab)}
              className={`rounded-lg px-4 py-2 text-[13px] font-medium transition-colors capitalize ${
                decisionTab === tab
                  ? "bg-foreground/[0.08] text-foreground"
                  : "text-foreground/40 hover:text-foreground/70"
              }`}
            >
              {tab === "today" ? "Today" : tab === "plays" ? "Plays" : tab === "risk" ? "Risk" : "Calendar"}
            </button>
          ))}
        </div>

        {/* ── Today Tab ──────────────────────────────────────────────────── */}
        {decisionTab === "today" && (
          <>
        {/* ── Goal Engine ────────────────────────────────────────────────── */}
        <GoalEngine currentCapital={portfolio?.total_capital ?? 0} />

        {/* ── Stat Cards ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            label="Market Regime"
            value={regime}
            sub={macroData?.composite ? `Composite: ${macroData.composite}` : ""}
            icon={RegimeIcon}
            accent={regimeCfg.color}
            custom={
              <div className="flex flex-col gap-1">
                <div className={`font-display text-[20px] font-extrabold leading-none ${regimeCfg.color}`}>{regime}</div>
                <div className="text-xs text-muted-foreground leading-snug">{regimeCfg.desc}</div>
                {macroData?.vix && (
                  <div className="text-xs text-muted-foreground">VIX: {macroData.vix.value}</div>
                )}
              </div>
            }
          />
          <StatCard
            label="Available Capital"
            value={portfolio ? `$${portfolio.available_capital.toLocaleString()}` : "—"}
            sub={portfolio ? `${availPct}% of portfolio` : "No portfolio data"}
            icon={DollarSign}
            accent="text-primary"
          />
          <StatCard
            label="Portfolio Health"
            value={portfolio ? `${portfolio.win_rate.toFixed(1)}%` : "—"}
            sub={portfolio ? `${positions.length} open · ${portfolio.total_trades} total trades` : ""}
            icon={BarChart3}
            accent={portfolio?.win_rate >= 55 ? "text-bullish" : portfolio?.win_rate >= 45 ? "text-watch" : "text-bearish"}
          />
          <StatCard
            label="Priority Actions"
            value={`${directives.length}`}
            sub={`${criticalCount} critical · ${doItems.length} to execute`}
            icon={Zap}
            accent={criticalCount > 0 ? "text-bearish" : "text-bullish"}
          />
        </div>

        {/* ── Critical alert banner ──────────────────────────────────────── */}
        <AnimatePresence>
          {topCritical && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-4 rounded-xl border border-bearish/35 bg-bearish/8 px-5 py-4"
            >
              <AlertTriangle className="h-5 w-5 shrink-0 text-bearish" />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-widest text-bearish/70 mb-0.5">Most Urgent Right Now</p>
                <p className="text-sm font-bold text-foreground">
                  <span className="text-bearish">{topCritical.ticker}</span> — {topCritical.command}
                </p>
              </div>
              <NavLink
                to={topCritical.link}
                className="shrink-0 flex items-center gap-1.5 rounded-lg border border-bearish/30 bg-bearish/15 px-3 py-2 text-xs font-semibold text-bearish hover:bg-bearish/25 transition-colors whitespace-nowrap"
              >
                {topCritical.linkLabel} <ArrowRight className="h-3 w-3" />
              </NavLink>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── AI Session Brief ─────────────────────────────────────────── */}
        <AnimatePresence>
          {(briefText || isBriefing) && (
            <motion.div
              ref={briefRef}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs uppercase tracking-[1px] text-primary">AI Session Brief</span>
                  {isBriefing && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground ml-auto" />}
                </div>
                {briefText ? (
                  <p className="text-sm leading-relaxed text-foreground">{briefText}</p>
                ) : (
                  <div className="flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-primary"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                      />
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Priority Actions ──────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <CircleDot className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Priority Actions</h2>
            <span className="text-xs text-muted-foreground">{directives.length} total</span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-bullish">● DO ({doItems.length})</span>
              <span className="text-xs text-bearish">● AVOID ({dontItems.length})</span>
              <span className="text-xs text-watch">● WATCH ({watchItems.length})</span>
            </div>
          </div>

          {directives.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 px-5 py-8 justify-center">
              <CheckCircle2 className="h-4 w-4 text-bullish" />
              <p className="text-sm text-muted-foreground">No actions required. Portfolio and signals are clean.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {directives.map((item, i) => (
                <DirectiveCard key={item.id} item={item} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* ── Capital Deployment ────────────────────────────────────────── */}
        {capitalOptions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <DollarSign className="h-4 w-4 text-primary" />
              <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Capital Deployment</h2>
              {portfolio && (
                <span className="text-xs text-muted-foreground">
                  ${portfolio.available_capital.toLocaleString()} available · {regime} regime
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {capitalOptions.map((opt, i) => {
                const Icon = opt.icon;
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <span className="text-sm font-bold text-foreground">{opt.title}</span>
                    </div>
                    <p className="text-xs leading-relaxed text-muted-foreground flex-1">{opt.detail}</p>
                    <NavLink
                      to={opt.link}
                      className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                    >
                      Go there <ChevronRight className="h-3 w-3" />
                    </NavLink>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Feature Finder ────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Tools For Today</h2>
            <span className="text-xs text-muted-foreground">Based on {regime} regime + your portfolio</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {featureRecs.map((rec, i) => {
              const Icon = rec.icon;
              return (
                <motion.div
                  key={rec.link}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <NavLink
                    to={rec.link}
                    className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-all"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent group-hover:bg-primary/10 transition-colors">
                      <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{rec.label}</p>
                      <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{rec.reason}</p>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                  </NavLink>
                </motion.div>
              );
            })}
          </div>
        </div>

          </>
        )}

        {/* ── Risk Tab ───────────────────────────────────────────────────── */}
        {decisionTab === "risk" && (
          <>
            {/* Portfolio Risk Overview */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Deployed Capital"
                value={portfolio ? `${(deployedPct * 100).toFixed(0)}%` : "—"}
                sub={portfolio ? `$${portfolio.deployed_capital.toLocaleString()} in market` : ""}
                icon={BarChart3}
                accent={deployedPct > 0.8 ? "text-watch" : "text-primary"}
              />
              <StatCard
                label="Cash Buffer"
                value={portfolio ? `${(availPctNum * 100).toFixed(0)}%` : "—"}
                sub={portfolio ? `$${portfolio.available_capital.toLocaleString()} available` : ""}
                icon={DollarSign}
                accent={availPctNum > 0.2 ? "text-bullish" : availPctNum >= 0.1 ? "text-watch" : "text-bearish"}
              />
              <StatCard
                label="Win Rate"
                value={portfolio ? `${portfolio.win_rate.toFixed(1)}%` : "—"}
                sub={portfolio ? `${portfolio.total_trades} total trades` : ""}
                icon={Target}
                accent={portfolio?.win_rate >= 55 ? "text-bullish" : portfolio?.win_rate >= 45 ? "text-watch" : "text-bearish"}
              />
              <StatCard
                label="Positions at Risk"
                value={`${positionsAtRisk.length}`}
                sub={positionsAtRisk.length > 0 ? "P&L < −5% or score < 50" : "All positions healthy"}
                icon={Shield}
                accent={positionsAtRisk.length > 0 ? "text-bearish" : "text-bullish"}
              />
            </div>

            {/* Position Risk Assessment */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Shield className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Position Risk Assessment</h2>
              </div>
              {positions.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 px-5 py-8 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-bullish" />
                  <p className="text-sm text-muted-foreground">No open positions to assess</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((p: any) => {
                    const pnl = p.pnl_percent || 0;
                    const score = p.signal_score || 0;
                    const isCritical = pnl < -10;
                    const isWarning = !isCritical && (pnl < -5 || score < 50);
                    const isWatch = !isCritical && !isWarning && score < 70;
                    const riskLabel = isCritical ? "CRITICAL" : isWarning ? "WARNING" : isWatch ? "WATCH" : "HEALTHY";
                    const riskColor = isCritical ? "text-bearish" : isWarning ? "text-watch" : isWatch ? "text-primary" : "text-bullish";
                    const riskBg = isCritical ? "bg-bearish/10 border-bearish/25" : isWarning ? "bg-watch/10 border-watch/25" : isWatch ? "bg-primary/5 border-border" : "bg-bullish/5 border-border";
                    return (
                      <div key={p.id ?? p.ticker} className={`rounded-xl border ${riskBg} px-4 py-3 flex items-center gap-4`}>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-display font-black text-[15px] text-foreground">{p.ticker}</span>
                            <span className="text-xs text-muted-foreground">{p.company_name || p.ticker}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-xs font-bold ${pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                            {pnl >= 0 ? "+" : ""}{pnl.toFixed(1)}%
                          </span>
                          <span className="text-xs text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">Score {score}</span>
                          <span className={`text-xs font-black uppercase tracking-wide ${riskColor}`}>{riskLabel}</span>
                          <NavLink
                            to="/positions"
                            className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                          >
                            → Manage
                          </NavLink>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Risk Tools */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Zap className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Risk Tools</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { title: "Position Sizer", detail: "Calculate correct share count and stop placement for each position.", link: "/position-sizer", icon: Calculator },
                  { title: "Quantum Engine", detail: "Monte Carlo simulation to stress-test your portfolio allocation.", link: "/quantum", icon: Cpu },
                  { title: "Performance Review", detail: "Win rate, drawdown, and edge analysis across all your trades.", link: "/performance", icon: BarChart3 },
                ].map((opt, i) => {
                  const Icon = opt.icon;
                  return (
                    <NavLink
                      key={opt.link}
                      to={opt.link}
                      className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-3 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{opt.title}</span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground flex-1">{opt.detail}</p>
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                        Go there <ChevronRight className="h-3 w-3" />
                      </span>
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ── Calendar Tab ───────────────────────────────────────────────── */}
        {decisionTab === "calendar" && (
          <>
            {/* Positions at Earnings Risk */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CalendarRange className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Positions at Earnings Risk</h2>
              </div>
              <p className="text-sm text-muted-foreground -mt-1">Your positions may have upcoming earnings events. Review before they arrive.</p>
              {positions.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/40 px-5 py-8 justify-center">
                  <CheckCircle2 className="h-4 w-4 text-bullish" />
                  <p className="text-sm text-muted-foreground">No open positions to track</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {positions.map((p: any) => (
                    <div key={p.id ?? p.ticker} className="rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <span className="font-display font-black text-[15px] text-foreground">{p.ticker}</span>
                        <span className="ml-2 text-xs text-muted-foreground">{p.company_name || p.ticker}</span>
                      </div>
                      <NavLink
                        to="/earnings-calendar"
                        className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline whitespace-nowrap"
                      >
                        → Check Earnings
                      </NavLink>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Economic Calendar */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Globe className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Economic Calendar</h2>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {ECONOMIC_EVENTS.map((ev, i) => {
                  const impactColor = ev.impact === "critical" ? "text-bearish bg-bearish/10" : ev.impact === "high" ? "text-watch bg-watch/10" : "text-primary bg-primary/10";
                  const typeBadge = ev.type === "fed" ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted/40";
                  return (
                    <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i < ECONOMIC_EVENTS.length - 1 ? "border-b border-border/50" : ""}`}>
                      <div className="w-[72px] shrink-0">
                        <span className="text-xs font-bold text-foreground bg-muted/40 rounded px-2 py-1 whitespace-nowrap">{ev.date}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-foreground">{ev.label}</span>
                          <span className="text-xs text-muted-foreground">{ev.full}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${typeBadge}`}>
                          {ev.type === "fed" ? "FED" : "MACRO"}
                        </span>
                        <span className={`text-xs font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${impactColor}`}>
                          {ev.impact}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Option Expiry Dates */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Option Expiry Dates</h2>
              </div>
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                {OPTION_EXPIRIES.map((exp, i) => {
                  const isToday = exp.type === "today";
                  const isTriple = exp.type === "triple";
                  const typeBadge = isToday ? "text-bearish bg-bearish/10" : isTriple ? "text-watch bg-watch/10" : exp.type === "leaps" ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted/40";
                  const typeLabel = isToday ? "TODAY" : isTriple ? "TRIPLE WITCH" : exp.type === "leaps" ? "LEAPS" : "MONTHLY";
                  return (
                    <div key={i} className={`flex items-center gap-4 px-4 py-3 ${i < OPTION_EXPIRIES.length - 1 ? "border-b border-border/50" : ""} ${isToday ? "bg-bearish/5" : ""}`}>
                      <div className="w-[120px] shrink-0">
                        <span className={`text-xs font-bold rounded px-2 py-1 whitespace-nowrap ${isToday ? "text-bearish" : "text-foreground bg-muted/40"}`}>
                          {exp.date}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0 text-sm text-muted-foreground">{exp.label}</div>
                      <span className={`text-xs font-bold uppercase tracking-wide rounded px-1.5 py-0.5 shrink-0 ${typeBadge}`}>
                        {typeLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Calendar Tools</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: "Earnings Calendar", reason: "Track upcoming earnings for your watchlist tickers.", link: "/earnings-calendar", icon: CalendarDays },
                  { label: "Heat Map", reason: "Visualise sector momentum and rotation in real time.", link: "/heat-map", icon: Map },
                  { label: "Macro Dashboard", reason: "Monitor macro indicators driving the current regime.", link: "/macro", icon: Globe },
                ].map((rec) => {
                  const Icon = rec.icon;
                  return (
                    <NavLink
                      key={rec.link}
                      to={rec.link}
                      className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 hover:border-primary/40 hover:bg-accent/30 transition-all"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent group-hover:bg-primary/10 transition-colors">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">{rec.label}</p>
                        <p className="text-xs leading-relaxed text-muted-foreground mt-0.5">{rec.reason}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0 mt-0.5" />
                    </NavLink>
                  );
                })}
              </div>
            </div>
          </>
        )}

        {/* ══ PLAYS TAB ══════════════════════════════════════════════════════ */}
        {decisionTab === "plays" && (
          <div className="space-y-6">

            {/* Signal-based plays from your actual data */}
            {(signals.filter(s => s.signal_score >= 70).length > 0 || positions.length > 0) && (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <Target className="h-4 w-4 text-primary" />
                  <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Your Specific Moves</h2>
                  <span className="text-xs text-muted-foreground">Based on your signals + positions</span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {signals.filter(s => s.signal_score >= 70).slice(0, 4).map((s, i) => {
                    const action = s.signal_score >= 90 ? "BUY" : s.signal_score >= 80 ? "BUY" : "ADD";
                    const cfg = ACTION_CFG[action];
                    return (
                      <motion.div
                        key={s.ticker}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={`rounded-xl border border-l-4 ${cfg.bg} ${cfg.border} p-4 flex flex-col gap-2`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>{action}</span>
                          <span className="font-display text-[18px] font-black text-foreground">{s.ticker}</span>
                          <span className="text-xs text-muted-foreground truncate flex-1">{s.company_name}</span>
                          <span className="text-xs font-bold bg-muted/40 rounded px-1.5 py-0.5 text-muted-foreground whitespace-nowrap">Score {s.signal_score}</span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {s.reasoning?.[0] ?? `Signal score ${s.signal_score}/100. Use the Position Sizer to calculate correct size before entering. Set your stop before clicking buy.`}
                        </p>
                        <div className="flex items-center gap-2 pt-1">
                          <NavLink to="/position-sizer" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                            Size it <ChevronRight className="h-3 w-3" />
                          </NavLink>
                          <span className="text-muted-foreground/30">·</span>
                          <NavLink to="/strategy-123" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                            Build setup <ChevronRight className="h-3 w-3" />
                          </NavLink>
                        </div>
                      </motion.div>
                    );
                  })}
                  {positions.filter(p => p.pnl_percent < -5 || p.signal_score < 50).map((p, i) => {
                    const action = p.pnl_percent < -10 ? "SELL" : "SELL";
                    const cfg = ACTION_CFG["SELL"];
                    return (
                      <motion.div
                        key={p.ticker}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: (signals.filter(s => s.signal_score >= 70).length + i) * 0.05 }}
                        className={`rounded-xl border border-l-4 ${cfg.bg} ${cfg.border} p-4 flex flex-col gap-2`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>EXIT</span>
                          <span className="font-display text-[18px] font-black text-foreground">{p.ticker}</span>
                          <span className="text-xs text-muted-foreground truncate flex-1">{p.company_name}</span>
                          <span className={`text-xs font-bold rounded px-1.5 py-0.5 whitespace-nowrap ${p.pnl_percent < 0 ? "bg-bearish/10 text-bearish" : "bg-bullish/10 text-bullish"}`}>
                            {p.pnl_percent > 0 ? "+" : ""}{p.pnl_percent?.toFixed(1)}%
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {p.pnl_percent < -10
                            ? `Down ${Math.abs(p.pnl_percent).toFixed(1)}%. Stop loss threshold crossed. Exit now — every point lower is avoidable loss.`
                            : `Signal score at ${p.signal_score} with P&L at ${p.pnl_percent?.toFixed(1)}%. Edge is gone. Close the position and redeploy into stronger setups.`}
                        </p>
                        <NavLink to="/positions" className="text-xs font-semibold text-bearish hover:underline flex items-center gap-1 pt-1">
                          Manage position <ChevronRight className="h-3 w-3" />
                        </NavLink>
                      </motion.div>
                    );
                  })}
                  {signals.filter(s => s.signal_score >= 70).length === 0 && positions.filter(p => p.pnl_percent < -5 || p.signal_score < 50).length === 0 && (
                    <div className="col-span-2 flex items-center gap-3 rounded-xl border border-dashed border-border/40 px-5 py-8 justify-center">
                      <CheckCircle2 className="h-4 w-4 text-bullish" />
                      <p className="text-sm text-muted-foreground">No active signals above threshold. Check back when signals refresh.</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Regime-aware plays */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <RegimeIcon className={`h-4 w-4 ${regimeCfg.color}`} />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">
                  {regime} Regime Plays
                </h2>
                <span className={`text-xs font-semibold rounded px-2 py-0.5 ${regimeCfg.bg} ${regimeCfg.color} border ${regimeCfg.border}`}>{regime}</span>
                <span className="text-xs text-muted-foreground ml-auto">Specific tickers for the current macro environment</span>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {(REGIME_PLAYS[regime] ?? REGIME_PLAYS.SIDEWAYS).map((play, i) => {
                  const cfg = ACTION_CFG[play.action];
                  return (
                    <motion.div
                      key={play.ticker + i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className={`rounded-xl border border-l-4 ${cfg.bg} ${cfg.border} p-4 flex flex-col gap-2`}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-black uppercase tracking-widest ${cfg.color}`}>{play.action}</span>
                        <span className="font-display text-[18px] font-black text-foreground">{play.ticker}</span>
                        <span className="text-xs text-muted-foreground truncate flex-1">{play.name}</span>
                        <span className={`text-xs rounded px-1.5 py-0.5 font-medium whitespace-nowrap ${
                          play.conviction === "high"
                            ? "bg-bullish/10 text-bullish"
                            : "bg-muted/40 text-muted-foreground"
                        }`}>
                          {play.conviction === "high" ? "High conviction" : "Medium conviction"}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">{play.thesis}</p>
                      <div className="flex items-center gap-2 pt-1">
                        <NavLink to="/screener" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                          Screen it <ChevronRight className="h-3 w-3" />
                        </NavLink>
                        <span className="text-muted-foreground/30">·</span>
                        <NavLink to="/chart" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                          Chart it <ChevronRight className="h-3 w-3" />
                        </NavLink>
                        <span className="text-muted-foreground/30">·</span>
                        <NavLink to="/position-sizer" className="text-xs font-semibold text-primary hover:underline flex items-center gap-1">
                          Size it <ChevronRight className="h-3 w-3" />
                        </NavLink>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Thematic ideas */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Brain className="h-4 w-4 text-primary" />
                <h2 className="font-display text-[15px] font-extrabold uppercase tracking-tight text-foreground">Thematic Ideas</h2>
                <span className="text-xs text-muted-foreground">Company types to be researching right now</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(regime === "BULL" || regime === "SIDEWAYS" ? [
                  { theme: "AI Infrastructure", desc: "Companies selling compute, storage, and networking for AI workloads. Think GPU, HBM memory, liquid cooling, power.", tickers: "NVDA · SMCI · VST · CEG", link: "/screener" },
                  { theme: "Dividend Growers", desc: "Companies that have raised dividends 10+ consecutive years. Compounding income with downside protection from consistent cash generation.", tickers: "SCHD · VIG · DGRO", link: "/dividend-tracker" },
                  { theme: "Defense & Aerospace", desc: "Government contracts provide revenue certainty regardless of economic cycle. Elevated geopolitical risk keeps budgets growing.", tickers: "LMT · RTX · NOC · KTOS", link: "/screener" },
                ] : regime === "BEAR" ? [
                  { theme: "Defensive Consumer Staples", desc: "Products people buy regardless of economic conditions. Pricing power + inelastic demand = consistent margins through downturns.", tickers: "PG · KO · CL · MKC", link: "/screener" },
                  { theme: "Utilities & Infrastructure", desc: "Regulated revenues, monopoly characteristics, dividend income. Historically the best-performing sector in bear markets.", tickers: "NEE · DUK · AWK · WEC", link: "/screener" },
                  { theme: "Healthcare & Biotech", desc: "People don't stop needing healthcare in a recession. Large-cap pharma with patent-protected revenues and dividend yield.", tickers: "JNJ · ABT · UNH · LLY", link: "/screener" },
                ] : [
                  { theme: "Low Volatility Factor", desc: "Systematic tilt toward lower-beta stocks across all sectors. Historically outperforms in volatile and sideways markets.", tickers: "USMV · SPLV · FDLO", link: "/screener" },
                  { theme: "Covered Call Income", desc: "ETFs that sell options on their holdings to generate income — 7-10% annual yield in flat markets where capital gains stall.", tickers: "JEPI · JEPQ · XYLD · QYLD", link: "/screener" },
                  { theme: "Real Assets & REITs", desc: "Hard assets provide inflation protection and income when equities go sideways. Focus on net-lease and industrial REITs.", tickers: "O · VICI · STAG · PLD", link: "/real-estate" },
                ]).map((t, i) => (
                  <motion.div
                    key={t.theme}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.07 }}
                    className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/40 transition-colors"
                  >
                    <p className="text-sm font-bold text-foreground">{t.theme}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground flex-1">{t.desc}</p>
                    <p className="font-mono text-xs text-primary/80">{t.tickers}</p>
                    <NavLink to={t.link} className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 pt-1">
                      Research these <ChevronRight className="h-3 w-3" />
                    </NavLink>
                  </motion.div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
}
