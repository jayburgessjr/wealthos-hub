import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation, NavLink } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, BookOpen, Send, ChevronRight,
  ChevronLeft, Loader2, ExternalLink, Plus, Trash2,
  TrendingUp, TrendingDown, Minus, Tag, Clock, X,
  Lightbulb, BarChart2, Globe, Cpu, Newspaper, Shield,
  Zap, Briefcase, Radar, Brain, CheckCircle2, Circle,
  AlertTriangle, ArrowRight, HelpCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

// ── Page context for AI ────────────────────────────────────────────────────────
const PAGE_CONTEXT: Record<string, { label: string; icon: any; summary: string; prompts: string[] }> = {
  "/dashboard":         { label: "Dashboard",       icon: BarChart2,  summary: "You are viewing the main portfolio dashboard — P&L metrics, equity curve, recent signals, and allocation overview.", prompts: ["Summarise my portfolio performance", "What should I focus on today?", "How is my risk exposure?", "What are the best signals right now?"] },
  "/signals":           { label: "Signals",          icon: Radar,      summary: "You are on the Signals page — AI-generated trade signals with scores, confidence, and asset recommendations.", prompts: ["Explain the top signal", "How do I read a signal score?", "What signals should I act on?", "Filter for high-conviction signals"] },
  "/positions":         { label: "Positions",        icon: Briefcase,  summary: "You are managing open positions and can place new orders via the order ticket on this page.", prompts: ["How do I size my position correctly?", "When should I close this position?", "Explain Kelly Criterion sizing", "What is a good stop-loss strategy?"] },
  "/quantum":           { label: "Quantum Engine",   icon: Cpu,        summary: "You are on the Quantum Decision Engine — runs Monte Carlo simulation and Simulated Annealing to optimise portfolio weights.", prompts: ["Explain Monte Carlo simulation", "What is Simulated Annealing?", "How do I interpret VaR?", "What is a good Sharpe ratio?"] },
  "/strategy-allocator":{ label: "Strategy",         icon: Zap,        summary: "You are on the Strategy Allocator — manage strategy tiers, allocations, and lifecycle stages (Draft → Live-Ready).", prompts: ["What is the best allocation strategy?", "Explain strategy lifecycle stages", "How do I backtest a strategy?", "What is a good Sharpe ratio for a strategy?"] },
  "/news":              { label: "News & Intel",      icon: Newspaper,  summary: "You are on the News & Intelligence page — AI-scored wire feed, economic calendar, and market sentiment analytics.", prompts: ["What is market sentiment today?", "How do I trade around FOMC?", "Explain the yield curve inversion", "What news should I act on?"] },
  "/compound":          { label: "Compound Engine",  icon: Zap,        summary: "You are on the Compound Engine — visualises compound growth strategies and blended return calculations.", prompts: ["Explain compound growth", "How do I maximise compounding?", "What is blended return?", "Optimal reinvestment strategy?"] },
  "/performance":       { label: "Performance",      icon: BarChart2,  summary: "You are on the Performance analytics page — equity curve, win rate, drawdown metrics, and return attribution.", prompts: ["How do I improve my win rate?", "What is max drawdown?", "Explain Calmar ratio", "How to reduce drawdown?"] },
  "/market-regime":     { label: "Market Regime",    icon: Globe,      summary: "You are on the Market Regime page — classifies current macro regime (risk-on/risk-off) and suggests strategy adjustments.", prompts: ["What is a risk-off regime?", "How do I trade in a bear market?", "What is the VIX telling us?", "Best sectors in stagflation?"] },
  "/crypto":            { label: "Crypto",           icon: TrendingUp, summary: "You are on the Crypto page — live crypto prices, sentiment, and trade ideas.", prompts: ["Explain Bitcoin halving", "What drives crypto volatility?", "Is crypto correlated to equities?", "Best crypto trading strategy?"] },
  "/markets":           { label: "Markets",          icon: Globe,      summary: "You are on the Markets page — Forex, commodities, fixed income, prediction markets, and sports trading.", prompts: ["How do I trade Forex?", "What moves gold prices?", "Explain yield curve spread", "What is Kelly Criterion?"] },
  "/security":          { label: "Security",         icon: Shield,     summary: "You are on the Security & Audit page — security score, risk assessment, and account audit trail.", prompts: ["How do I improve my security score?", "What is 2FA?", "Explain API key best practices", "How do I set a daily loss limit?"] },
  "/watchlist":         { label: "Watchlist",        icon: TrendingUp, summary: "You are on the Watchlist page — tracked assets with price alerts and sentiment.", prompts: ["How do I build a watchlist?", "What stocks should I watch?", "How do I set price alerts?", "What is relative strength?"] },
  "/ai-advisor":        { label: "AI Advisor",       icon: MessageSquare, summary: "You are on the full AI Advisor page — extended chat interface for deep portfolio analysis.", prompts: ["What should I buy today?", "Review my risk profile", "How do I compound faster?", "Explain my P&L"] },
};

function getPageCtx(pathname: string) {
  return PAGE_CONTEXT[pathname] ?? {
    label: "WealthOS",
    icon: BarChart2,
    summary: "You are using WealthOS — an AI-powered personal hedge fund dashboard.",
    prompts: ["What can WealthOS do?", "How do I get started?", "Explain portfolio optimisation", "What is a hedge fund strategy?"],
  };
}

// ── Simulated AI responses (contextual) ──────────────────────────────────────
const AI_RESPONSES: Record<string, string> = {
  "Explain Monte Carlo simulation": "**Monte Carlo simulation** runs thousands of random portfolio paths using Gaussian noise to estimate the distribution of outcomes.\n\nIn WealthOS's Quantum Engine, each asset's volatility is inferred from its 24h price change, then 2,000 paths are simulated to estimate:\n- **μ (expected return)** per asset\n- **σ (covariance matrix)** between assets\n\nThe result isn't a single prediction — it's a *probability distribution*. The key outputs are **VaR 95%** (worst 5% of outcomes) and **CVaR** (average loss in that tail).",
  "What is a good Sharpe ratio?": "**Sharpe Ratio = (Return − Risk-Free Rate) / Volatility**\n\nGeneral benchmarks:\n- **< 0.5** — Poor, not compensating for risk\n- **0.5 – 1.0** — Acceptable\n- **1.0 – 2.0** — Good\n- **> 2.0** — Excellent (rare in live trading)\n\nThe WealthOS Quantum Engine uses a 5% risk-free rate proxy. A Sharpe above 1.0 suggests the strategy is generating more return per unit of risk than the market.",
  "How do I interpret VaR?": "**VaR 95%** means: *'There is a 5% chance of losing more than X% in a given year.'*\n\nExample: VaR 95% = 12.3% means if you hold this portfolio for a year, there's a 95% chance your loss won't exceed 12.3%.\n\n**CVaR** (Conditional VaR) goes further — it's the *average* loss in the worst 5% of scenarios. Always look at CVaR alongside VaR for a more complete tail-risk picture.",
  "Explain the yield curve inversion": "A **yield curve inversion** occurs when short-term Treasury yields (2Y) exceed long-term yields (10Y). It signals that bond markets expect the Fed to *cut rates in the future* — which typically happens during recessions.\n\n**Historical record:** Inversions have preceded every US recession since 1955, with a 12–18 month lag. It's not a perfect timer, but it is the most reliable leading macro indicator we have.\n\nWatch the **10Y–2Y spread** on the Fixed Income tab in WealthOS Markets.",
  "What is Kelly Criterion?": "**Kelly Criterion** calculates the *optimal fraction of your bankroll* to risk on a bet/trade:\n\n`f = (b·p − q) / b`\n\nWhere:\n- **p** = probability of winning\n- **q** = probability of losing (1 − p)\n- **b** = net odds (decimal odds − 1)\n\n**In practice**, traders use **½ Kelly** or **¼ Kelly** to reduce variance. Full Kelly is mathematically optimal but psychologically brutal during drawdown phases.",
  "default": "I'm your WealthOS AI co-pilot. Based on the current page context, I can help you analyse positions, interpret signals, understand quantitative concepts, or think through trade ideas.\n\nTry one of the quick prompts below, or ask me anything specific to what you're working on.",
};

function getAIResponse(question: string): string {
  return AI_RESPONSES[question] ?? AI_RESPONSES["default"];
}

// ── Research quick links ───────────────────────────────────────────────────────
const RESEARCH_SOURCES = [
  { label: "Yahoo Finance",   url: (q: string) => `https://finance.yahoo.com/quote/${encodeURIComponent(q)}`,   icon: "📈" },
  { label: "TradingView",     url: (q: string) => `https://www.tradingview.com/symbols/${encodeURIComponent(q)}/`, icon: "📊" },
  { label: "Finviz",          url: (q: string) => `https://finviz.com/quote.ashx?t=${encodeURIComponent(q)}`,    icon: "🔍" },
  { label: "SEC EDGAR",       url: (q: string) => `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(q)}%22&dateRange=custom&startdt=2024-01-01`, icon: "📄" },
  { label: "Google Finance",  url: (q: string) => `https://www.google.com/finance/quote/${encodeURIComponent(q)}:NASDAQ`, icon: "🌐" },
  { label: "Seeking Alpha",   url: (q: string) => `https://seekingalpha.com/symbol/${encodeURIComponent(q)}`,   icon: "🧠" },
];

const MACRO_LINKS = [
  { label: "FRED Economic Data",  url: "https://fred.stlouisfed.org", icon: "🏦" },
  { label: "CME FedWatch",        url: "https://www.cmegroup.com/markets/interest-rates/cme-fedwatch-tool.html", icon: "🎯" },
  { label: "Earnings Whispers",   url: "https://www.earningswhispers.com", icon: "📅" },
  { label: "Fear & Greed Index",  url: "https://money.cnn.com/data/fear-and-greed", icon: "😱" },
  { label: "Polymarket",          url: "https://polymarket.com", icon: "🔮" },
];

// ── Journal types ──────────────────────────────────────────────────────────────
type JournalSentiment = "bullish" | "bearish" | "neutral";

interface JournalEntry {
  id: string;
  text: string;
  ticker?: string;
  sentiment: JournalSentiment;
  page: string;
  createdAt: Date;
}

const SENTIMENT_CFG = {
  bullish: { icon: TrendingUp,   color: "text-bullish", bg: "bg-bullish/10 border-bullish/20",   label: "Bullish"  },
  bearish: { icon: TrendingDown, color: "text-bearish", bg: "bg-bearish/10 border-bearish/20",   label: "Bearish"  },
  neutral: { icon: Minus,        color: "text-muted-foreground", bg: "bg-accent border-border",  label: "Neutral"  },
};

// ── Decision Intelligence per page ────────────────────────────────────────────
interface PageDecision {
  brief: string;
  checkpoints: { text: string; critical?: boolean }[];
  link?: { label: string; to: string };
  aiPrompt: string;
}

const PAGE_DECISIONS: Record<string, PageDecision> = {
  "/dashboard": {
    brief: "Your portfolio summary. Identify what's winning, what's losing, and where to focus capital next.",
    checkpoints: [
      { text: "Is win rate above 55%?", critical: true },
      { text: "Any position with P&L < −10%?", critical: true },
      { text: "Is capital utilisation optimal?", },
      { text: "Review equity curve trend today" },
    ],
    link: { label: "Full Decision Hub", to: "/decisions" },
    aiPrompt: "Based on my dashboard, what is the single most important thing I should do with my portfolio today?",
  },
  "/signals": {
    brief: "Evaluate signals before committing capital. A high score alone is not enough — confirm regime alignment.",
    checkpoints: [
      { text: "Signal score ≥ 80 before entering", critical: true },
      { text: "Regime supports trade direction", critical: true },
      { text: "Stop loss defined before entry" },
      { text: "Position size calculated (≤2% risk)" },
      { text: "No earnings within 5 trading days" },
    ],
    link: { label: "Open Position Sizer", to: "/position-sizer" },
    aiPrompt: "How do I evaluate whether a signal is worth entering right now given the current market regime?",
  },
  "/positions": {
    brief: "Every open position needs a clear hold/exit/add decision. Don't let inertia make the decision for you.",
    checkpoints: [
      { text: "Any position at stop loss?", critical: true },
      { text: "Trailing stops updated on winners?" },
      { text: "Signal score still valid (≥60)?" },
      { text: "Not adding to losing positions" },
    ],
    link: { label: "Position Sizer", to: "/position-sizer" },
    aiPrompt: "When should I hold vs exit a position that is down but hasn't hit my stop loss yet?",
  },
  "/strategy-123": {
    brief: "Confirm all 3 points before entering. One unclear point = no trade. Patience is the edge.",
    checkpoints: [
      { text: "P3 clearly between P1 and P2", critical: true },
      { text: "Entry candle closed past P2", critical: true },
      { text: "Stop loss set at P3 wick" },
      { text: "R/R ≥ 1.5 before entering" },
      { text: "Regime aligned with direction" },
    ],
    link: { label: "1-2-3 Setup Tracker", to: "/strategy-123" },
    aiPrompt: "Explain the most common mistake traders make when applying the 1-2-3 strategy.",
  },
  "/compound": {
    brief: "Compounding works when you stay consistent. Decide on your reinvestment rate before you see the numbers.",
    checkpoints: [
      { text: "Reinvestment rate set (not guessed)" },
      { text: "Realistic return assumption?" },
      { text: "Drawdown scenario modelled" },
      { text: "Strategy aligned with timeframe" },
    ],
    aiPrompt: "What reinvestment rate is realistic for a retail trader with a 60% win rate?",
  },
  "/strategy-allocator": {
    brief: "Capital allocation is a decision, not a default. Every strategy tier should have a deliberate weight.",
    checkpoints: [
      { text: "No single strategy > 40% of capital", critical: true },
      { text: "Allocations reflect current regime" },
      { text: "Underperforming strategies reduced" },
      { text: "Total allocation equals 100%" },
    ],
    aiPrompt: "How do I decide how much capital to allocate across multiple trading strategies?",
  },
  "/quantum": {
    brief: "Use Monte Carlo outputs to stress-test your allocation before making it live.",
    checkpoints: [
      { text: "VaR 95% is acceptable" },
      { text: "Sharpe ratio ≥ 1.0", critical: true },
      { text: "Max drawdown within tolerance" },
      { text: "Correlation between assets reviewed" },
    ],
    aiPrompt: "How do I interpret Monte Carlo simulation results for my portfolio?",
  },
  "/market-regime": {
    brief: "The regime defines the playbook. Every trade decision flows from this context first.",
    checkpoints: [
      { text: "Regime identified (BULL/BEAR/etc)", critical: true },
      { text: "Strategy adjusted to regime" },
      { text: "VIX level reviewed" },
      { text: "Sector rotation checked" },
    ],
    link: { label: "Decision Hub", to: "/decisions" },
    aiPrompt: "How should I adjust my trading strategy based on the current market regime?",
  },
  "/watchlist": {
    brief: "A watchlist is only useful if you have clear entry criteria for each ticker. Define it now.",
    checkpoints: [
      { text: "Each ticker has a setup in mind" },
      { text: "Alert set at P2 breakout level" },
      { text: "No more than 15 active tickers" },
      { text: "Low-conviction tickers removed" },
    ],
    link: { label: "1-2-3 Tracker", to: "/strategy-123" },
    aiPrompt: "How should I decide which tickers to add or remove from my watchlist?",
  },
  "/performance": {
    brief: "Understand your edge before placing the next trade. Metrics don't lie — your memory does.",
    checkpoints: [
      { text: "Win rate trend (improving or declining)?", critical: true },
      { text: "Max drawdown within risk tolerance?" },
      { text: "Best strategy identified" },
      { text: "Worst mistake pattern identified" },
    ],
    aiPrompt: "What performance metrics should I focus on to improve my trading results?",
  },
  "/position-sizer": {
    brief: "Correct position sizing is the difference between surviving a losing streak and blowing up.",
    checkpoints: [
      { text: "Risk per trade ≤ 2% of account", critical: true },
      { text: "Stop loss defined before sizing" },
      { text: "Total exposure < 20% per sector" },
      { text: "Account for slippage in calculation" },
    ],
    aiPrompt: "What is the correct way to size a position when risking 1% of my account?",
  },
  "/trading-journal": {
    brief: "Log every trade, not just the winners. The pattern in your losses is where your edge hides.",
    checkpoints: [
      { text: "Today's trades logged with reasoning" },
      { text: "Emotion at time of trade noted" },
      { text: "Exit reasoning documented" },
      { text: "Weekly patterns reviewed" },
    ],
    aiPrompt: "What should I document in a trading journal entry to improve my decision-making over time?",
  },
  "/paper-trading": {
    brief: "Paper trading is only useful if you treat it like real money. Simulate the emotion.",
    checkpoints: [
      { text: "Using realistic position sizes" },
      { text: "Same strategy as live trading" },
      { text: "Logging entries and exits" },
      { text: "Tracking win rate vs live" },
    ],
    aiPrompt: "How do I use paper trading effectively to validate a new strategy before going live?",
  },
  "/news": {
    brief: "Don't trade the news — trade the reaction. Understand sentiment before acting.",
    checkpoints: [
      { text: "High-impact news events identified" },
      { text: "Avoid entry 30min before major events" },
      { text: "Sentiment aligned with open positions" },
      { text: "FOMC / CPI calendar checked" },
    ],
    aiPrompt: "How do I decide whether breaking news is a trading opportunity or a trap?",
  },
  "/tax-harvesting": {
    brief: "Tax harvesting is an alpha decision, not an accounting one. Identify opportunities before year-end.",
    checkpoints: [
      { text: "Unrealized losses identified" },
      { text: "30-day wash sale rule understood" },
      { text: "Replacement position planned" },
      { text: "Tax advisor consulted" },
    ],
    aiPrompt: "How do I use tax-loss harvesting to improve my after-tax returns?",
  },
};

function getPageDecision(pathname: string): PageDecision {
  return PAGE_DECISIONS[pathname] ?? {
    brief: "Review what matters on this page before taking action. Clarity precedes execution.",
    checkpoints: [
      { text: "Understand the data shown here" },
      { text: "Identify one clear next action" },
      { text: "Connect this to your open positions" },
    ],
    link: { label: "Decision Hub", to: "/decisions" },
    aiPrompt: "What is the most important decision I should make right now given my current portfolio?",
  };
}

// ── Page Guides ───────────────────────────────────────────────────────────────
interface GuideStep { title: string; body: string }
interface GuideConcept { term: string; def: string }
interface PageGuide {
  tagline: string;
  steps: GuideStep[];
  concepts?: GuideConcept[];
  tips?: string[];
}

const PAGE_GUIDES: Record<string, PageGuide> = {
  "/dashboard": {
    tagline: "Your portfolio command center — P&L, signals, equity curve, and allocation at a glance.",
    steps: [
      { title: "Read the Morning Pulse", body: "The top banner gives you today's market regime, key macro signals, and any critical alerts before you look at anything else." },
      { title: "Check your signal cards", body: "Each card shows a live AI signal with score, action, and conviction. Green = bullish setup, Red = bearish. Score ≥ 80 is actionable." },
      { title: "Review the equity curve", body: "The chart shows your cumulative P&L over time. A rising curve with shallow dips means your edge is working. A flattening curve is a warning sign." },
      { title: "Check open positions", body: "The positions table shows every open trade. Red P&L rows need a decision — hold, trail stop, or exit." },
      { title: "Review allocation", body: "The donut chart shows how capital is split across strategies. No single strategy should exceed 40% of total capital." },
    ],
    concepts: [
      { term: "Signal Score", def: "0–100 AI confidence rating. Below 60 = weak, 60–79 = moderate, 80–100 = high conviction." },
      { term: "Equity Curve", def: "Running total of realized + unrealized P&L. The slope tells you more than any single trade." },
      { term: "Morning Pulse", def: "AI-generated daily brief covering regime, key events, and your top decision for the day." },
    ],
    tips: [
      "Check the dashboard before the market opens, not during — reactive decisions are worse decisions.",
      "If your equity curve has been flat for 10+ trading days, reduce position size until you identify why.",
    ],
  },
  "/signals": {
    tagline: "AI-generated trade signals ranked by conviction score — your order flow before the market moves.",
    steps: [
      { title: "Filter by score", body: "Start with signals scored 80+. Anything below 70 requires additional confirmation before acting." },
      { title: "Check the action type", body: "Each signal has an action: Strong Buy, Buy, Watch, or Avoid. Only enter on Buy or Strong Buy." },
      { title: "Read the reasoning", body: "Expand a signal to see the 3 reasons behind it. If you disagree with the reasoning, skip the trade — your conviction matters." },
      { title: "Verify regime alignment", body: "A bullish signal in a BEAR regime is a lower-confidence trade. Check the Market Regime page before entering." },
      { title: "Size using Position Sizer", body: "Never enter without calculating your position size first. Risk ≤ 2% of account per trade." },
    ],
    concepts: [
      { term: "Signal Score", def: "AI conviction rating. 90+ = elite setup, 80–89 = strong, 70–79 = moderate, <70 = wait." },
      { term: "Strong Buy vs Buy", def: "Strong Buy signals have multiple confirming factors. Buy signals have strong but fewer confirmations." },
      { term: "Regime Alignment", def: "Bullish signals in a BULL regime outperform the same signals in a BEAR regime by a wide margin." },
    ],
    tips: [
      "Refresh signals each morning — they are regenerated based on overnight price action and macro data.",
      "Never chase a signal that has already moved significantly from its entry price.",
    ],
  },
  "/positions": {
    tagline: "Manage every open trade — entry, sizing, stop loss, and exit — from one place.",
    steps: [
      { title: "Open the order ticket", body: "Click 'New Position' to log a trade. Fill in ticker, entry price, position size, stop loss, and target before entering the market." },
      { title: "Review each position's P&L", body: "The table shows unrealized P&L, signal score, and days held. Focus first on any red positions — they need a decision." },
      { title: "Update stops on winners", body: "For any position up more than 20%, move your stop to breakeven. For 50%+ winners, trail the stop to the most recent pullback low." },
      { title: "Exit losers decisively", body: "If P&L is below −10% or the signal score has dropped below 50, exit. There is no recovery from hope trading." },
      { title: "Log the close", body: "When you exit, record the reasoning in the Trading Journal so you can identify patterns in your exits over time." },
    ],
    concepts: [
      { term: "Stop Loss", def: "A pre-defined price where you exit to limit loss. Set before entry — never after." },
      { term: "Trail Stop", def: "Moving your stop up as price rises, locking in gains while letting winners run." },
      { term: "Signal Score Decay", def: "A score that was 90 at entry may fall to 60 weeks later — that is a signal to reduce exposure." },
    ],
    tips: [
      "The hardest skill in trading is sitting on a winning position. Exits kill more P&L than entries.",
      "If a position has not moved in 10+ days, ask whether the capital could be working harder elsewhere.",
    ],
  },
  "/decisions": {
    tagline: "Your daily briefing — every action ranked by urgency with context and direct links to act.",
    steps: [
      { title: "Read the stat cards first", body: "Market regime, available capital, win rate, and critical action count give you the session context in under 10 seconds." },
      { title: "Generate an AI Session Brief", body: "Click the button in the top right to get a 4-5 sentence brief on what to focus on, whether to add or reduce exposure, and key risks." },
      { title: "Work through Priority Actions", body: "Every card shows WHAT to do, WHY (the reasoning), and WHERE to go. Red/critical items first, then high, then medium." },
      { title: "Review Capital Deployment", body: "The three options below Priority Actions are tailored to your available cash and current regime. Pick one and execute." },
      { title: "Use Tools For Today", body: "The feature recommendations at the bottom are dynamically chosen based on your regime and portfolio state. They change daily." },
    ],
    concepts: [
      { term: "Directive Urgency", def: "Critical = act now. High = act today. Medium = review this session." },
      { term: "Regime-Aware Actions", def: "Every recommendation factors in whether the market is BULL, BEAR, VOLATILE, or SIDEWAYS." },
      { term: "Session Brief", def: "AI-generated summary of your specific situation — not generic advice." },
    ],
    tips: [
      "Open the Decision Hub before you open any other page. Let it set the agenda.",
      "If there are 3+ critical directives, do not open any new positions until they are resolved.",
    ],
  },
  "/strategy-123": {
    tagline: "The 1-2-3 reversal pattern — a structured entry system that defines risk before you commit capital.",
    steps: [
      { title: "Read the Reference tab first", body: "If you are new to the strategy, start on the Reference tab. Learn FTGL, FTGH, and the 6 key terms before using the tracker." },
      { title: "Set your direction and ticker", body: "Choose Call (bullish) or Put (bearish), then enter the ticker. Live price and recent news will load automatically." },
      { title: "Mark your 3 points", body: "P1 = the key high or low. P2 = the counter-move extreme. P3 = the return move that stays between P1 and P2." },
      { title: "Check the verdict", body: "The GO/WARN/NO card tells you instantly if the setup is valid and if the R/R is worth taking." },
      { title: "Enter only on P2 break", body: "Do not enter until a candle closes past P2. Early entries are the most common mistake — they bypass the confirmation." },
      { title: "Copy the Operations Brief", body: "Before entering the trade, copy the brief to your trading journal. Every detail is pre-filled." },
    ],
    concepts: [
      { term: "P1", def: "The initial extreme — a key low (calls) or key high (puts). Your setup anchor." },
      { term: "P2", def: "The counter-move extreme. Price must break past P2 to confirm the trade entry." },
      { term: "P3", def: "The pullback that holds above P1 (calls) or below P1 (puts). It must sit between P1 and P2." },
      { term: "Measured Move", def: "P2−P1 distance projected from the entry point. The automatic target if you leave the target blank." },
    ],
    tips: [
      "If P3 touches P1 or goes past it, the setup is cancelled. Start over — do not force it.",
      "The best 1-2-3 setups form on daily or weekly charts. Lower timeframes produce more noise.",
    ],
  },
  "/compound": {
    tagline: "Model how consistent returns compound into long-term wealth — and what small improvements mean over time.",
    steps: [
      { title: "Enter your starting capital", body: "Use your actual account size, not an aspirational number. Garbage in = garbage out." },
      { title: "Set a realistic return rate", body: "A 60% win rate with 1:2 R/R produces roughly 20–30% annual returns for most strategies. Be conservative." },
      { title: "Choose your time horizon", body: "Select 1, 3, 5, or 10 years. The curve will show you the compounding effect across that period." },
      { title: "Adjust the reinvestment rate", body: "100% reinvestment compounds fastest but requires maximum discipline. 50% is more psychologically sustainable." },
      { title: "Compare scenarios", body: "Run the same capital with different return rates side by side to see what an extra 5% annual return actually means." },
    ],
    concepts: [
      { term: "Compound Growth", def: "Reinvesting returns so that each period's gains are calculated on a larger base. Time is the multiplier." },
      { term: "Reinvestment Rate", def: "The percentage of returns put back into the strategy. 100% = maximum compounding. 0% = flat income." },
      { term: "Blended Return", def: "Weighted average return across multiple strategies in your portfolio." },
    ],
    tips: [
      "The difference between 20% and 25% annual returns over 10 years is enormous. Small edge improvements are worth obsessing over.",
      "Withdrawing gains breaks the compound curve. Model the impact before taking money out.",
    ],
  },
  "/strategy-allocator": {
    tagline: "Manage your strategy tiers — allocate capital across approaches and track each from draft to live-ready.",
    steps: [
      { title: "Create strategy tiers", body: "Each strategy gets its own tier: Draft, Testing, Active, or Retired. A strategy should prove itself in Testing before capital is allocated." },
      { title: "Set allocation percentages", body: "Assign a capital percentage to each active strategy. All allocations must sum to 100%." },
      { title: "Review performance by strategy", body: "Each tier shows win rate, avg return, and trade count. Shift capital away from underperformers." },
      { title: "Retire underperformers", body: "If a strategy has a win rate below 45% over 20+ trades, move it to Retired. No exceptions based on gut feel." },
      { title: "Promote from Testing to Active", body: "A testing strategy needs at least 20 trades and 55%+ win rate before going live with real capital." },
    ],
    concepts: [
      { term: "Strategy Tier", def: "The lifecycle stage: Draft → Testing → Active → Retired. Capital only flows to Active strategies." },
      { term: "Capital Allocation", def: "The percentage of total portfolio capital assigned to each active strategy." },
      { term: "Sharpe Ratio", def: "Return per unit of risk. Above 1.0 is good. Above 2.0 is excellent." },
    ],
    tips: [
      "Never allocate more than 40% to a single strategy — even your best one.",
      "Paper trade a new strategy for at least 1 month before allocating real capital.",
    ],
  },
  "/quantum": {
    tagline: "Monte Carlo simulation and portfolio optimisation — stress-test your allocation before committing capital.",
    steps: [
      { title: "Add your assets", body: "Enter each position or target allocation. The engine uses 24h volatility to infer asset-level risk." },
      { title: "Run the simulation", body: "Click Optimise. 2,000 random portfolio paths are simulated using the covariance matrix of your assets." },
      { title: "Read VaR and CVaR", body: "VaR 95% is the worst 5% of outcomes. CVaR is the average loss in that tail. Both should be within your risk tolerance." },
      { title: "Check the Sharpe Ratio", body: "The Simulated Annealing optimizer will find the allocation that maximises Sharpe. Target ≥ 1.0." },
      { title: "Apply the weights", body: "If the optimal weights differ significantly from your current allocation, use Strategy Allocator to rebalance." },
    ],
    concepts: [
      { term: "Monte Carlo", def: "2,000 simulated portfolio paths using random noise modeled on actual volatility. Shows the range of outcomes, not a prediction." },
      { term: "VaR 95%", def: "Value at Risk: the loss level you will not exceed 95% of the time over one year." },
      { term: "Simulated Annealing", def: "An optimisation algorithm that finds portfolio weights maximising the Sharpe ratio." },
      { term: "CVaR", def: "Conditional VaR: the average loss in the worst 5% of scenarios. More conservative than VaR." },
    ],
    tips: [
      "Run the Quantum Engine when considering a new large position — see how it affects the overall portfolio risk profile.",
      "A Sharpe above 2.0 in simulation often degrades in live trading. Target 1.0–1.5 as realistic.",
    ],
  },
  "/market-regime": {
    tagline: "Understand the macro environment driving all price action — and adjust your strategy accordingly.",
    steps: [
      { title: "Read the regime label", body: "BULL, BEAR, VOLATILE, or SIDEWAYS. This is the single most important context for every trade decision today." },
      { title: "Check the composite score", body: "0–100 score aggregating yield curve, VIX, sector momentum, and Fed policy. Above 65 = risk-on. Below 35 = risk-off." },
      { title: "Review individual signals", body: "Each macro indicator (VIX, yield curve, sector flows, Fed stance) is scored separately. Identify which ones are driving the regime." },
      { title: "Adjust your strategy", body: "BULL = favour longs and momentum. BEAR = reduce exposure, favour shorts or cash. VOLATILE = cut size, tighten stops. SIDEWAYS = be selective." },
    ],
    concepts: [
      { term: "Composite Score", def: "Weighted average of VIX, yield curve, sector momentum, and Fed stance. The single number that defines the regime." },
      { term: "VIX", def: "The fear gauge. Below 15 = complacent. 15–25 = normal. Above 25 = volatile. Above 35 = fear regime." },
      { term: "Yield Curve", def: "10Y − 2Y Treasury spread. Inverted (negative) curve historically precedes recessions by 12–18 months." },
    ],
    tips: [
      "Do not fight the regime. The best signal in a BEAR regime will underperform the same signal in a BULL regime.",
      "Regime changes are slow. Check this page weekly, not daily.",
    ],
  },
  "/watchlist": {
    tagline: "Your curated list of assets you are tracking for potential entry — not random tickers, but active setups.",
    steps: [
      { title: "Add assets with purpose", body: "Only add a ticker if you have a specific thesis or setup in mind. A watchlist of 30 random tickers is useless." },
      { title: "Set an alert level", body: "For each ticker, know the price level that would trigger your entry. That is the only reason to be watching it." },
      { title: "Review weekly", body: "Remove tickers that have moved too far from your entry criteria or whose thesis has changed. Keep the list clean and actionable." },
      { title: "Link to 1-2-3 Tracker", body: "When a watchlist ticker starts forming a 1-2-3 pattern, move it to the Setup Tracker to map out the trade." },
    ],
    concepts: [
      { term: "Entry Thesis", def: "The specific reason you are watching a ticker. Without a thesis, it is noise." },
      { term: "Alert Level", def: "The price that would trigger your action — either an entry or a deeper analysis." },
    ],
    tips: [
      "The best watchlists have fewer than 15 tickers. Quality over quantity.",
      "Checking your watchlist more than twice per day leads to emotional, impulse-driven decisions.",
    ],
  },
  "/ai-advisor": {
    tagline: "Deep conversation with your AI portfolio analyst — for complex questions that need more than a quick answer.",
    steps: [
      { title: "Provide context upfront", body: "Start with your situation: account size, open positions, risk tolerance, and what decision you are trying to make. Vague questions get vague answers." },
      { title: "Ask one question at a time", body: "Break complex questions into focused sub-questions. The AI works better with specifics than with broad open-ended prompts." },
      { title: "Challenge the response", body: "Push back if the answer does not fit your situation. Ask 'what if' and 'why not' follow-ups to get deeper analysis." },
      { title: "Use it for trade review", body: "After a losing trade, describe what happened and ask the AI to identify what you could have done differently." },
    ],
    tips: [
      "The AI does not know your actual positions unless you describe them. Give it numbers.",
      "Use the sidebar AI Chat for quick questions. Use this page for deep, multi-turn analysis sessions.",
    ],
  },
  "/financial-advisor": {
    tagline: "Personalised financial planning guidance — strategy, goals, and long-term wealth building.",
    steps: [
      { title: "Define your financial goal", body: "Retirement, financial independence, home purchase, or wealth building — state it clearly before asking for guidance." },
      { title: "Share your constraints", body: "Time horizon, risk tolerance, tax situation, and monthly contribution capacity all shape the advice. Include them." },
      { title: "Ask for a plan", body: "Request a structured plan with specific allocations, timelines, and milestones — not just general principles." },
      { title: "Revisit quarterly", body: "Come back every quarter to review progress and adjust the plan as your situation changes." },
    ],
    tips: [
      "This is guidance, not regulated financial advice. Use it to structure your thinking, then validate with a CPA or CFP for major decisions.",
      "The more specific your situation, the more useful the output.",
    ],
  },
  "/performance": {
    tagline: "Track your edge — win rate, drawdown, return attribution, and equity curve over time.",
    steps: [
      { title: "Start with win rate trend", body: "Is your win rate improving, declining, or flat over the last 20 trades? Trend matters more than the absolute number." },
      { title: "Check max drawdown", body: "How far did your account fall from peak to trough? A drawdown above 20% usually signals a strategy problem, not just bad luck." },
      { title: "Review return by strategy", body: "Which strategy or setup is producing the most P&L? Concentrate on what works and reduce what does not." },
      { title: "Look at your losing trades", body: "Filter for losses. Find the pattern — same ticker type, same time of day, same market condition. That pattern is costing you money." },
      { title: "Set a benchmark", body: "Compare your returns to SPY over the same period. If you are underperforming the index with more risk, reconsider your approach." },
    ],
    concepts: [
      { term: "Max Drawdown", def: "Peak-to-trough decline in account value. The psychological and financial test of your strategy." },
      { term: "Calmar Ratio", def: "Annual return divided by max drawdown. Above 1.0 means you earn more than you drawdown." },
      { term: "Expectancy", def: "Average amount you make per trade: (Win% × Avg Win) − (Loss% × Avg Loss). Must be positive to be profitable." },
    ],
    tips: [
      "Run a performance review after every 20 trades — not after every trade. Sample size matters.",
      "If your Sharpe ratio is below 0.5, you are taking more risk than the return justifies.",
    ],
  },
  "/pnl-calendar": {
    tagline: "Visualise your P&L day by day — find your best and worst trading days, weeks, and patterns.",
    steps: [
      { title: "Look at your green and red days", body: "The calendar heatmap shows daily P&L. Clusters of red days reveal when your edge breaks down." },
      { title: "Identify your best trading days", body: "Are you consistently better on Monday mornings? Tuesday afternoons? Find your high-performance window." },
      { title: "Find your worst patterns", body: "Many traders lose on Fridays (FOMO) or during FOMC weeks (macro volatility). Find yours and reduce trading on those days." },
      { title: "Filter by month", body: "Seasonality matters. Some months historically favour certain strategies. Build awareness of your monthly patterns." },
    ],
    tips: [
      "If you have 3+ consecutive red days, take the next day off. Fatigue and frustration compound losses.",
      "Your best trading usually happens in the first 2 hours of market open. Track whether your afternoon trades perform differently.",
    ],
  },
  "/heat-map": {
    tagline: "Sector and asset class performance at a glance — see what is leading and lagging right now.",
    steps: [
      { title: "Read the colour intensity", body: "Deep green = strong outperformance. Deep red = sharp underperformance. White/grey = flat." },
      { title: "Find sector rotation", body: "Money flows from sector to sector. If Energy is green and Tech is red, capital is rotating defensively." },
      { title: "Align signals with leaders", body: "Focus your signal research on the sectors currently leading — momentum traders outperform in the direction of rotation." },
      { title: "Watch for divergence", body: "If SPY is green but most sectors are red, the rally is narrow — a warning sign of underlying weakness." },
    ],
    tips: [
      "Check the heat map at market open to orient your trading for the session.",
      "Leading sectors tend to continue leading for 4–8 weeks. Do not fight the rotation.",
    ],
  },
  "/earnings-calendar": {
    tagline: "Track upcoming earnings dates — know before you hold which positions face binary event risk.",
    steps: [
      { title: "Check earnings dates for open positions", body: "Every open position near an earnings date is a binary risk event. Know the date before it surprises you." },
      { title: "Decide pre-earnings", body: "You have 3 choices: exit before earnings, hold through (with defined risk), or use options to hedge. Make the decision deliberately." },
      { title: "Watch for post-earnings setups", body: "The best 1-2-3 patterns often form 3–10 days after an earnings gap. Let the volatility settle, then look for the setup." },
      { title: "Filter by market cap", body: "Large-cap earnings move the index. Small-cap earnings can gap 30%+. Size accordingly." },
    ],
    tips: [
      "Never enter a new position 5 days or fewer before earnings unless you specifically want the event exposure.",
      "Implied volatility collapses after earnings — options lose value even if the move is in your direction.",
    ],
  },
  "/position-sizer": {
    tagline: "Calculate the correct number of shares or contracts for any trade — based on your actual risk budget.",
    steps: [
      { title: "Enter your account size", body: "Use the current total value of your trading account, not your total net worth." },
      { title: "Set your risk percentage", body: "1% per trade is conservative. 2% is standard. Never exceed 3% on a single position." },
      { title: "Enter entry and stop loss prices", body: "The stop loss must be defined before you size — not the other way around." },
      { title: "Read the share count", body: "The result is the maximum shares you can hold to keep your loss within your risk budget if stopped out." },
      { title: "For options, enter the premium", body: "The contract count calculation uses premium × 100. One contract controls 100 shares." },
    ],
    concepts: [
      { term: "Risk Per Trade", def: "The maximum dollar amount you will lose on this trade if stopped out. Usually 1–2% of account." },
      { term: "R-Multiple", def: "How many times your risk amount you made or lost. A 1:2 R/R means you risk 1R to make 2R." },
      { term: "Kelly Criterion", def: "Mathematical formula for optimal bet size: f = (bp − q) / b. In practice, use half-Kelly to reduce variance." },
    ],
    tips: [
      "The position sizer does not care about your conviction level — it cares about your risk. Size down in volatile regimes regardless.",
      "Never increase your position size after a loss to 'make it back faster'. That is the fastest way to blow up.",
    ],
  },
  "/paper-trading": {
    tagline: "Simulate trades with no real capital — test your strategy and build execution discipline before going live.",
    steps: [
      { title: "Set a realistic starting balance", body: "Use the same amount you plan to trade with live. If you paper trade with $1M but plan to go live with $10K, the psychology lessons do not transfer." },
      { title: "Trade your real strategy", body: "Paper trade exactly the same setups you would take live — same signals, same sizing rules, same stop logic. No hero trades." },
      { title: "Log every entry and exit", body: "Paper trading without a journal is just clicking buttons. The journal is where the learning happens." },
      { title: "Track your win rate", body: "After 20 trades, compare paper P&L to live signals and your performance page. If paper results diverge, find out why." },
      { title: "Graduate to live trading", body: "When you have 20+ paper trades with a 55%+ win rate and positive expectancy, you are ready to go live — with smaller size." },
    ],
    tips: [
      "The hardest part of paper trading is taking it seriously. Add emotional stakes by tracking a leaderboard or sharing results.",
      "Do not paper trade longer than necessary — you need real P&L data to refine your approach.",
    ],
  },
  "/trading-journal": {
    tagline: "Document every trade decision — the pattern in your journal is the edge you cannot see in the moment.",
    steps: [
      { title: "Log every trade on entry", body: "Record: ticker, direction, entry price, stop, target, and why you took the trade. Do it before the market moves." },
      { title: "Add exit notes", body: "When you close, record the exit price, P&L, and — critically — whether you followed your plan or deviated from it." },
      { title: "Rate your execution", body: "Score each trade 1–5 on execution quality, separate from P&L. A good trade that loses money is still a good trade." },
      { title: "Review weekly", body: "Every Sunday, read the last week's entries. Look for recurring patterns: same mistake, same emotional state, same market condition." },
      { title: "Identify one improvement", body: "From the weekly review, identify one specific thing to change next week. One at a time — do not overhaul everything." },
    ],
    tips: [
      "Your journal is private. Be brutally honest about why you really took a trade — especially the bad ones.",
      "If your journal shows you consistently exit winners too early, set a rule: no exits before 50% of your target is reached.",
    ],
  },
  "/tax-harvesting": {
    tagline: "Turn unrealized losses into tax savings — without disrupting your long-term strategy.",
    steps: [
      { title: "Identify unrealized losses", body: "The tool surfaces positions with unrealized losses that could be harvested before year-end or quarter-end." },
      { title: "Understand the wash-sale rule", body: "You cannot buy the same or substantially identical security within 30 days before or after selling at a loss. The loss will be disallowed." },
      { title: "Find a replacement position", body: "Sell the losing position, then immediately buy a correlated but not identical asset to maintain market exposure during the 30-day window." },
      { title: "Calculate the tax benefit", body: "Capital losses offset capital gains dollar for dollar. Up to $3,000 can be deducted against ordinary income per year." },
      { title: "Document everything", body: "Keep records of the sale date, purchase date, loss amount, and replacement security. Your accountant will need this." },
    ],
    concepts: [
      { term: "Wash-Sale Rule", def: "IRS rule: losses are disallowed if you buy the same security within 30 days before or after a loss sale." },
      { term: "Tax Alpha", def: "Additional return generated through tax management — harvesting losses, deferring gains, and optimising holding periods." },
      { term: "Carryover Loss", def: "Unused capital losses that carry forward to future tax years to offset future gains." },
    ],
    tips: [
      "Start tax-loss harvesting in October, not December. December is too crowded and you have less flexibility.",
      "Consult a CPA before executing. The rules around 'substantially identical' securities are nuanced.",
    ],
  },
  "/weekly-briefing": {
    tagline: "Your AI-generated weekly market summary — what happened, what it means, and what to watch next week.",
    steps: [
      { title: "Read the macro summary", body: "The briefing opens with the week's key macro events: Fed decisions, CPI, jobs data. These set the context for everything else." },
      { title: "Review sector performance", body: "Which sectors led and lagged? Sector rotation tells you where institutional money is moving." },
      { title: "Check your portfolio review", body: "The briefing flags your positions that had notable moves during the week and whether any need attention." },
      { title: "Read the forward calendar", body: "The week ahead section lists key events: earnings, economic data releases, and Fed speeches. Plan around them." },
    ],
    tips: [
      "Read the weekly briefing on Sunday evening before markets open Monday. Use it to set your trading agenda.",
      "Pay more attention to events that were surprises than events that met expectations — surprises move markets.",
    ],
  },
  "/news": {
    tagline: "AI-scored market news and intelligence — filtered for relevance so you read signal, not noise.",
    steps: [
      { title: "Filter by your positions first", body: "Check news for your open positions before reading broad market news. Position-specific news is most actionable." },
      { title: "Read the sentiment score", body: "Each article is scored for market impact. High-impact + negative sentiment on a position you hold = time to re-evaluate." },
      { title: "Check the economic calendar", body: "Upcoming data releases (CPI, jobs, FOMC) are flagged. Avoid entering new positions 24 hours before major events." },
      { title: "Do not trade the headline", body: "Markets often move before news is published and reverse after. Wait 15–30 minutes after a major headline before making decisions." },
    ],
    tips: [
      "More news is not better. Two deeply-read articles beat skimming twenty headlines.",
      "If a news event was already widely expected, the market reaction is to the deviation from expectation — not the event itself.",
    ],
  },
  "/crypto": {
    tagline: "Live crypto prices, sentiment, and trade setups — with the same signal framework as equities.",
    steps: [
      { title: "Check BTC dominance first", body: "When BTC dominance is rising, money is flowing into Bitcoin at the expense of altcoins. When falling, altcoins are outperforming." },
      { title: "Review sentiment", body: "Crypto sentiment is more volatile than equities. Extreme fear is often a buying opportunity; extreme greed is a warning." },
      { title: "Apply 1-2-3 setups", body: "The 1-2-3 strategy works on crypto charts. Use the Setup Tracker with a crypto ticker for structured entries." },
      { title: "Size conservatively", body: "Crypto is 3–5× more volatile than equities. Use half the position size you would for a stock trade." },
    ],
    tips: [
      "Crypto trades 24/7. Do not check prices outside market hours unless you have active stop orders.",
      "Correlation with equities increases during market stress. Crypto does not always provide diversification when you need it most.",
    ],
  },
  "/markets": {
    tagline: "Forex, commodities, fixed income, and alternative markets — broaden your edge beyond equities.",
    steps: [
      { title: "Check the dollar index (DXY)", body: "A rising dollar is bearish for commodities and emerging markets. A falling dollar is generally bullish for gold and risk assets." },
      { title: "Review commodity momentum", body: "Gold, oil, and agricultural commodities often lead inflation data. Watch them for macro context." },
      { title: "Check yield spreads", body: "Investment grade vs high yield spreads widening = credit stress = risk-off. Tightening = risk-on." },
      { title: "Use for regime confirmation", body: "Market signals here confirm or contradict the regime shown on the Market Regime page. Disagreements are worth investigating." },
    ],
    tips: [
      "Forex trades around the clock. Major moves in EUR/USD or USD/JPY during US hours often precede equity moves.",
      "Gold and the VIX often move together in risk-off regimes. Both rising is a strong defensive signal.",
    ],
  },
  "/security": {
    tagline: "Your account security score, risk controls, and audit trail — keep your account and strategy protected.",
    steps: [
      { title: "Review your security score", body: "The score is based on 2FA status, API key age, session activity, and daily loss limits. Target 90+." },
      { title: "Set daily loss limits", body: "A daily loss limit automatically prevents emotional revenge trading. Set it at 3–5% of account value." },
      { title: "Review the audit trail", body: "Every action in WealthOS is logged. If something looks unfamiliar, investigate immediately." },
      { title: "Rotate API keys regularly", body: "If you have connected external integrations, rotate API keys every 90 days and delete any that are unused." },
    ],
    tips: [
      "Enable 2FA if you have not already. A compromised trading account is far more damaging than a compromised email.",
      "Check the audit log if your P&L looks unexpected — it will show you exactly what changed and when.",
    ],
  },
  "/settings": {
    tagline: "Configure your profile, risk preferences, and account behaviour — set it once, benefit every day.",
    steps: [
      { title: "Set your risk profile", body: "Conservative, Moderate, or Aggressive. This setting influences signal recommendations and default position sizing." },
      { title: "Configure daily loss limit", body: "Enter the dollar amount that stops you trading for the day if hit. This is your most important setting." },
      { title: "Update your profile", body: "Keep your email and notification preferences current. Critical alerts are delivered via notification." },
      { title: "Review connected integrations", body: "If you have broker connections or API keys configured, verify they are current and active." },
    ],
    tips: [
      "Revisit settings quarterly. Your risk tolerance and account size change — your settings should reflect that.",
      "The daily loss limit is not a suggestion. Set it and honour it — it exists for the days when you are not thinking clearly.",
    ],
  },
};

function getPageGuide(pathname: string): PageGuide {
  return PAGE_GUIDES[pathname] ?? {
    tagline: "Explore this page and use the AI Chat tab for questions about what you see.",
    steps: [
      { title: "Use AI Chat for guidance", body: "Ask the AI anything about this page — it has full context loaded for where you are." },
      { title: "Check the Decisions tab", body: "The Decisions tab shows you what to do on this specific page based on your portfolio." },
    ],
    tips: ["Every page in WealthOS has an AI Chat context loaded — ask it anything."],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
type Tab = "chat" | "research" | "journal" | "decisions" | "guide";

export default function RightBar() {
  const location = useLocation();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<Tab>("chat");

  // ── Chat state ─────────────────────────────────────────────────────────────
  type Msg = { role: "user" | "assistant"; content: string };
  const [messages, setMessages] = useState<Msg[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const pageCtx = getPageCtx(location.pathname);
  const PageIcon = pageCtx.icon;

  // Reset chat + show greeting when page changes
  useEffect(() => {
    const ctx = getPageCtx(location.pathname);
    setMessages([{
      role: "assistant",
      content: `**${ctx.label} context loaded.**\n\nI'm ready to help with questions about this page. Try a quick prompt or ask me anything.`,
    }]);
  }, [location.pathname]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || streaming) return;
    setChatInput("");
    setMessages(prev => [...prev, { role: "user", content: text }]);
    setStreaming(true);

    // Simulate streaming response
    const response = getAIResponse(text);
    const words = response.split(" ");
    let accumulated = "";

    setMessages(prev => [...prev, { role: "assistant", content: "" }]);

    for (const word of words) {
      accumulated += (accumulated ? " " : "") + word;
      const current = accumulated;
      setMessages(prev => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: current };
        return next;
      });
      await new Promise(r => setTimeout(r, 28));
    }

    setStreaming(false);
  }, [streaming]);

  // ── Research state ─────────────────────────────────────────────────────────
  const [researchQuery, setResearchQuery] = useState("");
  const [submitted, setSubmitted] = useState("");

  const submitResearch = () => {
    if (!researchQuery.trim()) return;
    setSubmitted(researchQuery.trim().toUpperCase());
  };

  // ── Decision Intelligence state ───────────────────────────────────────────
  const pageDec = getPageDecision(location.pathname);
  const [decChecked, setDecChecked] = useState<boolean[]>(Array(pageDec.checkpoints.length).fill(false));

  // Reset checklist when page changes
  useEffect(() => {
    const pd = getPageDecision(location.pathname);
    setDecChecked(Array(pd.checkpoints.length).fill(false));
  }, [location.pathname]);

  const decCheckedCount = decChecked.filter(Boolean).length;
  const decAllChecked = decCheckedCount === pageDec.checkpoints.length;
  const toggleDec = (i: number) => setDecChecked(prev => prev.map((v, idx) => idx === i ? !v : v));

  // ── Journal state ──────────────────────────────────────────────────────────
  const [entries, setEntries] = useState<JournalEntry[]>([
    {
      id: "j1", sentiment: "bullish", ticker: "NVDA",
      text: "Strong AI infrastructure demand. Entering on pullback to $850 with stop at $820.",
      page: "/positions", createdAt: new Date(Date.now() - 3_600_000 * 2),
    },
    {
      id: "j2", sentiment: "neutral", ticker: "SPY",
      text: "Waiting for FOMC decision before adding more equity exposure. Macro uncertain.",
      page: "/market-regime", createdAt: new Date(Date.now() - 3_600_000 * 6),
    },
  ]);
  const [noteText, setNoteText] = useState("");
  const [noteTicker, setNoteTicker] = useState("");
  const [noteSentiment, setNoteSentiment] = useState<JournalSentiment>("neutral");

  const addEntry = () => {
    if (!noteText.trim()) return;
    setEntries(prev => [{
      id: Math.random().toString(36).slice(2),
      text: noteText.trim(),
      ticker: noteTicker.trim().toUpperCase() || undefined,
      sentiment: noteSentiment,
      page: location.pathname,
      createdAt: new Date(),
    }, ...prev]);
    setNoteText("");
    setNoteTicker("");
    setNoteSentiment("neutral");
  };

  const deleteEntry = (id: string) => setEntries(prev => prev.filter(e => e.id !== id));

  function timeAgo(d: Date) {
    const m = Math.floor((Date.now() - d.getTime()) / 60_000);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  }

  const TABS: { id: Tab; icon: any; label: string }[] = [
    { id: "chat",      icon: MessageSquare, label: "Chat"     },
    { id: "decisions", icon: Brain,         label: "Decide"   },
    { id: "guide",     icon: HelpCircle,    label: "Guide"    },
    { id: "research",  icon: Search,        label: "Research" },
    { id: "journal",   icon: BookOpen,      label: "Journal"  },
  ];

  return (
    <div className="relative flex h-full shrink-0">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="absolute -left-3 top-6 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
        title={open ? "Collapse panel" : "Expand panel"}
      >
        {open ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex h-full flex-col overflow-hidden border-l border-border bg-card"
            style={{ minWidth: 0 }}
          >
            {/* Tab bar */}
            <div className="flex shrink-0 border-b border-border">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  title={t.label}
                  className={`flex flex-1 flex-col items-center gap-0.5 py-3 font-mono text-[9px] font-bold uppercase tracking-widest transition-colors ${
                    tab === t.id
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <t.icon size={14} />
                  {t.label}
                </button>
              ))}
            </div>

            {/* ══ AI CHAT ══ */}
            {tab === "chat" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Page context badge */}
                <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
                  <PageIcon size={11} className="text-primary" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{pageCtx.label} context</span>
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
                  {messages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground"
                          : "bg-accent/60 text-foreground"
                      }`}>
                        {msg.role === "assistant" ? (
                          <div className="prose prose-xs prose-invert max-w-none [&>p]:mb-1.5 [&>ul]:mb-1.5 [&>ul>li]:mb-0.5 [&>strong]:text-foreground [&>h3]:text-xs [&>h3]:font-bold [&>h3]:mb-1 [&>code]:bg-background/60 [&>code]:px-1 [&>code]:rounded [&>code]:font-mono [&>code]:text-[10px]">
                            <ReactMarkdown>{msg.content}</ReactMarkdown>
                          </div>
                        ) : (
                          <span>{msg.content}</span>
                        )}
                      </div>
                    </div>
                  ))}
                  {streaming && (
                    <div className="flex justify-start">
                      <div className="rounded-xl bg-accent/60 px-3 py-2">
                        <Loader2 size={12} className="animate-spin text-muted-foreground" />
                      </div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                {/* Quick prompts */}
                <div className="shrink-0 border-t border-border/50 px-3 py-2">
                  <p className="mb-1.5 font-mono text-[8px] uppercase tracking-widest text-muted-foreground">Quick prompts</p>
                  <div className="flex flex-wrap gap-1">
                    {pageCtx.prompts.map(p => (
                      <button
                        key={p}
                        onClick={() => sendMessage(p)}
                        disabled={streaming}
                        className="rounded-md border border-border bg-background px-2 py-1 font-mono text-[9px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-40"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Input */}
                <div className="shrink-0 border-t border-border p-3">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <input
                      value={chatInput}
                      onChange={e => setChatInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && !e.shiftKey && sendMessage(chatInput)}
                      placeholder="Ask anything…"
                      disabled={streaming}
                      className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50 disabled:opacity-50"
                    />
                    <button
                      onClick={() => sendMessage(chatInput)}
                      disabled={streaming || !chatInput.trim()}
                      className="text-primary transition-opacity disabled:opacity-30"
                    >
                      <Send size={13} />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ══ DECISION INTELLIGENCE ══ */}
            {tab === "decisions" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Page context badge */}
                <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
                  <Brain size={11} className="text-primary" />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{pageCtx.label} · Decisions</span>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                  {/* Brief */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2.5">
                    <p className="font-mono text-[10px] leading-relaxed text-foreground">{pageDec.brief}</p>
                  </div>

                  {/* Checklist */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">Decision Checkpoints</p>
                      <span className={`font-mono text-[9px] font-bold ${decAllChecked ? "text-bullish" : "text-muted-foreground"}`}>
                        {decCheckedCount}/{pageDec.checkpoints.length}
                      </span>
                    </div>
                    <div className="mb-2 h-1 w-full rounded-full bg-border overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        animate={{ width: `${(decCheckedCount / pageDec.checkpoints.length) * 100}%` }}
                        transition={{ type: "spring", stiffness: 200, damping: 25 }}
                      />
                    </div>
                    <div className="space-y-1">
                      {pageDec.checkpoints.map((cp, i) => (
                        <button
                          key={i}
                          onClick={() => toggleDec(i)}
                          className={`w-full flex items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                            decChecked[i] ? "bg-bullish/8" : "hover:bg-accent/40"
                          }`}
                        >
                          {decChecked[i]
                            ? <CheckCircle2 size={11} className="text-bullish shrink-0 mt-0.5" />
                            : <Circle size={11} className={`shrink-0 mt-0.5 ${cp.critical ? "text-bearish/50" : "text-border"}`} />}
                          <span className={`font-mono text-[10px] leading-snug ${
                            decChecked[i] ? "text-foreground" : cp.critical ? "text-foreground/80" : "text-muted-foreground"
                          }`}>
                            {cp.text}
                            {cp.critical && !decChecked[i] && <span className="ml-1 text-bearish">*</span>}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Verdict */}
                  <div className={`rounded-xl border px-3 py-2.5 ${
                    decAllChecked ? "border-bullish/30 bg-bullish/8"
                    : decCheckedCount > 0 ? "border-border bg-card"
                    : "border-border/50 bg-card/60"
                  }`}>
                    {decAllChecked ? (
                      <p className="font-mono text-[10px] text-bullish font-semibold">All checkpoints cleared. Ready to act.</p>
                    ) : (
                      <p className="font-mono text-[10px] text-muted-foreground leading-snug">
                        {pageDec.checkpoints.some(c => c.critical)
                          ? "Items marked * are critical — resolve before acting."
                          : "Work through the checklist before committing capital."}
                      </p>
                    )}
                  </div>

                  {/* Quick AI decision prompt */}
                  <button
                    onClick={() => { setTab("chat"); sendMessage(pageDec.aiPrompt); }}
                    className="w-full flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/8 px-3 py-2.5 text-left hover:bg-primary/15 transition-colors"
                  >
                    <Zap size={11} className="text-primary shrink-0 mt-0.5" />
                    <span className="font-mono text-[10px] text-primary flex-1 leading-snug">{pageDec.aiPrompt}</span>
                    <ArrowRight size={10} className="text-primary/60 shrink-0 mt-0.5" />
                  </button>

                  {/* Link to relevant page */}
                  {pageDec.link && (
                    <NavLink
                      to={pageDec.link.to}
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 hover:bg-accent transition-colors"
                    >
                      <span className="font-mono text-[10px] text-foreground">{pageDec.link.label}</span>
                      <ChevronRight size={11} className="text-muted-foreground" />
                    </NavLink>
                  )}

                  {pageDec.link?.to !== "/decisions" && (
                    <NavLink
                      to="/decisions"
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2.5 hover:border-primary/40 hover:bg-accent transition-colors"
                    >
                      <span className="font-mono text-[10px] text-foreground">Full Decision Hub</span>
                      <ChevronRight size={11} className="text-muted-foreground" />
                    </NavLink>
                  )}
                </div>
              </div>
            )}

            {/* ══ GUIDE ══ */}
            {tab === "guide" && (() => {
              const guide = getPageGuide(location.pathname);
              return (
                <div className="flex flex-1 flex-col overflow-hidden">
                  <div className="flex shrink-0 items-center gap-2 border-b border-border/50 px-3 py-2">
                    <HelpCircle size={11} className="text-primary" />
                    <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{pageCtx.label} · How-To Guide</span>
                  </div>

                  <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                    {/* Tagline */}
                    <p className="font-mono text-[11px] leading-relaxed text-foreground">{guide.tagline}</p>

                    {/* Steps */}
                    <div className="space-y-2">
                      <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Step by Step</p>
                      {guide.steps.map((step, i) => (
                        <div key={i} className="flex gap-2.5">
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 mt-0.5">
                            <span className="font-mono text-[9px] font-black text-primary">{i + 1}</span>
                          </div>
                          <div className="flex flex-col gap-0.5 pb-2 border-b border-border/30 last:border-0 flex-1">
                            <span className="font-mono text-[10px] font-bold text-foreground">{step.title}</span>
                            <span className="font-mono text-[10px] leading-relaxed text-muted-foreground">{step.body}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Key Concepts */}
                    {guide.concepts && guide.concepts.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Key Concepts</p>
                        {guide.concepts.map((c, i) => (
                          <div key={i} className="rounded-lg border border-border bg-background px-2.5 py-2">
                            <span className="font-mono text-[10px] font-black text-primary">{c.term}</span>
                            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground mt-0.5">{c.def}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Pro Tips */}
                    {guide.tips && guide.tips.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Pro Tips</p>
                        {guide.tips.map((tip, i) => (
                          <div key={i} className="flex gap-2 rounded-lg border border-watch/20 bg-watch/5 px-2.5 py-2">
                            <Lightbulb size={10} className="text-watch shrink-0 mt-0.5" />
                            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{tip}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Ask AI button */}
                    <button
                      onClick={() => { setTab("chat"); sendMessage(`Give me a detailed explanation of how to use the ${pageCtx.label} page effectively.`); }}
                      className="w-full flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/8 px-3 py-2.5 text-left hover:bg-primary/15 transition-colors"
                    >
                      <MessageSquare size={11} className="text-primary shrink-0" />
                      <span className="font-mono text-[10px] text-primary">Ask AI for more detail</span>
                      <ArrowRight size={10} className="text-primary/60 ml-auto" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* ══ RESEARCH ══ */}
            {tab === "research" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Search bar */}
                <div className="shrink-0 border-b border-border p-3">
                  <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
                    <Search size={12} className="shrink-0 text-muted-foreground" />
                    <input
                      value={researchQuery}
                      onChange={e => setResearchQuery(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && submitResearch()}
                      placeholder="Ticker or topic (e.g. NVDA)"
                      className="flex-1 bg-transparent font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
                    />
                    {researchQuery && (
                      <button onClick={() => { setResearchQuery(""); setSubmitted(""); }} className="text-muted-foreground hover:text-foreground">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <button
                    onClick={submitResearch}
                    disabled={!researchQuery.trim()}
                    className="mt-2 w-full rounded-xl bg-primary py-2 font-mono text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    Research {researchQuery ? researchQuery.toUpperCase() : "…"}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
                  {submitted ? (
                    <>
                      {/* Ticker quick-links */}
                      <div>
                        <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          {submitted} — Open In
                        </p>
                        <div className="space-y-1.5">
                          {RESEARCH_SOURCES.map(src => (
                            <a
                              key={src.label}
                              href={src.url(submitted)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{src.icon}</span>
                                <span className="font-mono text-xs text-foreground">{src.label}</span>
                              </div>
                              <ExternalLink size={10} className="text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-border pt-3">
                        <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          Macro & Tools
                        </p>
                        <div className="space-y-1.5">
                          {MACRO_LINKS.map(src => (
                            <a
                              key={src.label}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{src.icon}</span>
                                <span className="font-mono text-xs text-foreground">{src.label}</span>
                              </div>
                              <ExternalLink size={10} className="text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Default state — macro links */}
                      <div>
                        <p className="mb-2 font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                          Macro & Research
                        </p>
                        <div className="space-y-1.5">
                          {MACRO_LINKS.map(src => (
                            <a
                              key={src.label}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2.5 transition-colors hover:border-primary/40 hover:bg-accent"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{src.icon}</span>
                                <span className="font-mono text-xs text-foreground">{src.label}</span>
                              </div>
                              <ExternalLink size={10} className="text-muted-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-background p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <Lightbulb size={11} className="text-watch" />
                          <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Tip</span>
                        </div>
                        <p className="font-mono text-[10px] text-muted-foreground leading-relaxed">
                          Enter a ticker (e.g. AAPL, BTC) or a topic (e.g. "yield curve") to open it in Yahoo Finance, TradingView, Finviz, and more in one click.
                        </p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* ══ JOURNAL ══ */}
            {tab === "journal" && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* New entry composer */}
                <div className="shrink-0 space-y-2 border-b border-border p-3">
                  <textarea
                    value={noteText}
                    onChange={e => setNoteText(e.target.value)}
                    placeholder="Log a trade idea, observation, or thesis…"
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/40"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={noteTicker}
                      onChange={e => setNoteTicker(e.target.value.toUpperCase())}
                      placeholder="Ticker"
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                    />
                    {/* Sentiment selector */}
                    <div className="flex flex-1 overflow-hidden rounded-lg border border-border">
                      {(["bullish", "neutral", "bearish"] as const).map(s => {
                        const cfg = SENTIMENT_CFG[s];
                        const Icon = cfg.icon;
                        return (
                          <button
                            key={s}
                            onClick={() => setNoteSentiment(s)}
                            className={`flex flex-1 items-center justify-center py-1.5 transition-all ${
                              noteSentiment === s ? `${cfg.bg} ${cfg.color}` : "bg-background text-muted-foreground"
                            }`}
                          >
                            <Icon size={11} />
                          </button>
                        );
                      })}
                    </div>
                    <button
                      onClick={addEntry}
                      disabled={!noteText.trim()}
                      className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 font-mono text-[10px] font-bold text-primary-foreground disabled:opacity-40"
                    >
                      <Plus size={11} /> Log
                    </button>
                  </div>
                </div>

                {/* Entries */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
                  {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12">
                      <BookOpen size={24} className="text-muted-foreground/20" />
                      <p className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground/40">No entries yet</p>
                    </div>
                  ) : entries.map((entry, i) => {
                    const cfg = SENTIMENT_CFG[entry.sentiment];
                    const Icon = cfg.icon;
                    const pageLabel = PAGE_CONTEXT[entry.page]?.label ?? entry.page;
                    return (
                      <motion.div
                        key={entry.id}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className={`rounded-xl border p-3 ${cfg.bg}`}
                      >
                        <div className="mb-1.5 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Icon size={10} className={cfg.color} />
                            {entry.ticker && (
                              <span className={`font-mono text-[10px] font-black ${cfg.color}`}>{entry.ticker}</span>
                            )}
                            <span className={`rounded-full px-1.5 py-0.5 font-mono text-[8px] font-bold ${cfg.bg} ${cfg.color}`}>
                              {cfg.label}
                            </span>
                          </div>
                          <button onClick={() => deleteEntry(entry.id)} className="text-muted-foreground/40 hover:text-bearish">
                            <Trash2 size={10} />
                          </button>
                        </div>
                        <p className="font-mono text-[10px] leading-relaxed text-foreground">{entry.text}</p>
                        <div className="mt-2 flex items-center gap-2 text-muted-foreground/50">
                          <Clock size={8} />
                          <span className="font-mono text-[8px]">{timeAgo(entry.createdAt)}</span>
                          <Tag size={8} className="ml-1" />
                          <span className="font-mono text-[8px]">{pageLabel}</span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
