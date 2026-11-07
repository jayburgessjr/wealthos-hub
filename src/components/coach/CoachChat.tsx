import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useCoachChat } from "@/hooks/useCoachChat";

const quickPrompts = ["I have $1, where do I start?", "Help me pay off debt", "Give me ideas to earn more", "Build me a simple plan"];

export function CoachChat() {
  const { messages, send, loading, hydrating, notice } = useCoachChat();
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const lastContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages.length, lastContent]);

  const submit = (text: string) => {
    if (!text.trim() || loading) return;
    send(text);
    setInput("");
  };

  return (
    <div className="flex min-h-[28rem] flex-1 flex-col">
      <div className="mb-3 flex flex-wrap gap-2">
        {quickPrompts.map((q) => (
          <button
            key={q}
            onClick={() => submit(q)}
            disabled={loading}
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground disabled:opacity-50"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto rounded-t-lg border border-b-0 border-border bg-card p-4" aria-busy={hydrating}>
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`msg-${m.role}`}>
            <div className={`max-w-[88%] rounded-lg px-4 py-3 text-sm leading-relaxed ${m.role === "user" ? "bg-primary/10 text-foreground" : "bg-accent text-foreground"}`}>
              {m.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none">
                  <ReactMarkdown disallowedElements={["img"]}>{m.content}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{m.content}</div>
              )}
            </div>
          </div>
        ))}
        {loading && messages[messages.length - 1]?.role === "user" && <p className="text-xs text-muted-foreground">The coach is thinking...</p>}
        {notice && (
          <p className="text-xs text-muted-foreground" role="status">
            {notice}
          </p>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex items-center gap-2 rounded-b-lg border border-border bg-card p-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit(input)}
          placeholder="Tell me about your goal, or ask a question"
          maxLength={4000}
          aria-label="Message the coach"
          className="flex-1 bg-transparent font-body text-sm text-foreground outline-none placeholder:text-muted-foreground"
          disabled={loading}
        />
        <button
          onClick={() => submit(input)}
          disabled={loading || !input.trim()}
          aria-label="Send"
          className="rounded-lg bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
