import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState } from "react";
import { Send } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

const quickPrompts = [
  "What should I buy today?",
  "Review my positions",
  "What's my risk exposure?",
  "How do I compound faster?",
];

export default function AIAdvisor() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Welcome to WealthOS AI Advisor. I have access to your portfolio, signals, and market data. How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Msg = { role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setInput("");
    setLoading(true);

    // Placeholder AI response
    setTimeout(() => {
      setMessages((p) => [
        ...p,
        {
          role: "assistant",
          content: `Based on your current portfolio of $24,830 with 73.2% win rate, here's my analysis:\n\n**Top Priority:** NVDA (Signal: 87/100) remains your strongest conviction trade. The AI chip demand narrative is accelerating.\n\n**Risk Note:** Your AMZN position (Signal: 31) is flagged for exit. Consider closing to lock in the +4.1% gain before earnings.\n\n**Compound Strategy:** At your current trajectory, you're on track to reach $52K by month 24. Increasing monthly contributions by $100 would accelerate this to $58K.`,
        },
      ]);
      setLoading(false);
    }, 1200);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
        <h2 className="mb-4 font-display text-xl font-bold text-foreground">AI Advisor</h2>

        {/* Quick Prompts */}
        <div className="mb-4 flex flex-wrap gap-2">
          {quickPrompts.map((q) => (
            <button
              key={q}
              onClick={() => send(q)}
              className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-fast hover:border-bullish/30 hover:text-foreground"
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
                className={`max-w-[80%] rounded-lg px-4 py-3 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-bullish/10 text-foreground"
                    : "bg-accent text-foreground"
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="flex gap-1 rounded-lg bg-accent px-4 py-3">
                <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.2s]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-muted-foreground [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex items-center gap-2 rounded-b-lg border border-border bg-card p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Ask about your portfolio, signals, or strategy..."
            className="flex-1 bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            onClick={() => send(input)}
            disabled={loading}
            className="rounded-lg bg-bullish p-2 text-primary-foreground transition-fast hover:brightness-110 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}
