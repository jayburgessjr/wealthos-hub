import { describe, expect, it } from "vitest";
import { debtOrder, emergencyFund, netWorth, nextBestMoves, subscriptionReport, type MoneySnapshot } from "@/lib/money/engine";

const base: MoneySnapshot = {
  accounts: [],
  debts: [],
  subscriptions: [],
  bills: [],
  monthlyIncome: 0,
  investCapital: 0,
  today: "2026-11-06",
};
const snap = (p: Partial<MoneySnapshot>): MoneySnapshot => ({ ...base, ...p });

describe("netWorth", () => {
  it("adds cash and invested, subtracts debt, ignores credit-type accounts as assets", () => {
    const n = netWorth(
      snap({
        accounts: [
          { name: "Chk", type: "checking", balance: 1000 },
          { name: "Card", type: "credit_card", balance: 500 },
        ],
        debts: [{ name: "Loan", balance: 300, rate: 5, monthlyPayment: 50 }],
        investCapital: 200,
      }),
    );
    expect(n).toEqual({ cash: 1000, invested: 200, debt: 300, total: 900 });
  });
  it("is zero with no data and survives bad numbers", () => {
    expect(netWorth(base).total).toBe(0);
    expect(netWorth(snap({ accounts: [{ name: "x", type: "checking", balance: NaN }] })).cash).toBe(0);
  });
});

describe("subscriptionReport", () => {
  it("annualizes annual plans and finds duplicates", () => {
    const r = subscriptionReport([
      { name: "Netflix", amount: 15, frequency: "monthly" },
      { name: "netflix ", amount: 15, frequency: "monthly" },
      { name: "Gym", amount: 120, frequency: "annual" },
    ]);
    expect(r.monthlyTotal).toBe(40);
    expect(r.annualTotal).toBe(480);
    expect(r.duplicates).toEqual([["Netflix", "netflix "]]);
  });
});

describe("debtOrder", () => {
  it("sorts highest rate first, unknown last", () => {
    const o = debtOrder([
      { name: "Car", balance: 5000, rate: 6, monthlyPayment: 200 },
      { name: "Card", balance: 1000, rate: 24, monthlyPayment: 100 },
      { name: "Friend", balance: 400, rate: null, monthlyPayment: 50 },
    ]);
    expect(o.map((d) => d.name)).toEqual(["Card", "Car", "Friend"]);
  });
  it("flags a payment that never beats interest", () => {
    const [d] = debtOrder([{ name: "Card", balance: 10000, rate: 24, monthlyPayment: 100 }]);
    expect(d.monthsToPayoff).toBeNull();
  });
  it("handles zero interest and drops paid-off debts", () => {
    const o = debtOrder([
      { name: "Zero", balance: 1000, rate: 0, monthlyPayment: 100 },
      { name: "Done", balance: 0, rate: 10, monthlyPayment: 50 },
    ]);
    expect(o).toHaveLength(1);
    expect(o[0].monthsToPayoff).toBe(10);
  });
});

describe("emergencyFund", () => {
  it("measures months covered against bills, debt payments and subscriptions", () => {
    const e = emergencyFund(
      snap({
        accounts: [{ name: "Sav", type: "savings", balance: 1500 }],
        bills: [{ name: "Rent", amount: 1000, dueDate: "2026-11-10", paid: false }],
        debts: [{ name: "Card", balance: 500, rate: 20, monthlyPayment: 100 }],
        subscriptions: [{ name: "TV", amount: 50, frequency: "monthly" }],
      }),
    );
    expect(e.monthlyNeed).toBe(1150);
    expect(e.target).toBe(3450);
    expect(e.shortfall).toBe(1950);
  });
  it("does not divide by zero", () => {
    expect(emergencyFund(base).monthsCovered).toBe(0);
  });
  it("uses monthlyAmount so a yearly bill is not counted as a full month", () => {
    const e = emergencyFund(snap({ bills: [{ name: "Insurance", amount: 1200, monthlyAmount: 100, dueDate: "2027-01-01", paid: false }] }));
    expect(e.monthlyNeed).toBe(100);
  });
  it("does not double count a debt payment already inside a bill", () => {
    const e = emergencyFund(
      snap({
        bills: [{ name: "Car loan", amount: 300, dueDate: "2026-11-20", paid: false }],
        debts: [{ name: "Car loan", balance: 9000, rate: 6, monthlyPayment: 300, linkedToBill: true }],
      }),
    );
    expect(e.monthlyNeed).toBe(300);
  });
});

describe("nextBestMoves", () => {
  it("asks for data when there is none", () => {
    const m = nextBestMoves(base);
    expect(m).toHaveLength(1);
    expect(m[0].kind).toBe("data");
  });
  it("ranks overdue bills, hot debt and fund shortfall by yearly impact", () => {
    const m = nextBestMoves(
      snap({
        monthlyIncome: 3000,
        accounts: [{ name: "Chk", type: "checking", balance: 200 }],
        bills: [{ name: "Power", amount: 90, dueDate: "2026-11-01", paid: false }],
        debts: [{ name: "Card", balance: 4000, rate: 25, monthlyPayment: 120 }],
      }),
    );
    const kinds = m.map((x) => x.kind);
    expect(kinds).toContain("bills");
    expect(kinds).toContain("debt");
    expect(kinds).toContain("emergency");
    for (let i = 1; i < m.length; i++) expect(m[i - 1].impact).toBeGreaterThanOrEqual(m[i].impact);
  });
  it("flags spending above income", () => {
    const m = nextBestMoves(snap({ monthlyIncome: 500, accounts: [{ name: "c", type: "checking", balance: 9999 }], bills: [{ name: "Rent", amount: 900, dueDate: "2026-12-01", paid: false }] }));
    expect(m.some((x) => x.kind === "cashflow")).toBe(true);
  });
  it("does not call a paid or future bill overdue", () => {
    const m = nextBestMoves(snap({ monthlyIncome: 5000, accounts: [{ name: "c", type: "checking", balance: 99999 }], bills: [{ name: "A", amount: 10, dueDate: "2026-11-01", paid: true }, { name: "B", amount: 10, dueDate: "2026-11-30", paid: false }] }));
    expect(m.some((x) => x.kind === "bills")).toBe(false);
  });
});
