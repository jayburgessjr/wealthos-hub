import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPortfolio, sandboxPositions, sandboxSignals } from "@/data/sandboxData";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { CalendarDays, RefreshCw, Sparkles } from "lucide-react";

const BRIEFING_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/weekly-briefing`;

const DEMO_BRIEFING = `## Week of April 28, 2026

### What Happened Last Week
- Portfolio gained **+3.2%** — NVDA and BTC led the charge with breakout moves
- TSLA covered call generated **$340** in premium income despite sideways price action
- Overall win rate held at **78%** across 4 closed trades

### Market Regime This Week
Risk-On conditions persist. VIX at 13.2 signals low fear — momentum strategies are working. Stay long quality growth names.

### Top 3 Moves This Week
1. **MSFT** — Add to position on any dip below $415, AI revenue cycle accelerating
2. **NVDA** — Take 25% profits above $900, trail stop on remainder
3. **AAPL** — Initiate starter position, support holding at $170

### What to Avoid
- Chasing any meme stocks or low-cap crypto this week
- Opening new positions before Friday's Fed speaker event
- Increasing exposure to energy — sector showing distribution

### Risk Level This Week
**MODERATE** — Strong macro backdrop but extended valuations warrant disciplined sizing. Max 3% per new position.`;

function getWeekRange(): { label: string; weekOf: string } {
  const now = new Date();
  // Find Monday of the current week
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  const fmtYear = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  return {
    label: `${fmt(monday)} – ${fmtYear(sunday)}`,
    weekOf: monday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  };
}

async function streamBriefing({
  portfolio,
  positions,
  signals,
  weekOf,
  onDelta,
  onDone,
  onError,
}: {
  portfolio: any;
  positions: any[];
  signals: any[];
  weekOf: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
}) {
  const resp = await fetch(BRIEFING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ portfolio, positions, signals, weekOf }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    onError(err.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) { onError("No response body"); return; }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let done = false;

  while (!done) {
    const { done: readerDone, value } = await reader.read();
    if (readerDone) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") { done = true; break; }
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  // Flush remaining buffer
  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {}
    }
  }
  onDone();
}

export default function WeeklyBriefing() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const { label: weekLabel, weekOf } = getWeekRange();

  const [briefing, setBriefing] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatedAt, setGeneratedAt] = useState<Date | null>(null);

  const { data: portfolio } = useQuery({
    queryKey: ["portfolio", user?.id, isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase
        .from("portfolios")
        .select("*")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ["positions", user?.id, "open", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase
        .from("positions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("status", "open");
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const { data: signals = [] } = useQuery({
    queryKey: ["signals", "top", isDemoMode ? "demo" : "live"],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals;
      const { data } = await supabase
        .from("signals")
        .select("*")
        .order("signal_score", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  const generate = async () => {
    if (loading) return;
    setBriefing("");
    setLoading(true);

    if (isDemoMode) {
      // Simulate streaming for demo mode
      const words = DEMO_BRIEFING.split(/(?<=\s)/);
      for (const chunk of words) {
        setBriefing((prev) => prev + chunk);
        await new Promise((r) => setTimeout(r, 18));
      }
      setLoading(false);
      setGeneratedAt(new Date());
      return;
    }

    let accumulated = "";
    await streamBriefing({
      portfolio,
      positions: positions.map((p: any) => ({
        ticker: p.ticker,
        strategy_type: p.strategy_type,
        value: p.value,
        pnl_percent: p.pnl_percent,
        signal_score: p.signal_score,
      })),
      signals: signals.map((s: any) => ({
        ticker: s.ticker,
        signal_score: s.signal_score,
        action: s.action,
        entry_price: s.entry_price,
        target_price: s.target_price,
      })),
      weekOf,
      onDelta: (chunk) => {
        accumulated += chunk;
        setBriefing(accumulated);
      },
      onDone: () => {
        setLoading(false);
        setGeneratedAt(new Date());
      },
      onError: (msg) => {
        toast.error(msg);
        setLoading(false);
      },
    });
  };

  const hasBriefing = briefing.length > 0;

  return (
    <DashboardLayout>
      <SubscriptionGate>
        <div className="mx-auto max-w-3xl">
          {/* Header */}
          <div className="mb-6 flex items-start justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">Weekly Briefing</h2>
              <div className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{weekLabel}</span>
              </div>
            </div>
            {hasBriefing && !loading && (
              <button
                onClick={generate}
                className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm text-muted-foreground transition-fast hover:border-bullish/30 hover:text-foreground"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            )}
          </div>

          {/* Empty state — generate button */}
          {!hasBriefing && !loading && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center">
              <div className="mb-4 rounded-full bg-bullish/10 p-4">
                <Sparkles className="h-8 w-8 text-bullish" />
              </div>
              <h3 className="mb-2 font-display text-lg font-semibold text-foreground">
                Your briefing is ready to generate
              </h3>
              <p className="mb-8 max-w-sm text-sm text-muted-foreground">
                Get a personalized Monday morning analysis — portfolio recap, market regime, top moves, and risk level.
              </p>
              <button
                onClick={generate}
                className="flex items-center gap-2 rounded-xl bg-bullish px-6 py-3 font-semibold text-primary-foreground shadow-lg transition-fast hover:brightness-110"
              >
                <Sparkles className="h-4 w-4" />
                Generate This Week's Briefing
              </button>
            </div>
          )}

          {/* Loading state */}
          {loading && briefing.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-card py-20 text-center">
              <div className="mb-4 flex gap-2">
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bullish" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bullish [animation-delay:0.2s]" />
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-bullish [animation-delay:0.4s]" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">Analyzing your portfolio...</p>
            </div>
          )}

          {/* Briefing card — shown while streaming or after complete */}
          {hasBriefing && (
            <div className="rounded-xl border border-border bg-card">
              {/* Card header */}
              <div className="flex items-center justify-between border-b border-border px-6 py-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-bullish" />
                  <span className="text-sm font-semibold text-foreground">AI Weekly Briefing</span>
                  {loading && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-bullish" />
                      Generating...
                    </span>
                  )}
                </div>
                {generatedAt && !loading && (
                  <span className="text-xs text-muted-foreground">
                    Last generated:{" "}
                    {generatedAt.toLocaleTimeString("en-US", {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>

              {/* Markdown content */}
              <div className="px-6 py-6">
                <div
                  className={[
                    "prose prose-sm prose-invert max-w-none",
                    // Headings
                    "[&_h2]:font-display [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_h2]:mb-4 [&_h2]:mt-0",
                    "[&_h3]:font-display [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:mb-2 [&_h3]:mt-6",
                    // Paragraphs
                    "[&_p]:text-muted-foreground [&_p]:leading-relaxed [&_p]:mb-3",
                    // Lists
                    "[&_ul]:space-y-1.5 [&_ul]:mb-3 [&_ul]:pl-0 [&_ul]:list-none",
                    "[&_ol]:space-y-1.5 [&_ol]:mb-3 [&_ol]:pl-4",
                    "[&_li]:text-muted-foreground [&_li]:leading-relaxed",
                    "[&_ul>li]:before:content-['–'] [&_ul>li]:before:mr-2 [&_ul>li]:before:text-bullish",
                    // Bold (ticker names)
                    "[&_strong]:text-foreground [&_strong]:font-semibold",
                    // Horizontal rule
                    "[&_hr]:border-border [&_hr]:my-4",
                  ].join(" ")}
                >
                  <ReactMarkdown>{briefing}</ReactMarkdown>
                </div>
              </div>
            </div>
          )}
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
