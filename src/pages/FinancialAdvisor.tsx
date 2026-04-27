import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { useState, useRef, useEffect } from "react";
import { Send, AlertTriangle, ChevronDown, ChevronUp, Brain } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { sandboxPortfolio } from "@/data/sandboxData";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-advisor`;

const quickPrompts = [
  "Build me a wealth accumulation strategy",
  "How should I allocate my portfolio?",
  "Optimize my retirement contributions",
  "Create a tax-efficient investment plan",
  "Build an income strategy",
  "How do I hedge against a market downturn?",
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
    await new Promise((r) => setTimeout(r, 800));
    const mockResponse = `## Wealth Accumulation Strategy

**Strategy Overview**
Based on your sandbox portfolio ($124.5k), I recommend a three-pillar approach:

1. **Core Growth (60%)** — Broad-market index funds (VTI, VXUS) for long-term compounding
2. **Tactical Allocation (30%)** — Sector rotation using your current momentum signals (NVDA, BTC are performing well)
3. **Income Buffer (10%)** — Covered calls on existing positions + short-term bonds for stability

**Implementation Steps**
- Rebalance quarterly to maintain target allocation
- Max out tax-advantaged accounts first (401k → IRA → taxable)
- Deploy available $18.2k into VTI over 3 months via DCA

**Risk Considerations**
- Current market regime: Risk-On — suitable for growth tilt
- Ensure 6-month emergency fund is separate from this portfolio

> *This is AI-generated analysis. Please consult a licensed financial advisor before executing major financial decisions.*`;
    const words = mockResponse.split(" ");
    for (const word of words) {
      onDelta(word + " ");
      await new Promise((r) => setTimeout(r, 30));
    }
    onDone();
    return;
  }

  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, context, mode: "financial-advisor" }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: "Request failed" }));
    onError(err.error || `Error ${resp.status}`);
    return;
  }

  if (!resp.body) {
    onError("No response body");
    return;
  }

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
      if (json === "[DONE]") {
        done = true;
        break;
      }
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

function DisclaimerBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3">
      <button
        className="flex w-full items-center gap-2 text-left"
        onClick={() => setExpanded((v) => !v)}
      >
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <span className="flex-1 text-xs font-semibold text-amber-400">
          Important Disclaimer — AI-Generated Financial Information
        </span>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 text-amber-500/70" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 text-amber-500/70" />
        )}
      </button>
      {expanded && (
        <div className="mt-3 space-y-2 border-t border-amber-500/20 pt-3 text-xs text-amber-200/70 leading-relaxed">
          <p>
            <strong className="text-amber-300">Not Financial Advice.</strong> The WealthOS Financial Advisor is an AI tool designed to help you think through financial strategies and concepts. It is not a licensed financial advisor, investment advisor, broker-dealer, or CPA. Nothing provided here constitutes legal, tax, or investment advice.
          </p>
          <p>
            <strong className="text-amber-300">Consult a Professional.</strong> Before making any significant financial decisions — including but not limited to investments, retirement planning, tax strategies, or estate planning — you should consult with a qualified, licensed financial advisor, certified public accountant (CPA), or attorney.
          </p>
          <p>
            <strong className="text-amber-300">No Guarantees.</strong> Past performance is not indicative of future results. All investing involves risk, including the potential loss of principal. Any projections or estimates presented are illustrative only.
          </p>
          <p>
            <strong className="text-amber-300">Regulatory Notice.</strong> WealthOS is not registered with the SEC, FINRA, or any other regulatory body as an investment advisor. This service is provided for educational and informational purposes only.
          </p>
        </div>
      )}
    </div>
  );
}

export default function FinancialAdvisor() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        "Welcome to the **WealthOS Financial Advisor** — your AI-powered financial strategy partner.\n\nI'm trained to help you build comprehensive financial strategies: portfolio construction, retirement planning, tax optimization, income strategies, and wealth accumulation frameworks.\n\nTell me about your financial goals, current situation, or ask me to develop a specific strategy.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

    const context = {
      portfolio: portfolio
        ? {
            total_capital: portfolio.total_capital,
            available_capital: portfolio.available_capital,
            win_rate: portfolio.win_rate,
            risk_tier: portfolio.risk_tier,
          }
        : null,
    };

    let assistantSoFar = "";
    const upsertAssistant = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && prev.length > newMessages.length) {
          return prev.map((m, i) =>
            i === prev.length - 1 ? { ...m, content: assistantSoFar } : m
          );
        }
        return [
          ...prev.slice(0, newMessages.length),
          { role: "assistant" as const, content: assistantSoFar },
        ];
      });
    };

    await streamChat({
      isDemo: isDemoMode,
      messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
      context,
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
        <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
          {/* Header */}
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-500/10 border border-violet-500/20">
              <Brain className="h-5 w-5 text-violet-400" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-foreground leading-none">
                Financial Advisor
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI-powered strategy development
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <DisclaimerBanner />

          {/* Quick Prompts */}
          <div className="mb-4 flex flex-wrap gap-2">
            {quickPrompts.map((q) => (
              <button
                key={q}
                onClick={() => send(q)}
                disabled={loading}
                className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-fast hover:border-violet-500/30 hover:text-foreground disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Chat */}
          <div className="flex-1 overflow-y-auto rounded-t-lg border border-b-0 border-border bg-card p-4 space-y-4">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-violet-500/10 text-foreground"
                      : "bg-accent text-foreground"
                  }`}
                >
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_strong]:text-foreground [&_code]:text-violet-400 [&_code]:bg-background [&_code]:px-1 [&_code]:rounded [&_pre]:bg-background [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_table]:text-xs [&_th]:text-muted-foreground [&_blockquote]:border-l-amber-500/50 [&_blockquote]:text-amber-200/70 [&_blockquote]:text-xs">
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
              onKeyDown={(e) =>
                e.key === "Enter" && !e.shiftKey && send(input)
              }
              placeholder="Describe your financial goals or ask for a strategy..."
              className="flex-1 bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground"
              disabled={loading}
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="rounded-lg bg-violet-600 p-2 text-white transition-fast hover:brightness-110 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
