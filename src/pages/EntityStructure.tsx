import { useState } from "react";
import { motion } from "framer-motion";
import { Building, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function ResultRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${highlight ? "bg-primary/10" : "bg-muted/20"}`}>
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const ENTITY_COMPARISON = [
  {
    row: "Liability Protection",
    sp: "None",
    llc: "Strong",
    scorp: "Strong",
    ccorp: "Strong",
    trust: "Moderate",
  },
  {
    row: "Tax Treatment",
    sp: "Pass-through",
    llc: "Pass-through (flexible)",
    scorp: "Pass-through",
    ccorp: "Double taxation",
    trust: "Pass-through / separate",
  },
  {
    row: "Self-Employment Tax",
    sp: "Full 15.3%",
    llc: "Full 15.3%",
    scorp: "On salary only",
    ccorp: "N/A (W-2)",
    trust: "N/A",
  },
  {
    row: "Complexity",
    sp: "Minimal",
    llc: "Low–moderate",
    scorp: "Moderate",
    ccorp: "High",
    trust: "Moderate–high",
  },
  {
    row: "Best For",
    sp: "Side income, testing",
    llc: "Freelancers, rentals",
    scorp: "$40K+ net profit",
    ccorp: "VC-backed startups",
    trust: "Asset protection, estate",
  },
  {
    row: "Est. Annual Cost",
    sp: "$0",
    llc: "$50–$800",
    scorp: "$1K–$3K",
    ccorp: "$2K–$5K+",
    trust: "$1K–$3K setup",
  },
];

function SCorpCalculator() {
  const [profit, setProfit] = useState("150000");
  const [salary, setSalary] = useState("80000");
  const [seRate, setSeRate] = useState("15.3");
  const [incomeRate, setIncomeRate] = useState("24");

  const p = parseFloat(profit) || 0;
  const s = Math.min(parseFloat(salary) || 0, p);
  const se = parseFloat(seRate) / 100;
  const ir = parseFloat(incomeRate) / 100;

  const seTaxScorp = s * se * 0.9235;
  const incomeTaxScorp = (p - seTaxScorp / 2) * ir;
  const totalScorp = seTaxScorp + incomeTaxScorp;

  const seTaxSoleProp = p * se * 0.9235;
  const incomeTaxSoleProp = (p - seTaxSoleProp / 2) * ir;
  const totalSoleProp = seTaxSoleProp + incomeTaxSoleProp;

  const savings = totalSoleProp - totalScorp;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">S-Corp Salary vs Distribution Calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Annual Net Profit ($)">
            <input className={inputCls} type="number" value={profit} onChange={e => setProfit(e.target.value)} />
          </Field>
          <Field label="Reasonable Salary ($)">
            <input className={inputCls} type="number" value={salary} onChange={e => setSalary(e.target.value)} />
          </Field>
          <Field label="SE Tax Rate (%)">
            <input className={inputCls} type="number" step="0.1" value={seRate} onChange={e => setSeRate(e.target.value)} />
          </Field>
          <Field label="Income Tax Rate (%)">
            <input className={inputCls} type="number" value={incomeRate} onChange={e => setIncomeRate(e.target.value)} />
          </Field>
        </div>
        <div className="space-y-2">
          <ResultRow label="SE Tax on Salary Only (S-Corp)" value={fmt(seTaxScorp)} />
          <ResultRow label="Total Tax as S-Corp" value={fmt(totalScorp)} />
          <ResultRow label="Total Tax as Sole Proprietor" value={fmt(totalSoleProp)} />
          <ResultRow label="Annual Savings with S-Corp" value={savings > 0 ? fmt(savings) : "$0"} highlight />
        </div>
        {savings <= 0 && (
          <p className="text-xs text-muted-foreground">At this profit level, S-Corp election may not save money after accounting for additional compliance costs (~$1K–$3K/yr).</p>
        )}
      </CardContent>
    </Card>
  );
}

function BreakevenCalculator() {
  const [netProfit, setNetProfit] = useState("60000");
  const p = parseFloat(netProfit) || 0;
  const BREAKEVEN = 40000;
  const SCORP_COST = 2000;
  const seTaxSoleProp = p * 0.153 * 0.9235;
  const seTaxScorp = Math.min(p, 50000) * 0.153 * 0.9235;
  const grossSavings = seTaxSoleProp - seTaxScorp;
  const netSavings = grossSavings - SCORP_COST;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">LLC vs S-Corp Break-Even</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Field label="Annual Net Profit ($)">
          <input className={inputCls} type="number" value={netProfit} onChange={e => setNetProfit(e.target.value)} style={{ maxWidth: 200 }} />
        </Field>
        <div className="space-y-2">
          <ResultRow label="SE Tax Savings (gross)" value={grossSavings > 0 ? fmt(grossSavings) : "$0"} />
          <ResultRow label="Est. S-Corp Compliance Cost" value={fmt(SCORP_COST)} />
          <ResultRow label="Net Annual Savings" value={netSavings > 0 ? fmt(netSavings) : "$0"} highlight />
        </div>
        <div className={`rounded-lg border px-4 py-3 text-sm ${p >= BREAKEVEN ? "border-green-500/30 bg-green-500/5 text-green-400" : "border-amber-500/30 bg-amber-500/5 text-amber-400"}`}>
          {p >= BREAKEVEN
            ? `S-Corp election likely beneficial at ${fmt(p)} net profit.`
            : `S-Corp generally breaks even around ${fmt(BREAKEVEN)} net profit. Consider waiting.`}
        </div>
      </CardContent>
    </Card>
  );
}

function QBICalculator() {
  const [qbi, setQbi] = useState("120000");
  const [taxableIncome, setTaxableIncome] = useState("150000");
  const [filing, setFiling] = useState("single");

  const q = parseFloat(qbi) || 0;
  const ti = parseFloat(taxableIncome) || 0;
  const phaseoutStart = filing === "married" ? 383900 : 191950;
  const rawDeduction = q * 0.2;
  const limit = ti * 0.2;
  let deduction: number;

  if (ti <= phaseoutStart) {
    deduction = Math.min(rawDeduction, limit);
  } else {
    const ratio = Math.max(0, 1 - (ti - phaseoutStart) / 100000);
    deduction = Math.min(rawDeduction * ratio, limit);
  }
  deduction = Math.max(0, deduction);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">QBI Deduction Calculator (Section 199A)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Qualified Business Income ($)">
            <input className={inputCls} type="number" value={qbi} onChange={e => setQbi(e.target.value)} />
          </Field>
          <Field label="Taxable Income ($)">
            <input className={inputCls} type="number" value={taxableIncome} onChange={e => setTaxableIncome(e.target.value)} />
          </Field>
          <Field label="Filing Status">
            <select className={`${inputCls} appearance-none`} value={filing} onChange={e => setFiling(e.target.value)}>
              <option value="single">Single</option>
              <option value="married">Married Filing Jointly</option>
            </select>
          </Field>
        </div>
        <div className="space-y-2">
          <ResultRow label="20% of QBI (base deduction)" value={fmt(rawDeduction)} />
          <ResultRow label="20% of Taxable Income (limit)" value={fmt(limit)} />
          <ResultRow label="Phase-out threshold" value={fmt(phaseoutStart)} />
          <ResultRow label="Estimated QBI Deduction" value={fmt(deduction)} highlight />
        </div>
        <p className="text-xs text-muted-foreground">
          Simplified estimate. Specified Service Trade or Business (SSTB) limits, W-2 wage limits, and qualified property limits may further reduce this amount. Consult a tax advisor.
        </p>
      </CardContent>
    </Card>
  );
}

export default function EntityStructure() {
  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Entity Structure</h1>
            <p className="text-sm text-muted-foreground">LLC, S-Corp, trust, and tax strategy by entity type</p>
          </div>
        </div>

        {/* Entity comparison table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Entity Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    <th className="pb-2 text-left min-w-[140px]">Feature</th>
                    <th className="pb-2 text-center">Sole Prop</th>
                    <th className="pb-2 text-center">LLC</th>
                    <th className="pb-2 text-center">S-Corp</th>
                    <th className="pb-2 text-center">C-Corp</th>
                    <th className="pb-2 text-center">Trust</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {ENTITY_COMPARISON.map(row => (
                    <tr key={row.row}>
                      <td className="py-2.5 font-medium text-foreground">{row.row}</td>
                      <td className="py-2.5 text-center text-muted-foreground text-xs">{row.sp}</td>
                      <td className="py-2.5 text-center text-muted-foreground text-xs">{row.llc}</td>
                      <td className="py-2.5 text-center text-muted-foreground text-xs">{row.scorp}</td>
                      <td className="py-2.5 text-center text-muted-foreground text-xs">{row.ccorp}</td>
                      <td className="py-2.5 text-center text-muted-foreground text-xs">{row.trust}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Calculators */}
        <SCorpCalculator />
        <BreakevenCalculator />
        <QBICalculator />

        {/* Decision tree */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Entity Selection Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                {
                  q: "Are you at risk of lawsuits or significant liability?",
                  no: "Sole Prop may be sufficient for low-risk, low-income activities.",
                  yes: "You need an LLC or Corporation for liability protection.",
                },
                {
                  q: "Is your net profit consistently above $40K/year?",
                  no: "Standard single-member LLC (taxed as sole prop) is simpler and likely cheaper.",
                  yes: "Consider S-Corp election to reduce self-employment tax on distributions.",
                },
                {
                  q: "Are you seeking venture capital or planning an IPO?",
                  no: "S-Corp or LLC is typically better for pass-through simplicity.",
                  yes: "C-Corp (Delaware) is the standard for VC-backed companies.",
                },
                {
                  q: "Is asset protection and estate planning a primary goal?",
                  no: "Standard LLC or S-Corp is sufficient.",
                  yes: "Consider a holding company structure with trusts for multi-generational planning.",
                },
              ].map((item, i) => (
                <div key={i} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                    <ChevronRight size={14} className="text-primary shrink-0" />
                    {item.q}
                  </p>
                  <div className="ml-5 grid grid-cols-2 gap-2">
                    <div className="rounded-md border border-border px-2.5 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground mb-0.5">No</p>
                      <p className="text-xs text-muted-foreground">{item.no}</p>
                    </div>
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-2.5 py-1.5">
                      <p className="text-xs font-semibold text-primary mb-0.5">Yes</p>
                      <p className="text-xs text-muted-foreground">{item.yes}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Key considerations */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Considerations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { label: "Formation Costs", body: "LLC: $50–$500 state filing fee. S-Corp: Form 2553 is free but needs an LLC first. C-Corp: $100–$300, more in Delaware." },
                { label: "Registered Agent", body: "Required for LLC/Corp in most states. Cost: $50–$300/yr. Use a service (CT Corporation, Northwest) for privacy." },
                { label: "Annual Filing Fees", body: "California: $800 minimum franchise tax. Delaware: $300 franchise + $50 registered agent. Texas: No income tax but $300 franchise tax." },
                { label: "Payroll Requirements", body: "S-Corps require W-2 payroll for owner-employees. Budget $500–$2K/yr for payroll software or a bookkeeper." },
                { label: "State Nexus", body: "Operating in multiple states may require foreign qualification (~$100–$500/state) and additional franchise tax exposure." },
                { label: "Banking & Separation", body: "Always maintain a separate business bank account regardless of entity type. Commingling funds pierces the corporate veil." },
              ].map(c => (
                <div key={c.label} className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <p className="text-xs font-semibold text-foreground">{c.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.body}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
