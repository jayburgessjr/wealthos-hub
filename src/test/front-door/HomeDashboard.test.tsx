import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";

const state = vi.hoisted(() => ({
  householdId: null as string | null,
  demo: false,
  auth: { user: { id: "u1", email: "sam@example.test" } as null | { id: string; email: string } },
}));

vi.mock("@/integrations/supabase/client", () => {
  const chain: Record<string, unknown> = {};
  for (const k of ["select", "order", "limit", "eq", "maybeSingle"]) chain[k] = () => chain;
  chain.then = (r: (v: unknown) => unknown) => r({ data: [], error: null });
  return { supabase: { from: () => chain, rpc: vi.fn(), auth: { signOut: vi.fn() } } };
});
vi.mock("@/components/AuthProvider", () => ({ useAuth: () => state.auth }));
vi.mock("@/components/DemoProvider", () => ({ useDemo: () => ({ isDemoMode: state.demo }) }));
vi.mock("@/hooks/useSubscription", () => ({ useSubscription: () => ({ isAdmin: false }) }));
vi.mock("@/lib/desk/hooks", () => ({ useIsOwner: () => ({ data: false }) }));
vi.mock("@/components/ThemeToggle", () => ({ ThemeToggle: () => null }));
vi.mock("@/components/legal/LegalDisclosureGate", () => ({ default: () => null }));
vi.mock("@/context/HouseholdBudgetContext", () => ({
  useHouseholdBudget: () => ({
    householdId: state.householdId,
    totalSpent: 0,
    budget: {
      income: 0,
      expectedMonthlyIncome: 0,
      bankAccounts: [],
      bills: [],
      goals: [],
    },
  }),
}));

import HomeDashboard from "@/pages/HomeDashboard";

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
  state.householdId = null;
  state.demo = false;
  state.auth = { user: { id: "u1", email: "sam@example.test" } };
});

describe("HomeDashboard with zero data", () => {
  it("renders the ladder, next move and checklist with no household", () => {
    renderHome();
    expect(screen.getByTestId("next-best-move")).toBeInTheDocument();
    expect(screen.getByText("Your wealth ladder")).toBeInTheDocument();
    expect(screen.getByText("Getting started")).toBeInTheDocument();
    expect(screen.getByTestId("ladder-stage")).toHaveTextContent("First dollar");
  });

  it("has no setup wall, no placeholder dashes and no broker tiles", () => {
    renderHome();
    expect(screen.queryByText(/Set Up Household →/)).toBeNull();
    expect(screen.queryByText("$—")).toBeNull();
    expect(screen.queryByText(/Connect broker/i)).toBeNull();
    expect(screen.queryByText("Portfolio")).toBeNull();
    expect(screen.getByText("Net Worth")).toBeInTheDocument();
    expect(screen.getByText("Cash minus debts")).toBeInTheDocument();
  });

  it("offers household setup as a normal card, not a blocker", () => {
    renderHome();
    expect(screen.getByRole("link", { name: "Set up my household" })).toHaveAttribute("href", "/household/setup");
  });

  it("shows only simple items and hides pro panels by default", () => {
    renderHome();
    expect(screen.queryByText("Markets and signals")).toBeNull();
    expect(screen.queryByText("Pro tools")).toBeNull();
  });

  it("shows pro panels in pro mode", () => {
    localStorage.setItem("bwh_nav_mode_v1", "pro");
    renderHome();
    expect(screen.getByText("Pro tools")).toBeInTheDocument();
  });

  it("uses sample numbers in demo mode", () => {
    state.demo = true;
    state.auth = { user: null };
    renderHome();
    expect(screen.getByTestId("net-worth-value")).toHaveTextContent("-$880");
    expect(screen.getByTestId("ladder-stage")).toHaveTextContent("Starter fund");
  });

  it("works with a household and no data inside it", () => {
    state.householdId = "h1";
    renderHome();
    expect(screen.getByText("Budget and bills")).toBeInTheDocument();
    expect(screen.getByTestId("ladder-stage")).toHaveTextContent("First dollar");
  });
});
