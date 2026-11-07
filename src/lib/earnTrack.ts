// "Earn more" ladder track. Pure and separate from wealthLadder.ts so the 7-stage ladder and its tests stay untouched.

export interface EarnInput {
  incomeItems: { title: string; body: string; effort?: string; monthlyGain?: number }[];
  /** Open and finished earn-track actions, in priority order. monthlyGain is the linked idea's illustrative estimate. */
  earnActions: { title: string; status: "todo" | "done" | "dismissed" | string; monthlyGain?: number }[];
  planActive: boolean;
}

export type EarnState = "no_plan" | "ideas" | "in_progress" | "done";

export interface EarnTrack {
  state: EarnState;
  headline: string;
  next?: { title: string; why: string };
  openCount: number;
  doneCount: number;
  monthlyGainDone?: number;
}

export function computeEarnTrack(input: EarnInput): EarnTrack {
  const live = input.earnActions.filter((a) => a.status !== "dismissed");
  const open = live.filter((a) => a.status !== "done");
  const done = live.filter((a) => a.status === "done");
  const gain = done.reduce((s, a) => s + (a.monthlyGain ?? 0), 0);
  const monthlyGainDone = gain > 0 ? gain : undefined;

  if (!input.planActive || (input.incomeItems.length === 0 && live.length === 0)) {
    return { state: "no_plan", headline: "Tell the coach about your income", openCount: 0, doneCount: 0 };
  }
  if (live.length > 0 && open.length === 0) {
    return { state: "done", headline: "You finished your earn more steps", openCount: 0, doneCount: done.length, monthlyGainDone };
  }
  if (done.length > 0) {
    return {
      state: "in_progress",
      headline: `${done.length} done, ${open.length} to go`,
      next: { title: open[0].title, why: "This is your next step to earn more." },
      openCount: open.length,
      doneCount: done.length,
      monthlyGainDone,
    };
  }
  const first = open[0];
  const idea = input.incomeItems[0];
  const n = Math.max(input.incomeItems.length, open.length);
  return {
    state: "ideas",
    headline: n === 1 ? "1 way to earn more is ready" : `${n} ways to earn more are ready`,
    next: first ? { title: first.title, why: idea?.body || "This is your first step to earn more." } : idea ? { title: idea.title, why: idea.body } : undefined,
    openCount: open.length,
    doneCount: 0,
  };
}
