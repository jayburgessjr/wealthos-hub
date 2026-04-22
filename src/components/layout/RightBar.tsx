import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Search, BookOpen, Send, ChevronRight,
  ChevronLeft, Loader2, ExternalLink, Plus, Trash2,
  TrendingUp, TrendingDown, Minus, Tag, Clock, X,
  Lightbulb, BarChart2, Globe, Cpu, Newspaper, Shield,
  Zap, Briefcase, Radar
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

// ─────────────────────────────────────────────────────────────────────────────
type Tab = "chat" | "research" | "journal";

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
    { id: "chat",     icon: MessageSquare, label: "AI Chat"  },
    { id: "research", icon: Search,        label: "Research" },
    { id: "journal",  icon: BookOpen,      label: "Journal"  },
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
