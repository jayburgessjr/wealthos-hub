// Pure money logic. No I/O, no Supabase. Inputs are plain numbers so it is easy to test.

export interface MoneyAccount {
  name: string;
  type: string;
  balance: number;
}
export interface MoneyDebt {
  name: string;
  balance: number;
  rate: number | null; // annual percent, e.g. 22.9
  monthlyPayment: number;
  linkedToBill?: boolean; // payment already counted in a bill
}
export interface MoneySubscription {
  name: string;
  amount: number;
  frequency: "monthly" | "annual";
}
export interface MoneyBill {
  name: string;
  amount: number;
  monthlyAmount?: number; // amount normalised to one month; falls back to amount
  dueDate: string; // ISO date
  paid: boolean;
}
export interface MoneySnapshot {
  accounts: MoneyAccount[];
  debts: MoneyDebt[];
  subscriptions: MoneySubscription[];
  bills: MoneyBill[];
  monthlyIncome: number;
  investCapital: number;
  today: string; // ISO date, injected so tests are deterministic
}

export interface NetWorth {
  cash: number;
  invested: number;
  debt: number;
  total: number;
}

export interface SubscriptionReport {
  monthlyTotal: number;
  annualTotal: number;
  duplicates: string[][];
  biggest: MoneySubscription[];
}

export interface DebtStep {
  name: string;
  balance: number;
  rate: number | null;
  monthsToPayoff: number | null; // null = never at this payment
  interestPerMonth: number;
}

export interface EmergencyFund {
  monthlyNeed: number;
  monthsCovered: number;
  target: number;
  shortfall: number;
}

export type MoveKind = "debt" | "emergency" | "subscription" | "bills" | "cashflow" | "data";
export interface Move {
  kind: MoveKind;
  title: string;
  detail: string;
  impact: number; // rough dollars per year, used for ranking only
}

const CREDIT_TYPES = new Set(["credit", "credit_card", "loan"]);
const HIGH_RATE = 12;
const FUND_MONTHS = 3;

const round = (n: number) => Math.round(n * 100) / 100;
const num = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function netWorth(s: MoneySnapshot): NetWorth {
  const cash = s.accounts.filter((a) => !CREDIT_TYPES.has(a.type)).reduce((t, a) => t + num(a.balance), 0);
  const debt = s.debts.reduce((t, d) => t + Math.max(0, num(d.balance)), 0);
  const invested = Math.max(0, num(s.investCapital));
  return { cash: round(cash), invested: round(invested), debt: round(debt), total: round(cash + invested - debt) };
}

export function subscriptionReport(subs: MoneySubscription[]): SubscriptionReport {
  const monthly = (x: MoneySubscription) => (x.frequency === "annual" ? num(x.amount) / 12 : num(x.amount));
  const monthlyTotal = subs.reduce((t, x) => t + monthly(x), 0);
  const groups = new Map<string, string[]>();
  for (const x of subs) {
    const key = norm(x.name);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), x.name]);
  }
  return {
    monthlyTotal: round(monthlyTotal),
    annualTotal: round(monthlyTotal * 12),
    duplicates: [...groups.values()].filter((g) => g.length > 1),
    biggest: [...subs].sort((a, b) => monthly(b) - monthly(a)).slice(0, 3),
  };
}

// Avalanche: highest rate first. Unknown rate sorts last.
export function debtOrder(debts: MoneyDebt[]): DebtStep[] {
  return debts
    .filter((d) => num(d.balance) > 0)
    .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1))
    .map((d) => {
      const monthlyRate = num(d.rate) / 100 / 12;
      const interestPerMonth = round(d.balance * monthlyRate);
      let months: number | null;
      if (d.monthlyPayment <= 0) months = null;
      else if (monthlyRate === 0) months = Math.ceil(d.balance / d.monthlyPayment);
      else if (d.monthlyPayment <= d.balance * monthlyRate) months = null;
      else {
        months = Math.ceil(-Math.log(1 - (d.balance * monthlyRate) / d.monthlyPayment) / Math.log(1 + monthlyRate));
      }
      return { name: d.name, balance: round(d.balance), rate: d.rate, monthsToPayoff: months, interestPerMonth };
    });
}

export function emergencyFund(s: MoneySnapshot): EmergencyFund {
  const bills = s.bills.reduce((t, b) => t + num(b.monthlyAmount ?? b.amount), 0);
  const debtPay = s.debts.filter((d) => !d.linkedToBill).reduce((t, d) => t + num(d.monthlyPayment), 0);
  const subs = subscriptionReport(s.subscriptions).monthlyTotal;
  const monthlyNeed = round(bills + debtPay + subs);
  const liquid = s.accounts
    .filter((a) => ["checking", "savings", "cash"].includes(a.type))
    .reduce((t, a) => t + Math.max(0, num(a.balance)), 0);
  const target = round(monthlyNeed * FUND_MONTHS);
  return {
    monthlyNeed,
    monthsCovered: monthlyNeed > 0 ? round(liquid / monthlyNeed) : 0,
    target,
    shortfall: round(Math.max(0, target - liquid)),
  };
}

const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000);

export function nextBestMoves(s: MoneySnapshot): Move[] {
  const empty = s.accounts.length === 0 && s.debts.length === 0 && s.bills.length === 0 && s.monthlyIncome <= 0;
  if (empty) {
    return [{ kind: "data", title: "Add your accounts, debts and income", detail: "Nothing to analyze yet. Household setup takes a few minutes.", impact: 0 }];
  }
  const moves: Move[] = [];

  const overdue = s.bills.filter((b) => !b.paid && daysBetween(b.dueDate, s.today) > 0);
  if (overdue.length > 0) {
    const total = overdue.reduce((t, b) => t + num(b.amount), 0);
    moves.push({ kind: "bills", title: `Pay ${overdue.length} overdue bill${overdue.length > 1 ? "s" : ""}`, detail: `${overdue.map((b) => b.name).join(", ")} ($${round(total)}). Late fees and credit damage cost more than the bill.`, impact: total });
  }

  const fund = emergencyFund(s);
  if (fund.monthlyNeed > 0 && fund.shortfall > 0) {
    moves.push({ kind: "emergency", title: "Build the emergency fund", detail: `You cover ${fund.monthsCovered} of ${FUND_MONTHS} months of bills. Short by $${fund.shortfall}.`, impact: fund.shortfall });
  }

  const hot = debtOrder(s.debts).filter((d) => (d.rate ?? 0) >= HIGH_RATE);
  if (hot.length > 0) {
    const top = hot[0];
    moves.push({ kind: "debt", title: `Attack ${top.name} first`, detail: `${top.rate}% costs about $${top.interestPerMonth} a month in interest. Highest rate first saves the most.`, impact: top.interestPerMonth * 12 });
  }

  const subs = subscriptionReport(s.subscriptions);
  if (subs.duplicates.length > 0) {
    moves.push({ kind: "subscription", title: "Cancel duplicate subscriptions", detail: `Possible duplicates: ${subs.duplicates.map((g) => g[0]).join(", ")}.`, impact: subs.annualTotal * 0.1 });
  } else if (subs.annualTotal > 0) {
    moves.push({ kind: "subscription", title: "Review subscriptions", detail: `They run $${subs.annualTotal} a year. The largest: ${subs.biggest.map((x) => x.name).join(", ")}.`, impact: subs.annualTotal * 0.1 });
  }

  const outflow = fund.monthlyNeed;
  if (s.monthlyIncome > 0 && outflow > s.monthlyIncome) {
    moves.push({ kind: "cashflow", title: "Spending is above income", detail: `Fixed costs are $${round(outflow)} against $${round(s.monthlyIncome)} income each month.`, impact: (outflow - s.monthlyIncome) * 12 });
  }

  return moves.sort((a, b) => b.impact - a.impact);
}
