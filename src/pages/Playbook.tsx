import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Radar, Zap, BarChart3, Bell, Calculator, BookOpen,
  TrendingUp, Landmark, ScanSearch, Workflow, CandlestickChart,
  ArrowRight, Target, Shield, Repeat, DollarSign, Brain,
  ChevronRight, Clock, AlertTriangle
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.4 } }),
};

const DAILY_LOOP = [
  {
    step: "01",
    phase: "Morning · 5 min",
    title: "Find the Opportunity",
    description: "Open Signals — the AI has already scored your watchlist overnight using RSI, momentum, macro regime, and news sentiment. Cross-reference with Insider Activity to see if any executives or politicians bought recently. Check Market Regime for the macro backdrop.",
    icon: Radar,
    links: [
      { label: "Signals", href: "/signals" },
      { label: "Insider Activity", href: "/insider-activity" },
      { label: "Market Regime", href: "/market-regime" },
    ],
    color: "text-bullish",
    border: "border-bullish/20",
    bg: "bg-bullish/5",
  },
  {
    step: "02",
    phase: "Pre-Trade · 5 min",
    title: "Qualify the Trade",
    description: "Run every candidate through Decision Hub. Force yourself to answer: What's my thesis? Entry, stop, target? Max loss? Use Position Sizer to size the trade so a stop-out costs at most 1–2% of your portfolio. Confirm the setup on Chart.",
    icon: Target,
    links: [
      { label: "Decision Hub", href: "/decisions" },
      { label: "Position Sizer", href: "/position-sizer" },
      { label: "Chart", href: "/chart" },
    ],
    color: "text-neutral",
    border: "border-neutral/20",
    bg: "bg-neutral/5",
  },
  {
    step: "03",
    phase: "Execution · 2 min",
    title: "Enter with Discipline",
    description: "Set an Alert so you're notified the moment price hits your entry zone — no screen watching required. Or deploy a Bot to enter automatically when conditions are met. Your rules execute even while you sleep.",
    icon: Zap,
    links: [
      { label: "Alert Engine", href: "/alerts" },
      { label: "Trading Bots", href: "/bots" },
    ],
    color: "text-watch",
    border: "border-watch/20",
    bg: "bg-watch/5",
  },
  {
    step: "04",
    phase: "Post-Trade · 2 min",
    title: "Protect & Log",
    description: "Your bot or alert handles stop-loss and take-profit automatically. Win or lose, log every trade in the Trading Journal. Write two sentences: what was the thesis, and did it play out as expected? This is how you improve.",
    icon: Shield,
    links: [
      { label: "Trading Journal", href: "/trading-journal" },
      { label: "Paper Trading", href: "/paper-trading" },
    ],
    color: "text-bearish",
    border: "border-bearish/20",
    bg: "bg-bearish/5",
  },
  {
    step: "05",
    phase: "Weekly · 10 min",
    title: "Compound the Edge",
    description: "Review your P&L Calendar. Plug net returns into the Compound Engine — watch consistent 1.5% weekly returns turn $25K into $1.2M over 5 years. Run Tax Harvesting every quarter to legally keep 20–30% more of your profits.",
    icon: Repeat,
    links: [
      { label: "Compound Engine", href: "/compound" },
      { label: "P&L Calendar", href: "/pnl-calendar" },
      { label: "Tax Harvesting", href: "/tax-harvesting" },
    ],
    color: "text-bullish",
    border: "border-bullish/20",
    bg: "bg-bullish/5",
  },
];

const WORKFLOWS = [
  {
    title: "Signal Trading",
    description: "AI scans your watchlist daily. You execute the top 1–2 setups with proper sizing. No more guessing what to trade next.",
    tools: ["Signals", "Decision Hub", "Position Sizer", "Alerts"],
    edge: "AI does the scanning — you focus on execution",
    icon: Radar,
    href: "/signals",
  },
  {
    title: "Insider Following",
    description: "Politicians and C-suite executives have an edge. Track their disclosed transactions and model positions on the same tickers.",
    tools: ["Insider Activity", "Chart", "Bots"],
    edge: "Trade alongside people with the best information",
    icon: Landmark,
    href: "/insider-activity",
  },
  {
    title: "Momentum Screening",
    description: "Screen for high-volume breakouts every morning. Stocks breaking out on 3× average volume with strong price action can run 10–30% in days.",
    tools: ["Asset Screener", "Chart", "Alert Engine"],
    edge: "Find the move before most retail traders see it",
    icon: ScanSearch,
    href: "/screener",
  },
  {
    title: "Strategy Automation",
    description: "Define your rules once in the Bot Builder. The system scans, enters, and exits while you focus on bigger decisions.",
    tools: ["Trading Bots", "Paper Trading", "Trading Journal"],
    edge: "Remove emotion — let rules run the trade",
    icon: Workflow,
    href: "/bots",
  },
];

const DISCLAIMERS = [
  "WealthOS does not guarantee any return. All trading involves risk of loss.",
  "Signals are probabilistic, not predictive. You will have losing trades.",
  "Congressional disclosure data carries a 30–45 day lag by law.",
  "Bots require well-defined rules — test in Paper Mode before going live.",
];

export default function Playbook() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-4xl space-y-12 pb-16">

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="space-y-4 pt-2"
        >
          <Badge variant="outline" className="border-bullish/30 text-bullish font-mono text-xs">
            THE WEALTHOS PLAYBOOK
          </Badge>
          <h1 className="text-4xl font-bold leading-tight text-foreground">
            Run Your Capital<br />
            <span className="text-bullish">Like an Institution.</span>
          </h1>
          <p className="max-w-2xl text-base text-muted-foreground leading-relaxed">
            WealthOS doesn't trade for you. It gives you the same operating system that hedge funds use —
            signal generation, structured decisions, automated execution, and relentless compounding —
            in a single dashboard built for individual investors.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Clock className="h-3.5 w-3.5" />
            <span>15 minutes a day is enough. Here's the system.</span>
          </div>
        </motion.div>

        {/* The Core Insight */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="rounded-xl border border-bullish/20 bg-bullish/5 p-6"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-bullish/15">
              <Brain className="h-5 w-5 text-bullish" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-semibold text-foreground">The Compound Engine is the Real Product</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Most platforms help you trade. WealthOS is built to help you <span className="text-foreground font-medium">compound</span>.
                A trader making the same 20 trades per month as a WealthOS user might net the same gross return —
                but the WealthOS user sized correctly, logged everything, and ran tax harvesting. They keep 30–40% more
                of their profits and redeploy it faster. Run the numbers in the Compound Engine and you'll feel the difference.
              </p>
              <Link
                to="/compound"
                className="inline-flex items-center gap-1 text-sm text-bullish hover:underline font-medium"
              >
                Open Compound Engine <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </motion.div>

        {/* Daily Loop */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">The Daily Loop</h2>
            <p className="text-sm text-muted-foreground mt-1">Five steps. 15 minutes. Every trading day.</p>
          </div>
          <div className="space-y-3">
            {DAILY_LOOP.map((step, i) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.step}
                  custom={i}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  className={`rounded-xl border ${step.border} ${step.bg} p-5`}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-1.5 shrink-0">
                      <span className={`font-mono text-xs font-bold ${step.color}`}>{step.step}</span>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-background/60 border ${step.border}`}>
                        <Icon className={`h-4 w-4 ${step.color}`} />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{step.title}</h3>
                        <span className="text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">{step.phase}</span>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                      <div className="flex flex-wrap gap-2 pt-1">
                        {step.links.map((link) => (
                          <Link
                            key={link.href}
                            to={link.href}
                            className={`inline-flex items-center gap-1 text-xs font-medium ${step.color} hover:underline`}
                          >
                            {link.label} <ChevronRight className="h-3 w-3" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* 4 Workflows */}
        <div className="space-y-4">
          <div>
            <h2 className="text-xl font-bold text-foreground">4 Ways to Generate Alpha</h2>
            <p className="text-sm text-muted-foreground mt-1">Pick the workflow that matches your style and time horizon.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {WORKFLOWS.map((wf, i) => {
              const Icon = wf.icon;
              return (
                <motion.div
                  key={wf.title}
                  custom={i}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                  className="rounded-xl border border-border bg-card p-5 space-y-3 hover:border-bullish/30 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                      <Icon className="h-4 w-4 text-bullish" />
                    </div>
                    <h3 className="font-semibold text-foreground">{wf.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{wf.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {wf.tools.map((t) => (
                      <span key={t} className="text-sm bg-accent text-muted-foreground px-2 py-0.5 rounded">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-bullish font-medium">{wf.edge}</span>
                    <Link to={wf.href} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                      Open <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* The Numbers */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
          className="rounded-xl border border-border bg-card p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-bullish" />
            <h2 className="text-base font-semibold text-foreground">What Consistent Compounding Looks Like</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            These numbers assume consistent execution with proper risk management. They're not guaranteed — they're the target that makes the discipline worth it.
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "$10K at 1%/wk", result: "$1.7M", period: "10 years" },
              { label: "$25K at 1.5%/wk", result: "$3.2M", period: "5 years" },
              { label: "$50K at 2%/wk", result: "$18M", period: "5 years" },
              { label: "$100K at 0.5%/wk", result: "$1.3M", period: "10 years" },
            ].map((row) => (
              <div key={row.label} className="rounded-lg bg-accent/50 p-3 space-y-1">
                <p className="text-[11px] text-muted-foreground font-mono">{row.label}</p>
                <p className="text-lg font-bold text-bullish font-mono">{row.result}</p>
                <p className="text-[10px] text-muted-foreground">{row.period}</p>
              </div>
            ))}
          </div>
          <Link to="/compound" className="inline-flex items-center gap-1.5 text-sm text-bullish hover:underline font-medium">
            Model your own numbers in the Compound Engine <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>

        {/* Quick Start */}
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-foreground">Quick Start (First 30 Minutes)</h2>
          <div className="space-y-2">
            {[
              { n: 1, action: "Go to Signals and generate your first signal batch", href: "/signals", icon: Radar },
              { n: 2, action: "Open Chart and pull up one of the tickers returned", href: "/chart", icon: CandlestickChart },
              { n: 3, action: "Run it through Decision Hub — fill in entry, stop, target", href: "/decisions", icon: Zap },
              { n: 4, action: "Size the position in Position Sizer (risk 1% of capital)", href: "/position-sizer", icon: Calculator },
              { n: 5, action: "Set an Alert for your entry price", href: "/alerts", icon: Bell },
              { n: 6, action: "After the trade, log it in the Trading Journal", href: "/trading-journal", icon: BookOpen },
              { n: 7, action: "At week's end, update the Compound Engine with your P&L", href: "/compound", icon: TrendingUp },
            ].map((item, i) => {
              const Icon = item.icon;
              return (
                <motion.div
                  key={item.n}
                  custom={i}
                  initial="hidden"
                  animate="show"
                  variants={fadeUp}
                >
                  <Link
                    to={item.href}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:border-bullish/30 hover:bg-accent/50 transition-colors group"
                  >
                    <span className="font-mono text-xs text-muted-foreground w-4 shrink-0">{item.n}</span>
                    <Icon className="h-4 w-4 text-muted-foreground shrink-0 group-hover:text-bullish transition-colors" />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors flex-1">{item.action}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-bullish transition-colors" />
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="rounded-xl border border-border/50 bg-card/50 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-watch" />
            <h3 className="text-sm font-semibold text-muted-foreground">What WealthOS Can't Do</h3>
          </div>
          <ul className="space-y-1.5">
            {DISCLAIMERS.map((d) => (
              <li key={d} className="flex items-start gap-2 text-xs text-muted-foreground">
                <span className="mt-1.5 h-1 w-1 rounded-full bg-muted-foreground/40 shrink-0" />
                {d}
              </li>
            ))}
          </ul>
        </div>

      </div>
    </DashboardLayout>
  );
}
