import DashboardLayout from "@/components/layout/DashboardLayout";
import { useState, useMemo } from "react";
import { useAuth } from "@/components/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, ShieldCheck, Zap, TrendingUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Animation variants ────────────────────────────────────────────────────

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" as const },
  }),
};

const tabContentVariants = {
  hidden: { opacity: 0, x: 12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut" as const } },
  exit: { opacity: 0, x: -12, transition: { duration: 0.2, ease: "easeIn" as const } },
};

const resultVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.3, ease: "easeOut" as const },
  }),
};

// ─── Types ─────────────────────────────────────────────────────────────────

type TabId = "risk" | "kelly" | "fixed";

// ─── Helpers ───────────────────────────────────────────────────────────────

function fmt(v: number, decimals = 2): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtDollar(v: number): string {
  return "$" + fmt(v, 2);
}

function fmtShares(v: number): string {
  if (!isFinite(v) || isNaN(v)) return "—";
  return fmt(v, 2) + " sh";
}

function riskLevel(pct: number): { label: string; color: string; icon: React.ReactNode } {
  if (pct < 2) return { label: "Safe", color: "text-bullish", icon: <ShieldCheck className="h-4 w-4" /> };
  if (pct <= 4) return { label: "Moderate", color: "text-watch", icon: <Zap className="h-4 w-4" /> };
  return { label: "Aggressive", color: "text-bearish", icon: <AlertTriangle className="h-4 w-4" /> };
}

// ─── Sub-components ────────────────────────────────────────────────────────

function FormRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  prefix,
  suffix,
  placeholder,
  step,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
  step?: number;
  min?: number;
}) {
  return (
    <div className="relative flex items-center">
      {prefix && (
        <span className="absolute left-3 font-mono text-sm text-muted-foreground pointer-events-none">{prefix}</span>
      )}
      <input
        type="number"
        value={value}
        step={step ?? "any"}
        min={min ?? 0}
        placeholder={placeholder ?? "0"}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-lg border border-border bg-surface py-2.5 font-mono text-[14px] font-medium text-foreground outline-none transition-all focus:border-primary focus:shadow-[0_0_0_2px_hsl(217_91%_60%/0.12)] ${prefix ? "pl-8 pr-3" : suffix ? "pl-3 pr-8" : "px-3"}`}
      />
      {suffix && (
        <span className="absolute right-3 font-mono text-xs text-muted-foreground pointer-events-none">{suffix}</span>
      )}
    </div>
  );
}

function SliderInput({
  value,
  onChange,
  min,
  max,
  step,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  label: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">{label}</span>
        <span className="font-mono text-sm font-semibold text-primary">{value}%</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-[0_0_8px_hsl(217_91%_60%/0.25)]"
      />
      <div className="flex justify-between font-mono text-[9px] text-muted-foreground">
        <span>{min}%</span>
        <span>{max}%</span>
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  accent,
  i,
  large,
}: {
  label: string;
  value: string;
  accent?: "green" | "red" | "blue" | "yellow" | "muted";
  i: number;
  large?: boolean;
}) {
  const colorMap: Record<string, string> = {
    green: "text-bullish",
    red: "text-bearish",
    blue: "text-primary",
    yellow: "text-watch",
    muted: "text-muted-foreground",
  };
  const color = colorMap[accent ?? "blue"] ?? "text-foreground";
  return (
    <motion.div
      variants={resultVariants}
      initial="hidden"
      animate="visible"
      custom={i}
      key={value}
      className="flex items-center justify-between border-b border-border/40 py-3 last:border-b-0"
    >
      <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
      <span className={`font-mono ${large ? "text-xl font-extrabold" : "text-sm font-semibold"} ${color}`}>
        {value}
      </span>
    </motion.div>
  );
}

function OversizedBanner() {
  return (
    <motion.div
      initial={{ opacity: 0, scaleY: 0.8 }}
      animate={{ opacity: 1, scaleY: 1 }}
      exit={{ opacity: 0, scaleY: 0.8 }}
      transition={{ duration: 0.25 }}
      className="flex items-center gap-3 rounded-lg border border-bearish/40 bg-bearish/10 px-4 py-3"
    >
      <AlertTriangle className="h-4 w-4 flex-shrink-0 text-bearish" />
      <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-bearish">
        OVERSIZED — This position exceeds 10% of your account
      </span>
    </motion.div>
  );
}

function RiskBadge({ pctOfAccount }: { pctOfAccount: number }) {
  const { label, color, icon } = riskLevel(pctOfAccount);
  return (
    <div className={`flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-1.5 ${color}`}>
      {icon}
      <span className="font-mono text-[11px] font-semibold">{label}</span>
    </div>
  );
}

// ─── Mode 1: Risk-Based Sizing ─────────────────────────────────────────────

function RiskBasedMode({ accountSize }: { accountSize: string }) {
  const [acct, setAcct] = useState(accountSize);
  const [riskPct, setRiskPct] = useState(2);
  const [entry, setEntry] = useState("");
  const [stop, setStop] = useState("");
  const [target, setTarget] = useState("");

  // Sync accountSize prop → local if user hasn't typed
  const [acctTouched, setAcctTouched] = useState(false);
  const resolvedAcct = acctTouched ? acct : (accountSize || acct);

  const results = useMemo(() => {
    const a = parseFloat(resolvedAcct) || 0;
    const e = parseFloat(entry) || 0;
    const s = parseFloat(stop) || 0;
    const t = parseFloat(target) || 0;

    const riskAmount = a * (riskPct / 100);
    const spread = e - s;
    const shares = spread > 0 ? riskAmount / spread : 0;
    const posValue = shares * e;
    const pctOfAcct = a > 0 ? (posValue / a) * 100 : 0;
    const rr = t > 0 && spread > 0 ? (t - e) / spread : null;

    return { riskAmount, shares, posValue, pctOfAcct, rr };
  }, [resolvedAcct, riskPct, entry, stop, target]);

  const isOversized = results.pctOfAcct > 10 && results.posValue > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
      {/* Inputs */}
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <FormRow label="Account Size">
          <NumberInput
            value={resolvedAcct}
            onChange={(v) => { setAcctTouched(true); setAcct(v); }}
            prefix="$"
            placeholder="e.g. 25000"
          />
        </FormRow>
        <SliderInput
          label="Risk Per Trade"
          value={riskPct}
          onChange={setRiskPct}
          min={0.5}
          max={5}
          step={0.5}
        />
        <FormRow label="Entry Price">
          <NumberInput value={entry} onChange={setEntry} prefix="$" placeholder="e.g. 150.00" step={0.01} />
        </FormRow>
        <FormRow label="Stop Loss Price">
          <NumberInput value={stop} onChange={setStop} prefix="$" placeholder="e.g. 145.00" step={0.01} />
        </FormRow>
        <FormRow label="Target Price (optional — for R/R)">
          <NumberInput value={target} onChange={setTarget} prefix="$" placeholder="e.g. 165.00" step={0.01} />
        </FormRow>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">Live Results</span>
          {results.posValue > 0 && <RiskBadge pctOfAccount={results.pctOfAcct} />}
        </div>

        <AnimatePresence>{isOversized && <OversizedBanner />}</AnimatePresence>

        <div className="rounded-xl border border-border bg-surface/60 px-4">
          <ResultRow label="Risk Amount" value={fmtDollar(results.riskAmount)} accent="red" i={0} large />
          <ResultRow label="Position Size" value={fmtShares(results.shares)} accent="blue" i={1} large />
          <ResultRow label="Total Position Value" value={fmtDollar(results.posValue)} accent="green" i={2} />
          <ResultRow
            label="% of Account"
            value={isFinite(results.pctOfAcct) ? `${fmt(results.pctOfAcct, 1)}%` : "—"}
            accent={results.pctOfAcct > 10 ? "red" : results.pctOfAcct > 5 ? "yellow" : "green"}
            i={3}
          />
          {results.rr !== null && (
            <ResultRow
              label="Risk / Reward"
              value={`1 : ${fmt(results.rr, 2)}`}
              accent={results.rr >= 2 ? "green" : results.rr >= 1 ? "yellow" : "red"}
              i={4}
            />
          )}
        </div>

        <div className="mt-auto rounded-lg border border-border bg-card px-4 py-3">
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            <span className="text-foreground font-semibold">Formula: </span>
            Risk Amount = Account × Risk% &nbsp;|&nbsp; Shares = Risk Amount ÷ (Entry − Stop)
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Mode 2: Kelly Criterion ───────────────────────────────────────────────

function KellyMode({ accountSize }: { accountSize: string }) {
  const [winRate, setWinRate] = useState(55);
  const [avgWin, setAvgWin] = useState("");
  const [avgLoss, setAvgLoss] = useState("");
  const [acct, setAcct] = useState(accountSize);
  const [acctTouched, setAcctTouched] = useState(false);
  const resolvedAcct = acctTouched ? acct : (accountSize || acct);

  const results = useMemo(() => {
    const W = winRate / 100;
    const win = parseFloat(avgWin) || 0;
    const loss = parseFloat(avgLoss) || 0;
    const a = parseFloat(resolvedAcct) || 0;

    if (win === 0 || loss === 0) {
      return { kelly: 0, halfKelly: 0, fullDollar: 0, halfDollar: 0, winLossRatio: 0 };
    }

    const R = win / loss; // win/loss ratio
    // Kelly formula: W - (1 - W) / R
    const kelly = Math.max(0, W - (1 - W) / R) * 100;
    const halfKelly = kelly / 2;

    return {
      kelly,
      halfKelly,
      fullDollar: a * (kelly / 100),
      halfDollar: a * (halfKelly / 100),
      winLossRatio: R,
    };
  }, [winRate, avgWin, avgLoss, resolvedAcct]);

  const isOversized = results.halfDollar > 0 && parseFloat(resolvedAcct) > 0
    ? (results.halfDollar / parseFloat(resolvedAcct)) * 100 > 10
    : false;

  const pctOfAcct = parseFloat(resolvedAcct) > 0 ? (results.halfDollar / parseFloat(resolvedAcct)) * 100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
      {/* Inputs */}
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <FormRow label="Account Size">
          <NumberInput
            value={resolvedAcct}
            onChange={(v) => { setAcctTouched(true); setAcct(v); }}
            prefix="$"
            placeholder="e.g. 25000"
          />
        </FormRow>
        <SliderInput
          label="Win Rate"
          value={winRate}
          onChange={setWinRate}
          min={1}
          max={99}
          step={1}
        />
        <FormRow label="Average Win ($)">
          <NumberInput value={avgWin} onChange={setAvgWin} prefix="$" placeholder="e.g. 500" step={1} />
        </FormRow>
        <FormRow label="Average Loss ($)">
          <NumberInput value={avgLoss} onChange={setAvgLoss} prefix="$" placeholder="e.g. 250" step={1} />
        </FormRow>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">Live Results</span>
          {results.halfDollar > 0 && <RiskBadge pctOfAccount={pctOfAcct} />}
        </div>

        <AnimatePresence>{isOversized && <OversizedBanner />}</AnimatePresence>

        <div className="rounded-xl border border-border bg-surface/60 px-4">
          <ResultRow label="Win / Loss Ratio" value={isFinite(results.winLossRatio) ? `${fmt(results.winLossRatio, 2)}x` : "—"} accent="blue" i={0} />
          <ResultRow label="Full Kelly %" value={`${fmt(results.kelly, 2)}%`} accent="yellow" i={1} />
          <ResultRow label="Half Kelly % (recommended)" value={`${fmt(results.halfKelly, 2)}%`} accent="green" i={2} large />
          <ResultRow label="Full Kelly Position" value={fmtDollar(results.fullDollar)} accent="yellow" i={3} />
          <ResultRow label="Half Kelly Position" value={fmtDollar(results.halfDollar)} accent="green" i={4} large />
        </div>

        <div className="mt-auto rounded-lg border border-border bg-card px-4 py-3">
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            <span className="text-foreground font-semibold">Formula: </span>
            K% = W − (1−W) / (W/L) &nbsp;|&nbsp; Half Kelly is the practitioner standard for risk-adjusted sizing.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Mode 3: Fixed Fractional ──────────────────────────────────────────────

const FRACTIONS = [1, 2, 3, 5, 10];

function FixedFractionalMode({ accountSize }: { accountSize: string }) {
  const [acct, setAcct] = useState(accountSize);
  const [acctTouched, setAcctTouched] = useState(false);
  const [fraction, setFraction] = useState(2);
  const [entry, setEntry] = useState("");
  const resolvedAcct = acctTouched ? acct : (accountSize || acct);

  const results = useMemo(() => {
    const a = parseFloat(resolvedAcct) || 0;
    const e = parseFloat(entry) || 0;
    const dollar = a * (fraction / 100);
    const shares = e > 0 ? dollar / e : 0;
    const pctOfAcct = fraction;
    return { dollar, shares, pctOfAcct };
  }, [resolvedAcct, fraction, entry]);

  const isOversized = results.pctOfAcct > 10;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-border">
      {/* Inputs */}
      <div className="flex flex-col gap-5 p-5 sm:p-6">
        <FormRow label="Account Size">
          <NumberInput
            value={resolvedAcct}
            onChange={(v) => { setAcctTouched(true); setAcct(v); }}
            prefix="$"
            placeholder="e.g. 25000"
          />
        </FormRow>

        <div className="flex flex-col gap-2">
          <label className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">Fraction of Account</label>
          <div className="flex gap-2 flex-wrap">
            {FRACTIONS.map((f) => (
              <button
                key={f}
                onClick={() => setFraction(f)}
                className={`rounded-lg border px-4 py-2 font-mono text-[12px] font-semibold transition-all ${
                  fraction === f
                    ? "border-primary bg-primary/10 text-primary shadow-[0_0_12px_hsl(217_91%_60%/0.2)]"
                    : "border-border text-muted-foreground hover:border-border/80 hover:text-foreground"
                }`}
              >
                {f}%
              </button>
            ))}
          </div>
        </div>

        <FormRow label="Entry Price">
          <NumberInput value={entry} onChange={setEntry} prefix="$" placeholder="e.g. 150.00" step={0.01} />
        </FormRow>
      </div>

      {/* Results */}
      <div className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[1px] text-muted-foreground">Live Results</span>
          {results.dollar > 0 && <RiskBadge pctOfAccount={results.pctOfAcct} />}
        </div>

        <AnimatePresence>{isOversized && <OversizedBanner />}</AnimatePresence>

        <div className="rounded-xl border border-border bg-surface/60 px-4">
          <ResultRow label="Fraction Selected" value={`${fraction}%`} accent="blue" i={0} />
          <ResultRow label="Dollar Amount to Deploy" value={fmtDollar(results.dollar)} accent="green" i={1} large />
          <ResultRow label="Number of Shares" value={fmtShares(results.shares)} accent="blue" i={2} large />
          <ResultRow
            label="% of Account"
            value={`${fraction}%`}
            accent={fraction > 10 ? "red" : fraction > 5 ? "yellow" : "green"}
            i={3}
          />
        </div>

        <div className="mt-auto rounded-lg border border-border bg-card px-4 py-3">
          <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
            <span className="text-foreground font-semibold">Formula: </span>
            Deploy $ = Account × Fraction% &nbsp;|&nbsp; Shares = Deploy $ ÷ Entry Price
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string }[] = [
  { id: "risk", label: "Risk-Based Sizing" },
  { id: "kelly", label: "Kelly Criterion" },
  { id: "fixed", label: "Fixed Fractional" },
];

export default function PositionSizer() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>("risk");

  // Pre-fill account size from portfolio if logged in
  const { data: portfolio } = useQuery({
    queryKey: ["portfolio_capital_sizer", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("portfolios")
        .select("available_capital, total_capital")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const prefillAccount = portfolio
    ? String(portfolio.available_capital ?? portfolio.total_capital ?? "")
    : "";

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-[1200px] space-y-5">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <h1 className="font-display text-xl sm:text-[28px] font-extrabold leading-none tracking-tight">
              Position <span className="text-primary">Sizer</span>
            </h1>
            <p className="mt-1.5 font-mono text-[11px] sm:text-[13px] text-muted-foreground hidden sm:block">
              // Size every trade with precision. Risk-defined, math-driven, capital-preserved.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
            <TrendingUp className="h-3.5 w-3.5 text-primary" />
            <span className="font-mono text-[11px] text-muted-foreground">
              {user ? (prefillAccount ? `Account: $${Number(prefillAccount).toLocaleString()}` : "Portfolio loaded") : "Guest mode — enter account size manually"}
            </span>
          </div>
        </motion.div>

        {/* Main Card */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={0}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          {/* Tab Bar */}
          <div className="flex border-b border-border overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex-shrink-0 px-5 sm:px-7 py-4 font-mono text-[11px] sm:text-[12px] font-semibold uppercase tracking-[1px] transition-colors ${
                  activeTab === tab.id
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="tab-underline"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              variants={tabContentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
            >
              {activeTab === "risk" && <RiskBasedMode accountSize={prefillAccount} />}
              {activeTab === "kelly" && <KellyMode accountSize={prefillAccount} />}
              {activeTab === "fixed" && <FixedFractionalMode accountSize={prefillAccount} />}
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Reference Card */}
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          custom={1}
          className="rounded-xl border border-border bg-card overflow-hidden"
        >
          <div className="border-b border-border px-5 py-3.5">
            <span className="font-display text-[11px] font-bold uppercase tracking-[1.2px] text-muted-foreground">
              Sizing Quick Reference
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border">
            {[
              {
                label: "Safe Zone",
                pct: "< 2% risk per trade",
                desc: "Professional standard for capital preservation. Withstand 50 consecutive losses before 50% drawdown.",
                color: "text-bullish",
                bar: "bg-bullish",
                width: "w-1/4",
              },
              {
                label: "Moderate Zone",
                pct: "2% – 4% risk per trade",
                desc: "Active trader range. Higher return potential with elevated drawdown risk. Requires consistent edge.",
                color: "text-watch",
                bar: "bg-watch",
                width: "w-1/2",
              },
              {
                label: "Aggressive Zone",
                pct: "> 4% risk per trade",
                desc: "Speculative sizing. A 10-trade losing streak can cause 30%+ drawdown. Use only with proven strategy.",
                color: "text-bearish",
                bar: "bg-bearish",
                width: "w-3/4",
              },
            ].map((item) => (
              <div key={item.label} className="flex flex-col gap-2.5 p-5">
                <div className={`font-mono text-[10px] font-bold uppercase tracking-[1px] ${item.color}`}>
                  {item.label}
                </div>
                <div className={`font-display text-[13px] font-extrabold ${item.color}`}>{item.pct}</div>
                <div className={`h-1 rounded-full bg-border overflow-hidden`}>
                  <div className={`h-full rounded-full ${item.bar} ${item.width}`} />
                </div>
                <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
