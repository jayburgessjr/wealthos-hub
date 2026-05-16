import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPortfolio, sandboxPositions, sandboxSignals } from "@/data/sandboxData";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { streamInvoke } from "@/lib/streamInvoke";

type Msg = { role: "user" | "assistant"; content: string };

const quickPrompts = [
  "What should I buy today?",
  "Review my positions",
  "What's my risk exposure?",
  "How do I compound faster?",
];

async function streamChat({
  messages,
  context,
  onDelta,
  onDone,
  onError,
  isDemo,
}: {
  messages: Msg[];
  context: any;
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (msg: string) => void;
  isDemo?: boolean;
}) {
  if (isDemo) {
    // Simulate thinking
    await new Promise(r => setTimeout(r, 800));
    const mockResponse = "In demo mode, I'm analyzing the sandbox portfolio ($124.5k capital). Your current positions in **NVDA** and **BTC** are performing exceptionally well. I recommend looking into **AAPL** or **MSFT** based on today's high signal scores. Your risk exposure is currently moderate.";
    const words = mockResponse.split(" ");
    for (let word of words) {
      onDelta(word + " ");
      await new Promise(r => setTimeout(r, 50));
    }
    onDone();
    return;
  }

  await streamInvoke("ai-advisor", { messages, context }, { onDelta, onDone, onError });
}

export default function AIAdvisor() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Welcome to **AJE AI Advisor**. I have access to your portfolio, open positions, signal scores, and market regime.\n\nAsk me anything — or use the quick prompts below." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: portfolio } = useQuery({
    queryKey: ['portfolio', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxPortfolio;
      const { data } = await supabase
        .from('portfolios')
        .select('*')
        .eq('user_id', user!.id)
        .single();
      return data;
    },
    enabled: !!user || isDemoMode,
  });

  const { data: openPositions = [] } = useQuery({
    queryKey: ['positions', user?.id, 'open', isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxPositions;
      const { data } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', user!.id)
        .eq('status', 'open');
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const { data: topSignals = [] } = useQuery({
    queryKey: ['signals', 'top', isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals;
      const { data } = await supabase
        .from('signals')
        .select('*')
        .order('signal_score', { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    const contextString = `
PORTFOLIO: Total $${portfolio?.total_capital ?? 0}, 
Available $${portfolio?.available_capital ?? 0}, 
P&L $${portfolio?.total_pnl ?? 0}, 
Win Rate ${portfolio?.win_rate ?? 0}%

OPEN POSITIONS (${openPositions.length}):
${openPositions.map(p => 
  `${p.ticker} ${p.strategy_type} $${p.value} 
   P&L ${p.pnl_percent}%`).join('\n') || 'None'}

TOP SIGNALS:
${topSignals.map(s => 
  `${s.ticker} Score:${s.signal_score} 
   ${s.action}`).join('\n') || 'None generated yet'}
`;

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > newMessages.length) {
          return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
        }
        return [...prev.slice(0, newMessages.length), { role: "assistant", content: assistantSoFar }];
      });
    };

    await streamChat({
      isDemo: isDemoMode,
      messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      context: { 
        raw_context: contextString,
        portfolio,
        positions: openPositions.map(p => ({
          ticker: p.ticker,
          strategy_type: p.strategy_type,
          value: p.value,
          pnl_percent: p.pnl_percent,
          signal_score: p.signal_score
        })),
        signals: topSignals.map(s => ({
          ticker: s.ticker,
          signal_score: s.signal_score,
          action: s.action
        })),
        marketRegime: "Risk-On"
      },
      onDelta: upsertAssistant,
      onDone: () => setLoading(false),
      onError: (msg) => {
        toast.error(msg);
        setLoading(false);
      },
    });
  };

  return (
    <DashboardLayout>
      <SubscriptionGate>
        <div className="flex h-[calc(100vh-8rem)] flex-col">
          <h2 className="mb-4 font-display text-xl font-bold text-foreground">AI Advisor</h2>

          {/* Quick Prompts */}
          <div className="mb-4 flex flex-wrap gap-2">
            {quickPrompts.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-fast hover:border-bullish/30 hover:text-foreground disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat */}
          <div className="flex-1 overflow-y-auto rounded-t-lg border border-b-0 border-border bg-card p-4 space-y-4">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-bullish/10 text-foreground"
                      : "bg-accent text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_strong]:text-foreground [&_code]:text-bullish [&_code]:bg-background [&_code]:px-1 [&_code]:rounded [&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="flex gap-1 rounded-lg bg-accent px-4 py-3">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                  <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="flex items-center gap-2 rounded-b-lg border border-border bg-card p-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send(input)}
              placeholder="Ask about your portfolio, signals, or strategy..."
              className="flex-1 bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-bullish p-2 text-primary-foreground transition-fast hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
