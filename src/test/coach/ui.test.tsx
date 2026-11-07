import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({
  demo: true,
  user: null as null | { id: string; email: string },
  calls: [] as string[],
  updates: [] as { table: string; values: Record<string, unknown> }[],
  rpcs: [] as { fn: string; args: unknown }[],
  invokes: 0,
  getSession: vi.fn(async () => ({ data: { session: { access_token: "tok" } } })),
}));

vi.mock("@/integrations/supabase/client", () => {
  const make = (table: string) => {
    h.calls.push(table);
    const state = { values: undefined as Record<string, unknown> | undefined };
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "order", "limit", "eq", "is", "insert", "delete", "upsert"]) chain[k] = () => chain;
    chain.update = (v: Record<string, unknown>) => {
      state.values = v;
      h.updates.push({ table, values: v });
      return chain;
    };
    chain.maybeSingle = () => Promise.resolve({ data: null, error: null });
    chain.then = (r: (v: unknown) => unknown) => r({ data: [], error: null });
    return chain;
  };
  return {
    supabase: {
      from: (t: string) => make(t),
      rpc: (fn: string, args: unknown) => {
        h.rpcs.push({ fn, args });
        return Promise.resolve({ data: null, error: null });
      },
      functions: { invoke: () => { h.invokes++; return Promise.resolve({ data: null, error: null }); } },
      auth: { getSession: h.getSession, signOut: vi.fn() },
    },
  };
});
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: h.user }) }));
vi.mock("@/components/DemoProvider", () => ({ useDemo: () => ({ isDemoMode: h.demo }) }));
vi.mock("@/components/layout/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/components/SubscriptionGate", () => ({ SubscriptionGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() } }));

import { toast } from "sonner";
import FinancialAdvisor from "@/pages/FinancialAdvisor";
import { StrategySection } from "@/components/coach/StrategySection";
import { StrategyBlock } from "@/components/coach/StrategyBlock";
import { WealthPanel } from "@/components/home/WealthPanel";
import { NextBestMove } from "@/components/home/NextBestMove";
import { WealthLadder } from "@/components/home/WealthLadder";
import { CoachChat } from "@/components/coach/CoachChat";
import { ActionList } from "@/components/coach/ActionList";
import { PlanItemCard } from "@/components/coach/PlanItemCard";
import { sandboxPlan } from "@/data/sandboxPlan";
import { computeWealthLadder } from "@/lib/wealthLadder";
import { computeEarnTrack } from "@/lib/earnTrack";
import { streamInvoke } from "@/lib/streamInvoke";
import type { StrategyActionRow, StrategyItemRow } from "@/lib/coachTypes";

const wrap = (ui: React.ReactElement) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter>{ui}</MemoryRouter>
  </QueryClientProvider>
);

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  h.demo = true;
  h.user = null;
  h.calls.length = 0;
  h.updates.length = 0;
  h.rpcs.length = 0;
  h.invokes = 0;
  h.getSession.mockClear();
  vi.mocked(toast.info).mockClear();
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

const noDbCalls = () => {
  expect(h.calls).toEqual([]);
  expect(h.rpcs).toEqual([]);
  expect(h.invokes).toBe(0);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(h.getSession).not.toHaveBeenCalled();
};

describe("demo mode makes zero database or network calls", () => {
  it("Coach page: chat and plan tab, including sending a message", async () => {
    render(wrap(<FinancialAdvisor />));
    expect(screen.getByText(/I'm AJE Coach/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message the coach"), { target: { value: "I have $1" } });
    fireEvent.click(screen.getByLabelText("Send"));
    await screen.findByText(/Here is a sample of how I would start/, undefined, { timeout: 3000 });
    fireEvent.mouseDown(screen.getByRole("tab", { name: "My plan" }), { button: 0 });
    await screen.findByTestId("action-list");
    noDbCalls();
  });

  it("Your strategy section, panel blocks and plan changes", async () => {
    render(wrap(<><StrategySection /><WealthPanel strategy={{ topItem: { title: "T", body: "" }, openActionCount: 2 }} /></>));
    await screen.findByText("Build a $500 starter fund");
    expect(screen.getByTestId("your-strategy")).toHaveTextContent("Weekend side work");
    expect(screen.getByTestId("your-strategy")).toHaveTextContent("illustrative, not a promise");
    noDbCalls();
  });

  it("plan edits are no-ops with a demo toast", async () => {
    render(wrap(<ActionList actions={sandboxPlan.actions} />));
    fireEvent.click(screen.getAllByRole("checkbox")[0]);
    await waitFor(() => expect(toast.info).toHaveBeenCalledWith("Demo mode: changes are not saved"));
    noDbCalls();
  });
});

describe("plan UI", () => {
  const act = (o: Partial<StrategyActionRow>): StrategyActionRow => ({ ...sandboxPlan.actions[0], ...o });

  it("actions are sorted by priority then created_at", () => {
    const list = [act({ id: "c", title: "Third", priority: 3 }), act({ id: "b2", title: "Second b", priority: 1, created_at: "2026-02-01T00:00:00Z" }), act({ id: "a", title: "First", priority: 1, created_at: "2026-01-01T00:00:00Z" })];
    render(wrap(<ActionList actions={list} />));
    const titles = screen.getAllByTestId("action-row").map((r) => r.querySelector("p")!.textContent);
    expect(titles).toEqual(["First", "Second b", "Third"]);
  });

  it("the done toggle writes status done through the typed wrapper (live mode)", async () => {
    h.demo = false;
    h.user = { id: "u1", email: "a@b.test" };
    render(wrap(<ActionList actions={[act({ id: "x1", title: "Do it", status: "todo" })]} />));
    fireEvent.click(screen.getByRole("checkbox"));
    await waitFor(() => expect(h.updates.find((u) => u.table === "strategy_actions")?.values).toMatchObject({ status: "done" }));
  });

  const item = (o: Partial<StrategyItemRow>): StrategyItemRow => ({ ...sandboxPlan.items[0], ...o });

  it("shows Edited badge and the proposal banner; accepting calls the RPC", async () => {
    h.demo = false;
    h.user = { id: "u1", email: "a@b.test" };
    const it1 = item({ id: "i1", edited_by_user: true, pending_ai_proposal: { title: "New AI title", body: "b" } });
    render(wrap(<PlanItemCard item={it1} />));
    expect(screen.getByText("Edited")).toBeInTheDocument();
    expect(screen.queryByText("AI draft")).toBeNull();
    const banner = screen.getByTestId("proposal-banner");
    expect(banner).toHaveTextContent("New AI title");
    fireEvent.click(within(banner).getByText("Accept"));
    await waitFor(() => expect(h.rpcs).toEqual([{ fn: "resolve_strategy_proposal", args: { p_kind: "item", p_id: "i1", p_accept: true } }]));
  });

  it("an unedited AI row shows the AI draft badge and no banner", () => {
    render(wrap(<PlanItemCard item={item({})} />));
    expect(screen.getByText("AI draft")).toBeInTheDocument();
    expect(screen.queryByTestId("proposal-banner")).toBeNull();
  });
});

describe("home pieces", () => {
  const ladder = computeWealthLadder({ onboarding: null, hasHousehold: false, cashBalance: 0, debts: [], debtsKnown: false, emergencyMonths: null, investedAmount: 0 });

  it("NextBestMove: without planMove keeps the ladder move; with it shows the plan action", () => {
    const { unmount } = render(wrap(<NextBestMove move={ladder.nextMove} showCoachLink />));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent(ladder.nextMove.title);
    expect(screen.getByRole("link", { name: "Ask the coach" })).toHaveAttribute("href", "/invs/strategy");
    unmount();
    render(wrap(<NextBestMove move={ladder.nextMove} planMove={{ title: "Open a savings account", why: "It is step one." }} showCoachLink />));
    expect(screen.getByRole("heading", { level: 2 })).toHaveTextContent("Open a savings account");
    expect(screen.getByRole("link", { name: /Open my plan/ })).toHaveAttribute("href", "/invs/strategy");
    expect(screen.queryByRole("link", { name: "Ask the coach" })).toBeNull();
  });

  it("WealthLadder: no earn prop renders no earn row; with it renders the track", () => {
    const a = render(wrap(<WealthLadder result={ladder} />));
    expect(screen.queryByTestId("earn-track")).toBeNull();
    expect(a.container.textContent).not.toContain("Earn more");
    a.unmount();
    const earn = computeEarnTrack({ incomeItems: [], earnActions: [], planActive: false });
    render(wrap(<WealthLadder result={ladder} earn={earn} />));
    expect(screen.getByTestId("earn-track")).toHaveAttribute("data-state", "no_plan");
    expect(screen.getByRole("link", { name: "Tell the coach about your income" })).toHaveAttribute("href", "/invs/strategy");
  });

  it("WealthLadder shows an in progress earn track", () => {
    const earn = computeEarnTrack({ incomeItems: [{ title: "i", body: "b" }], earnActions: [{ title: "A", status: "done" }, { title: "B", status: "todo" }], planActive: true });
    render(wrap(<WealthLadder result={ladder} earn={earn} />));
    expect(screen.getByTestId("earn-track")).toHaveTextContent("1 done, 1 to go");
  });

  it("strategy block empty state points to the coach; WealthPanel without the prop is unchanged", () => {
    const a = render(wrap(<StrategyBlock data={{ topItem: null, openActionCount: 0 }} />));
    expect(screen.getByRole("link", { name: "Start with the coach" })).toBeInTheDocument();
    a.unmount();
    render(wrap(<WealthPanel />));
    expect(screen.queryByTestId("strategy-block")).toBeNull();
  });
});

describe("streamInvoke onEvent", () => {
  const stream = (body: string, headers: Record<string, string> = {}) => new Response(body, { status: 200, headers });
  beforeEach(() => {
    process.env.VITE_SUPABASE_URL = "https://x.test";
  });

  it("forwards strategy_event and still delivers plain chunks", async () => {
    const chunk = `data: ${JSON.stringify({ choices: [{ delta: { content: "Hi" } }] })}\n\n`;
    const ev = `data: ${JSON.stringify({ strategy_event: { type: "applied", version: 2 } })}\n\n`;
    fetchSpy.mockResolvedValue(stream(chunk + ev + "data: [DONE]\n\n"));
    const cb = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onEvent: vi.fn() };
    await streamInvoke("ai-advisor", { mode: "coach" }, cb);
    expect(cb.onDelta).toHaveBeenCalledWith("Hi");
    expect(cb.onEvent).toHaveBeenCalledWith({ type: "applied", version: 2 });
    expect(cb.onDone).toHaveBeenCalledTimes(1);
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it("works for callers that pass no onEvent", async () => {
    fetchSpy.mockResolvedValue(stream(`data: ${JSON.stringify({ strategy_event: { type: "rejected" } })}\n\ndata: [DONE]\n\n`));
    const cb = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn() };
    await streamInvoke("ai-advisor", {}, cb);
    expect(cb.onDone).toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
  });

  it("a replayed JSON answer is a non-error event", async () => {
    fetchSpy.mockResolvedValue(stream(JSON.stringify({ replayed: true }), { "content-type": "application/json" }));
    const cb = { onDelta: vi.fn(), onDone: vi.fn(), onError: vi.fn(), onEvent: vi.fn() };
    await streamInvoke("ai-advisor", {}, cb);
    expect(cb.onEvent).toHaveBeenCalledWith({ type: "replayed" });
    expect(cb.onDone).toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
  });
});

describe("assistant markdown", () => {
  it("does not render remote images", async () => {
    vi.resetModules();
    const { default: ReactMarkdown } = await import("react-markdown");
    const src = (await import("node:fs")).readFileSync("src/components/coach/CoachChat.tsx", "utf8");
    expect(src).toContain('disallowedElements={["img"]}');
    const { container } = render(<ReactMarkdown disallowedElements={["img"]}>{"hi ![x](https://evil.test/p.png)"}</ReactMarkdown>);
    expect(container.querySelector("img")).toBeNull();
    expect(CoachChat).toBeTypeOf("function");
  });
});
