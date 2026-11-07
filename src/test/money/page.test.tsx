import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state: { value: unknown } = { value: {} };
vi.mock("@/components/layout/DashboardLayout", () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/hooks/useMoneySnapshot", () => ({ useMoneySnapshot: () => state.value }));

import HouseholdMoney from "@/pages/household/HouseholdMoney";

const snapshot = (over = {}) => ({
  accounts: [{ name: "Chk", type: "checking", balance: 500 }],
  debts: [{ name: "Visa", balance: 3000, rate: 24, monthlyPayment: 90 }],
  subscriptions: [{ name: "TV", amount: 20, frequency: "monthly" }],
  bills: [],
  monthlyIncome: 3000,
  investCapital: 1000,
  today: "2026-11-06",
  ...over,
});

describe("Money coach page", () => {
  beforeEach(() => {
    state.value = { isLoading: false, error: null, refetch: vi.fn(), data: { hasHousehold: true, snapshot: snapshot() } };
  });

  it("shows net worth, a ranked move and the disclaimer", () => {
    render(<HouseholdMoney />);
    expect(screen.getByText(/Not financial advice/i)).toBeTruthy();
    // 500 cash + 1000 invested - 3000 debt = -1500; sign placement depends on locale
    expect(screen.getByText(/^-\$1,500$|^\$-1,500$/)).toBeTruthy();
    expect(screen.getByText(/Attack Visa first/)).toBeTruthy();
  });

  it("shows the empty-household notice without crashing", () => {
    state.value = { isLoading: false, error: null, refetch: vi.fn(), data: { hasHousehold: false, snapshot: snapshot({ accounts: [], debts: [], subscriptions: [], investCapital: 0, monthlyIncome: 0 }) } };
    render(<HouseholdMoney />);
    expect(screen.getByText(/No household is set up yet/)).toBeTruthy();
    expect(screen.getByText(/Add your accounts, debts and income/)).toBeTruthy();
  });

  it("shows an error with retry", () => {
    state.value = { isLoading: false, error: new Error("boom"), refetch: vi.fn(), data: undefined };
    render(<HouseholdMoney />);
    expect(screen.getByRole("alert").textContent).toMatch(/boom/);
  });
});
