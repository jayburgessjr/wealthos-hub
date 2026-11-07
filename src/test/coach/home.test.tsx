import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  demo: false,
  user: { id: "u1", email: "sam@example.test" } as null | { id: string; email: string },
  tables: [] as string[],
  rpcs: [] as string[],
}));

vi.mock("@/integrations/supabase/client", () => {
  const make = (t: string) => {
    state.tables.push(t);
    const chain: Record<string, unknown> = {};
    for (const k of ["select", "order", "limit", "eq", "maybeSingle"]) chain[k] = () => chain;
    chain.then = (r: (v: unknown) => unknown) => r({ data: [], error: null });
    return chain;
  };
  return { supabase: { from: make, rpc: (fn: string) => { state.rpcs.push(fn); return Promise.resolve({ data: null, error: null }); }, auth: { signOut: vi.fn() } } };
});
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => ({ user: state.user }) }));
vi.mock("@/components/DemoProvider", () => ({ useDemo: () => ({ isDemoMode: state.demo }) }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ isAdmin: false }) }));
vi.mock("@/lib/desk/hooks", () => ({ useIsOwner: () => ({ data: false }) }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/legal/LegalDisclosureGate", () => ({ default: () => null }));
vi.mock("@/context/HouseholdBudgetContext", () => ({
  useHouseholdBudget: () => ({
    householdId: null,
    totalSpent: 0,
    budget: { income: 0, expectedMonthlyIncome: 0, bankAccounts: [], bills: [], goals: [] },
  }),
}));

import HomeDashboard from "@/pages/HomeDashboard";

const COACH_TABLES = ["user_strategy", "strategy_items", "strategy_actions", "strategy_messages"];
const renderHome = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter initialEntries={["/home"]}>
        <HomeDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  state.demo = false;
  state.user = { id: "u1", email: "sam@example.test" };
  state.tables.length = 0;
  state.rpcs.length = 0;
});

describe("Home and the coach", () => {
  it("offers Ask the coach and the earn track prompt when there is no plan", async () => {
    renderHome();
    expect(screen.getAllByRole("link", { name: "Ask the coach" }).length).toBeGreaterThanOrEqual(1);
    for (const l of screen.getAllByRole("link", { name: "Ask the coach" })) expect(l).toHaveAttribute("href", "/invs/strategy");
    expect(screen.getByTestId("earn-track")).toHaveAttribute("data-state", "no_plan");
    expect(screen.getByTestId("next-best-move")).toBeInTheDocument();
    expect(screen.getByTestId("strategy-block")).toHaveTextContent("Start with the coach");
  });

  it("demo mode makes no coach table or RPC calls and shows the sample plan move", async () => {
    state.demo = true;
    state.user = null;
    renderHome();
    expect(await screen.findByText("List your debts with their rates")).toBeInTheDocument();
    expect(state.tables.filter((t) => COACH_TABLES.includes(t))).toEqual([]);
    expect(state.rpcs).toEqual([]);
    expect(screen.getByRole("link", { name: /Open my plan/ })).toBeInTheDocument();
  });
});
