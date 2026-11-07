// Coach chat: history is hydrated from strategy_messages (resumes the interview); sends stream through ai-advisor
// mode "coach". Demo mode uses a canned reply and makes no database or network calls.
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/components/AuthProvider";
import { useDemo } from "@/components/DemoProvider";
import { coachDb } from "@/lib/coachDb";
import { loadAnswers } from "@/lib/onboardingProfile";
import { streamInvoke } from "@/lib/streamInvoke";
import type { StrategyMessageRow } from "@/lib/coachTypes";
import { useCoachKey } from "@/hooks/useCoachPlan";

export interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export const COACH_WELCOME: ChatMsg = {
  role: "assistant",
  content:
    "Hi, I'm AJE Coach. I help you make a simple money plan, even if you are starting with $1.\n\nTo begin: what is the main thing you want your money to do for you?",
};

const DEMO_REPLY = `Here is a sample of how I would start.

**First steps**
1. Write down what you owe and the interest rate on each debt.
2. Put a small amount aside each week, even $5.
3. Pick one way to earn a little extra, like selling something you no longer use.

This is educational planning from an AI, not personalized financial, tax or legal advice. Consider a licensed professional for big decisions.`;

export function useCoachHistory() {
  const { key, uid, demo } = useCoachKey("messages");
  return useQuery<ChatMsg[]>({
    queryKey: key,
    enabled: !demo && !!uid,
    queryFn: async () => {
      const { data, error } = await coachDb.from("strategy_messages").select("role,content,created_at").order("created_at", { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      return ((data ?? []) as StrategyMessageRow[]).reverse().map((m) => ({ role: m.role, content: m.content }));
    },
  });
}

export function useCoachChat() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();
  const qc = useQueryClient();
  const history = useCoachHistory();
  const [pending, setPending] = useState<ChatMsg[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async (text: string) => {
      setNotice(null);
      setPending([{ role: "user", content: text }]);
      let reply = "";
      const setReply = (chunk: string) => {
        reply += chunk;
        setPending([{ role: "user", content: text }, { role: "assistant", content: reply }]);
      };
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 300));
        setReply(DEMO_REPLY);
        return;
      }
      let failed: string | null = null;
      await streamInvoke(
        "ai-advisor",
        { mode: "coach", message: text, client_msg_id: crypto.randomUUID(), hints: user ? hintsFor(user.id) : undefined },
        {
          onDelta: setReply,
          onDone: () => undefined,
          onError: (m) => {
            failed = m;
          },
          onEvent: (e) => {
            const ev = e as { type?: string } | null;
            if (ev?.type === "applied") {
              void qc.invalidateQueries({ queryKey: ["coach"] });
              toast.success("Plan updated");
            } else if (ev?.type === "rejected") {
              setNotice("I could not save that plan change. Ask me again and I will try once more.");
            } else if (ev?.type === "replayed") {
              void qc.invalidateQueries({ queryKey: ["coach"] });
            }
          },
        },
      );
      if (failed) throw new Error(failed);
    },
    onSuccess: async () => {
      if (!isDemoMode) await qc.invalidateQueries({ queryKey: ["coach", "messages"] });
      if (!isDemoMode) setPending([]);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setPending([]);
    },
  });

  const base: ChatMsg[] = isDemoMode ? [COACH_WELCOME] : history.data && history.data.length ? history.data : [COACH_WELCOME];
  const messages = [...base, ...pending];
  return {
    messages,
    send: (text: string) => (text.trim() && !mutation.isPending ? mutation.mutate(text.trim()) : undefined),
    loading: mutation.isPending,
    hydrating: !isDemoMode && history.isLoading,
    notice,
  };
}

function hintsFor(userId: string) {
  const a = loadAnswers(userId);
  if (!a) return undefined;
  return { goal: a.goal, experience: a.experience, risk: a.risk, startingAmount: a.startingAmount, hasEmergencyFund: a.hasEmergencyFund, hasHighInterestDebt: a.hasHighInterestDebt };
}
