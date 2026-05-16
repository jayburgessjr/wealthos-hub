import { motion } from "framer-motion";
import {
  Zap, BarChart3, TrendingUp, ShieldCheck, Cpu, Globe,
  Brain, Bot, Rss, Radar, Bell, Eye,
  CandlestickChart, PieChart, Calculator, BookOpen,
  ScanSearch, Workflow, CalendarDays, Leaf, Map,
  Vote, Activity, Trophy, Ticket, Landmark, Newspaper,
  Briefcase, Layers, FlaskConical, BookMarked,
  BarChart2, CalendarCheck, Wallet, PiggyBank, Coins,
  Home, Gem, Umbrella, TrendingDown, Scale, LineChart,
  Handshake, GitMerge, Rocket, FileText,
} from "lucide-react";

const coreFeatures = [
  {
    icon: Zap,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Decision Hub",
    desc: "Every decision you need to make today — ranked by urgency, backed by context. P1 actions, capital deployment, and regime-aligned directives in one place.",
    span: "md:col-span-2",
  },
  {
    icon: Radar,
    color: "text-watch",
    bg: "bg-watch/10",
    title: "AI Signals",
    desc: "Scored trade ideas with entry, target, stop, and action labels across every asset class you track.",
    span: "md:col-span-1",
  },
  {
    icon: Layers,
    color: "text-neutral",
    bg: "bg-neutral/10",
    title: "My Portfolio",
    desc: "Input all your real holdings — stocks, crypto, options, real estate, Kalshi contracts, cash — and AJE personalizes every recommendation around your actual positions.",
    span: "md:col-span-1",
  },
  {
    icon: Briefcase,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Position Tracker",
    desc: "Track every open position, see P&L in real time, monitor exposure by asset type, and know exactly when to exit.",
    span: "md:col-span-1",
  },
  {
    icon: Rss,
    color: "text-watch",
    bg: "bg-watch/10",
    title: "Financial News Feed",
    desc: "Multi-source news aggregation from Polygon, Finnhub, NewsAPI, Alpha Vantage, and MarketAux — with sentiment scoring and ticker tagging.",
    span: "md:col-span-1",
  },
];

const capitalFeatures = [
  {
    icon: TrendingUp,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Compound Engine",
    desc: "Model how contribution cadence, reinvestment rates, and strategy tiers compound into 7-figure outcomes over your chosen timeframe.",
  },
  {
    icon: PieChart,
    color: "text-watch",
    bg: "bg-watch/10",
    title: "Strategy Allocator",
    desc: "Map capital across strategies so conviction shifts don't quietly become concentration risk.",
  },
  {
    icon: Cpu,
    color: "text-neutral",
    bg: "bg-neutral/10",
    title: "Quantum Engine",
    desc: "Advanced portfolio optimization modeling with multi-scenario probability weighting.",
  },
  {
    icon: ShieldCheck,
    color: "text-bearish",
    bg: "bg-bearish/10",
    title: "Risk Controls",
    desc: "Drawdown limits, position sizing rules, and regime-aware risk tiers that auto-adjust as market conditions change.",
  },
];

const aiFeatures = [
  {
    icon: Brain,
    color: "text-primary",
    bg: "bg-primary/10",
    title: "Financial Advisor AI",
    desc: "Institutional-grade AI trained on financial strategy, portfolio theory, and market psychology. Ask it anything about your capital.",
    span: "md:col-span-2",
  },
  {
    icon: Bot,
    color: "text-watch",
    bg: "bg-watch/10",
    title: "AI Advisor",
    desc: "Real-time AI guidance on open positions, entries, exits, and sizing — with full portfolio context.",
    span: "md:col-span-1",
  },
];

const marketFeatures = [
  { icon: CandlestickChart, color: "text-primary", bg: "bg-primary/10", title: "Advanced Charts", desc: "Full-featured charting with technical overlays across all asset classes." },
  { icon: Globe, color: "text-neutral", bg: "bg-neutral/10", title: "Market Regime", desc: "Bull/bear/neutral regime detection with VIX, macro, and breadth analysis." },
  { icon: Landmark, color: "text-watch", bg: "bg-watch/10", title: "Insider Activity", desc: "Track corporate insider buys/sells and congressional trading disclosures." },
  { icon: Newspaper, color: "text-primary", bg: "bg-primary/10", title: "News & Intelligence", desc: "Curated market intelligence, sector rotation signals, and macro event tracking." },
  { icon: BarChart2, color: "text-neutral", bg: "bg-neutral/10", title: "Options Flow", desc: "Unusual options activity, dark pool prints, and institutional positioning signals." },
  { icon: CalendarCheck, color: "text-watch", bg: "bg-watch/10", title: "Earnings Calendar", desc: "Upcoming earnings with analyst estimates, surprise history, and implied move data." },
];

const predictionFeatures = [
  { icon: Vote, color: "text-primary", bg: "bg-primary/10", title: "Kalshi", desc: "Trade prediction contracts on economic events, Fed decisions, and macro outcomes." },
  { icon: Activity, color: "text-watch", bg: "bg-watch/10", title: "Polymarket", desc: "Decentralized prediction market analysis with real-money probability odds." },
  { icon: Trophy, color: "text-neutral", bg: "bg-neutral/10", title: "Sports Trading", desc: "EV-based sports betting analysis with Kelly sizing and bankroll management." },
  { icon: Ticket, color: "text-bearish", bg: "bg-bearish/10", title: "Lottery / EV", desc: "Mathematical EV analysis for lottery jackpots, parlays, and probabilistic bets." },
];

const wealthFeatures = [
  { icon: Wallet, color: "text-primary", bg: "bg-primary/10", title: "Net Worth Tracker", desc: "Aggregate every asset and liability into a single real-time net worth dashboard." },
  { icon: PiggyBank, color: "text-watch", bg: "bg-watch/10", title: "Cash Flow Planner", desc: "Model income, expenses, and savings rate to optimize your monthly capital allocation." },
  { icon: TrendingDown, color: "text-bearish", bg: "bg-bearish/10", title: "Debt Manager", desc: "Payoff strategies, interest analysis, and debt snowball/avalanche modeling." },
  { icon: LineChart, color: "text-neutral", bg: "bg-neutral/10", title: "Retirement Planner", desc: "Monte Carlo retirement projections with Social Security, withdrawal rates, and longevity modeling." },
  { icon: Coins, color: "text-primary", bg: "bg-primary/10", title: "Dividend Tracker", desc: "Track dividend income, yield on cost, reinvestment schedules, and ex-dividend dates." },
  { icon: Home, color: "text-watch", bg: "bg-watch/10", title: "Real Estate", desc: "Property holdings, rental yield, appreciation tracking, and equity calculations." },
  { icon: Gem, color: "text-neutral", bg: "bg-neutral/10", title: "Collectibles & Alt Assets", desc: "Track art, watches, wine, and alternative assets alongside your financial portfolio." },
  { icon: Umbrella, color: "text-primary", bg: "bg-primary/10", title: "Insurance Planning", desc: "Policy tracking, coverage gap analysis, and life/disability insurance optimization." },
  { icon: Scale, color: "text-watch", bg: "bg-watch/10", title: "Estate Planning", desc: "Asset distribution modeling, trust structure overview, and beneficiary management." },
];

const businessFeatures = [
  { icon: Landmark, color: "text-primary", bg: "bg-primary/10", title: "Entity Structure", desc: "LLC, S-Corp, C-Corp, and trust structuring guidance tailored to your capital and income profile." },
  { icon: Handshake, color: "text-watch", bg: "bg-watch/10", title: "Fundraising Intelligence", desc: "Deal flow tracking, cap table modeling, and round structure analysis for founders and angels." },
  { icon: Briefcase, color: "text-neutral", bg: "bg-neutral/10", title: "Private Equity", desc: "Track PE positions, IRR modeling, and illiquid asset exposure in your overall allocation." },
  { icon: GitMerge, color: "text-primary", bg: "bg-primary/10", title: "M&A Tracker", desc: "Monitor merger arbitrage opportunities, deal spreads, and acquisition premium trends." },
  { icon: Rocket, color: "text-watch", bg: "bg-watch/10", title: "IPO Tracker", desc: "Upcoming IPOs, lock-up expiry dates, post-IPO performance, and direct listing analysis." },
  { icon: BookOpen, color: "text-neutral", bg: "bg-neutral/10", title: "Weekly Briefing", desc: "AI-generated weekly intelligence report: regime, top signals, macro events, and portfolio risk." },
  { icon: FileText, color: "text-primary", bg: "bg-primary/10", title: "Document Vault", desc: "Store financial statements, tax docs, contracts, and brokerage statements in one secure place." },
];

const toolFeatures = [
  { icon: ScanSearch, color: "text-primary", bg: "bg-primary/10", title: "Asset Screener", desc: "Filter stocks, ETFs, and crypto by signal score, sector, momentum, and more." },
  { icon: Calculator, color: "text-watch", bg: "bg-watch/10", title: "Position Sizer", desc: "Risk-based sizing calculator using your account size, stop distance, and risk %" },
  { icon: FlaskConical, color: "text-neutral", bg: "bg-neutral/10", title: "Paper Trading", desc: "Simulate trades with real market data before committing real capital." },
  { icon: BookOpen, color: "text-primary", bg: "bg-primary/10", title: "Trading Journal", desc: "Log every trade with context, review patterns, and track what's working." },
  { icon: Workflow, color: "text-watch", bg: "bg-watch/10", title: "Trading Bots", desc: "Automate rule-based strategies with customizable entry and exit triggers." },
  { icon: Leaf, color: "text-neutral", bg: "bg-neutral/10", title: "Tax Harvesting", desc: "Identify tax-loss harvesting opportunities to maximize after-tax returns." },
  { icon: CalendarDays, color: "text-primary", bg: "bg-primary/10", title: "P&L Calendar", desc: "Visual calendar of daily, weekly, and monthly profit and loss outcomes." },
  { icon: Map, color: "text-watch", bg: "bg-watch/10", title: "Heat Map", desc: "Sector and market heat map showing where momentum is flowing in real time." },
  { icon: Bell, color: "text-neutral", bg: "bg-neutral/10", title: "Alert Engine", desc: "Price alerts, signal triggers, and macro event notifications across all markets." },
  { icon: Eye, color: "text-primary", bg: "bg-primary/10", title: "Watchlist", desc: "Build and monitor watchlists with sentiment scoring and signal overlap." },
  { icon: BarChart3, color: "text-watch", bg: "bg-watch/10", title: "Performance Analytics", desc: "Equity curve, win rate, expectancy, and strategy-level attribution." },
  { icon: BookMarked, color: "text-neutral", bg: "bg-neutral/10", title: "The Playbook", desc: "Your personal strategy rules, setups, and decision frameworks — always accessible." },
];

function FeatureCard({
  icon: Icon, color, bg, title, desc, span = "", delay = 0,
}: {
  icon: any; color: string; bg: string; title: string; desc: string; span?: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.45, delay }}
      className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-6 transition-all hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 ${span}`}
    >
      <div className="absolute top-0 right-0 p-6 opacity-[0.04] transition-opacity group-hover:opacity-[0.08]">
        <Icon className="h-20 w-20" />
      </div>
      <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${bg} ${color}`}>
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mb-2 font-display text-base font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{desc}</p>
    </motion.div>
  );
}

function SectionHeader({ badge, title, highlight, subtitle }: {
  badge: string; title: string; highlight: string; subtitle: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-10 text-center"
    >
      <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
        {badge}
      </div>
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-4xl">
        {title} <span className="text-primary">{highlight}</span>
      </h2>
      <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">{subtitle}</p>
    </motion.div>
  );
}

export default function BentoGrid() {
  return (
    <div className="space-y-24 py-20 md:py-32">
      {/* ── Core Platform ── */}
      <section id="features" className="container px-4">
        <SectionHeader
          badge="Core Platform"
          title="The Command Center for"
          highlight="Every Decision."
          subtitle="Start each session knowing exactly what to do — Mission, signals, news, positions, and portfolio in one operating layer."
        />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {coreFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* ── Capital Stack ── */}
      <section className="container px-4">
        <SectionHeader
          badge="Capital Stack"
          title="Engineer Your"
          highlight="Wealth Growth."
          subtitle="Compound modeling, allocation strategy, and institutional-grade risk controls — so your capital always has a plan."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {capitalFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* ── AI Section ── */}
      <section className="relative overflow-hidden py-16 md:py-24">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-primary/5 to-background" />
        <div className="container px-4">
          <SectionHeader
            badge="Artificial Intelligence"
            title="Two AI Advisors,"
            highlight="Always On."
            subtitle="Ask about strategy, positions, setups, risk, or macro — get institutional-quality answers backed by your full portfolio context."
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {aiFeatures.map((f, i) => (
              <FeatureCard key={f.title} {...f} delay={i * 0.1} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Markets & Intelligence ── */}
      <section className="container px-4">
        <SectionHeader
          badge="Markets & Intelligence"
          title="Know What's Moving"
          highlight="Before You Trade."
          subtitle="Market regime, insider activity, options flow, earnings, and news intelligence so you never trade blind."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {marketFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* ── Prediction Markets ── */}
      <section className="container px-4">
        <SectionHeader
          badge="Prediction Markets"
          title="Edge Beyond"
          highlight="Traditional Markets."
          subtitle="Kalshi, Polymarket, sports betting, and lottery EV — find alpha wherever probability mispricing exists."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {predictionFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.08} />
          ))}
        </div>
      </section>

      {/* ── Wealth Planning ── */}
      <section className="container px-4">
        <SectionHeader
          badge="Wealth Planning"
          title="Manage the Full"
          highlight="Financial Picture."
          subtitle="Net worth, retirement, estate planning, debt, dividends, real estate, and every asset class that makes up your total wealth."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {wealthFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.07} />
          ))}
        </div>
      </section>

      {/* ── Business & Private Markets ── */}
      <section className="container px-4">
        <SectionHeader
          badge="Business & Private Markets"
          title="Infrastructure for"
          highlight="Serious Capital."
          subtitle="Entity structuring, fundraising, private equity, M&A arbitrage, IPO tracking, and your full document vault."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {businessFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.07} />
          ))}
        </div>
      </section>

      {/* ── Tools Grid ── */}
      <section className="container px-4">
        <SectionHeader
          badge="50+ Tools"
          title="Every Tool a"
          highlight="Serious Investor Needs."
          subtitle="Screener, position sizer, paper trading, journal, bots, tax harvesting, P&L calendar, heat map, alerts, and more."
        />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {toolFeatures.map((f, i) => (
            <FeatureCard key={f.title} {...f} delay={i * 0.05} />
          ))}
        </div>
      </section>
    </div>
  );
}
