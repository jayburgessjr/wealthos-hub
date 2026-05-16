import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, Edit2, ChevronRight, TrendingUp, Clock,
  Zap, DollarSign, BarChart3, ArrowRight, CheckCircle2,
  AlertTriangle, Flame, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ─── Goal persistence (localStorage) ─────────────────────────────────────────

const STORAGE_KEY = "aje_goal_v1";

interface GoalState {
  startingCapital: number;
  targetCapital: number;
  timeframeYears: number;
  setAt: string;
}

function loadGoal(): GoalState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveGoal(g: GoalState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(g));
}

// ─── Math ─────────────────────────────────────────────────────────────────────

function calcGoalMetrics(goal: GoalState, currentCapital: number) {
  const { startingCapital, targetCapital, timeframeYears } = goal;
  const totalWeeks = timeframeYears * 52;

  // Required weekly return to hit target from start
  const requiredWeeklyReturn = Math.pow(targetCapital / startingCapital, 1 / totalWeeks) - 1;

  // Current progress: how far from start to target
  const progressPct = Math.min(
    100,
    Math.max(0, ((currentCapital - startingCapital) / (targetCapital - startingCapital)) * 100)
  );

  // Weeks elapsed since goal was set
  const weeksElapsed = Math.floor(
    (Date.now() - new Date(goal.setAt).getTime()) / (7 * 24 * 60 * 60 * 1000)
  );

  // What current capital implies as actual weekly return since goal was set
  const actualWeeklyReturn =
    weeksElapsed > 0
      ? Math.pow(currentCapital / startingCapital, 1 / weeksElapsed) - 1
      : 0;

  // Projected finish at actual pace
  const projectedWeeks =
    actualWeeklyReturn > 0
      ? Math.log(targetCapital / currentCapital) / Math.log(1 + actualWeeklyReturn)
      : null;

  const projectedYearsFromNow = projectedWeeks != null ? projectedWeeks / 52 : null;

  // How much capital needed per week to be on pace
  const targetCapitalNow = startingCapital * Math.pow(1 + requiredWeeklyReturn, weeksElapsed);
  const onTrack = currentCapital >= targetCapitalNow * 0.95;

  // Gap: how far above/below the target pace line
  const gapPct = ((currentCapital - targetCapitalNow) / targetCapitalNow) * 100;

  const multiplier = targetCapital / startingCapital;

  return {
    requiredWeeklyReturn,
    requiredMonthlyReturn: Math.pow(1 + requiredWeeklyReturn, 4) - 1,
    requiredAnnualReturn: Math.pow(1 + requiredWeeklyReturn, 52) - 1,
    progressPct,
    weeksElapsed,
    actualWeeklyReturn,
    projectedYearsFromNow,
    onTrack,
    gapPct,
    multiplier,
    totalWeeks,
  };
}

function fmt(n: number, decimals = 0) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(decimals)}`;
}

function fmtPct(n: number, decimals = 1) {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(decimals)}%`;
}

// ─── Goal-aligned Directives ──────────────────────────────────────────────────

interface GoalDirective {
  id: string;
  urgency: "critical" | "high" | "medium";
  label: string;
  command: string;
  reasoning: string;
  link: string;
  linkLabel: string;
}

function buildGoalDirectives(goal: GoalState, metrics: ReturnType<typeof calcGoalMetrics>, currentCapital: number): GoalDirective[] {
  const out: GoalDirective[] = [];
  const { requiredWeeklyReturn, onTrack, gapPct, projectedYearsFromNow, progressPct, multiplier } = metrics;

  // Off-pace warning
  if (!onTrack && metrics.weeksElapsed > 2) {
    out.push({
      id: "goal-pace",
      urgency: "critical",
      label: "BEHIND PACE",
      command: `You need ${fmtPct(requiredWeeklyReturn)}/week — you're currently running behind`,
      reasoning: `At your current pace you'd reach ${fmt(goal.targetCapital)} in ${
        projectedYearsFromNow != null ? projectedYearsFromNow.toFixed(1) : "?"
      } years, not ${goal.timeframeYears}. You're ${Math.abs(gapPct).toFixed(1)}% below the target pace line. Either increase return per trade, reduce drawdowns, or extend your timeframe.`,
      link: "/compound",
      linkLabel: "Model scenarios →",
    });
  }

  // On pace celebration
  if (onTrack && metrics.weeksElapsed > 2 && gapPct > 5) {
    out.push({
      id: "goal-ahead",
      urgency: "medium",
      label: "AHEAD OF PACE",
      command: `Running ${Math.abs(gapPct).toFixed(1)}% ahead of your ${fmtPct(requiredWeeklyReturn)}/week target`,
      reasoning: `You're compounding faster than your goal requires. Do not inflate risk to chase more — maintain your edge and let compounding do the work. Consider whether you want to update your target or timeline.`,
      link: "/compound",
      linkLabel: "Update target →",
    });
  }

  // Position sizing relative to goal
  const idealTradeSize = currentCapital * 0.02; // 2% risk per trade
  out.push({
    id: "goal-sizing",
    urgency: "medium",
    label: "SIZING",
    command: `Risk ${fmt(idealTradeSize)} max per trade to stay on plan`,
    reasoning: `At ${fmt(currentCapital)} portfolio value, 2% risk per trade = ${fmt(idealTradeSize)}. This is the position size that keeps a losing streak from derailing your ${goal.timeframeYears}-year plan. Use the Position Sizer to calculate exact share count.`,
    link: "/position-sizer",
    linkLabel: "Calculate size →",
  });

  // Compound frequency directive
  if (requiredWeeklyReturn > 0.02) {
    out.push({
      id: "goal-frequency",
      urgency: "high",
      label: "HIGH TARGET",
      command: `${fmtPct(requiredWeeklyReturn)}/week is ambitious — quality over quantity`,
      reasoning: `A ${fmtPct(requiredWeeklyReturn, 2)}/week target (${fmtPct(metrics.requiredAnnualReturn, 0)}/year) requires consistent execution. The fastest way to fail is overtrade chasing this number. Take only A+ setups from Signals, size correctly, and let compounding work.`,
      link: "/signals",
      linkLabel: "Find A+ setups →",
    });
  }

  // Progress milestone
  if (progressPct >= 25 && progressPct < 50) {
    out.push({
      id: "goal-milestone-25",
      urgency: "medium",
      label: "MILESTONE",
      command: `25% of the way to ${fmt(goal.targetCapital)} — protect what you've built`,
      reasoning: `You've made real progress. Now is the time to review your strategy allocations and make sure you're not concentrating risk. A major drawdown here sets you back months. Run the Strategy Allocator.`,
      link: "/strategy-allocator",
      linkLabel: "Review allocations →",
    });
  } else if (progressPct >= 50 && progressPct < 75) {
    out.push({
      id: "goal-milestone-50",
      urgency: "medium",
      label: "HALFWAY",
      command: `Halfway to ${fmt(goal.targetCapital)} — review your tax exposure`,
      reasoning: `At ${progressPct.toFixed(0)}% of your goal, unrealized gains are building. Run the Tax Harvesting analysis to see if there are positions you should be offsetting to reduce your eventual tax bill.`,
      link: "/tax-harvesting",
      linkLabel: "Tax analysis →",
    });
  } else if (progressPct >= 75) {
    out.push({
      id: "goal-milestone-75",
      urgency: "high",
      label: "FINAL STRETCH",
      command: `${progressPct.toFixed(0)}% to goal — reduce risk, protect the gain`,
      reasoning: `You are close. The biggest mistake at this stage is taking oversized risk to "finish faster." Reduce position sizes by 30%, shift toward lower-volatility setups. Arriving at ${fmt(goal.targetCapital)} is the objective — not how fast.`,
      link: "/compound",
      linkLabel: "View projection →",
    });
  }

  return out;
}

// ─── Setup Form ───────────────────────────────────────────────────────────────

function GoalSetupForm({ onSave, existing }: { onSave: (g: GoalState) => void; existing: GoalState | null }) {
  const [start, setStart] = useState(existing ? String(existing.startingCapital) : "");
  const [target, setTarget] = useState(existing ? String(existing.targetCapital) : "");
  const [years, setYears] = useState(existing ? String(existing.timeframeYears) : "");

  const preview = useMemo(() => {
    const s = parseFloat(start.replace(/,/g, ""));
    const t = parseFloat(target.replace(/,/g, ""));
    const y = parseFloat(years);
    if (!s || !t || !y || t <= s || y <= 0) return null;
    const weekly = Math.pow(t / s, 1 / (y * 52)) - 1;
    const annual = Math.pow(1 + weekly, 52) - 1;
    const mult = t / s;
    return { weekly, annual, mult };
  }, [start, target, years]);

  const handleSave = () => {
    const s = parseFloat(start.replace(/,/g, ""));
    const t = parseFloat(target.replace(/,/g, ""));
    const y = parseFloat(years);
    if (!s || !t || !y || t <= s || y <= 0) return;
    onSave({ startingCapital: s, targetCapital: t, timeframeYears: y, setAt: new Date().toISOString() });
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Starting Capital</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={start}
              onChange={(e) => setStart(e.target.value)}
              placeholder="4,000,000"
              className="pl-8 font-mono"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Target Capital</Label>
          <div className="relative">
            <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="10,000,000"
              className="pl-8 font-mono"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Timeframe (years)</Label>
          <div className="relative">
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={years}
              onChange={(e) => setYears(e.target.value)}
              placeholder="5"
              className="pl-8 font-mono"
            />
          </div>
        </div>
      </div>

      {/* Live preview */}
      <AnimatePresence>
        {preview && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-lg border border-bullish/20 bg-bullish/5 px-4 py-3"
          >
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Required / Week</p>
                <p className="font-mono text-lg font-bold text-bullish">{fmtPct(preview.weekly, 2)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Required / Year</p>
                <p className="font-mono text-lg font-bold text-foreground">{fmtPct(preview.annual, 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Multiplier</p>
                <p className="font-mono text-lg font-bold text-foreground">{preview.mult.toFixed(1)}×</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <Button
          onClick={handleSave}
          disabled={!preview}
          className="bg-bullish text-black hover:bg-bullish/90 text-xs font-bold uppercase tracking-wider"
        >
          <Flag className="h-3.5 w-3.5 mr-1.5" />
          Set My Mission
        </Button>
        <p className="text-xs text-muted-foreground">
          Your goal shapes every directive in the Decision Hub.
        </p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface GoalEngineProps {
  currentCapital: number;
}

export default function GoalEngine({ currentCapital }: GoalEngineProps) {
  const [goal, setGoal] = useState<GoalState | null>(loadGoal);
  const [editing, setEditing] = useState(false);

  const handleSave = (g: GoalState) => {
    saveGoal(g);
    setGoal(g);
    setEditing(false);
  };

  const handleClear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setGoal(null);
    setEditing(false);
  };

  // No goal set yet
  if (!goal || editing) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-dashed border-bullish/30 bg-bullish/3 p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-bullish/15">
              <Target className="h-4 w-4 text-bullish" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">
                {editing ? "Edit Your Mission" : "Set Your Wealth Mission"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {editing
                  ? "Update your goal and the Decision Hub will recalibrate."
                  : "Tell AJE where you want to go — every decision gets aligned to get you there."}
              </p>
            </div>
          </div>
          {editing && (
            <button
              onClick={() => setEditing(false)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
        <GoalSetupForm onSave={handleSave} existing={goal} />
      </motion.div>
    );
  }

  const cap = currentCapital > 0 ? currentCapital : goal.startingCapital;
  const metrics = calcGoalMetrics(goal, cap);
  const directives = buildGoalDirectives(goal, metrics, cap);

  const progressWidth = `${Math.min(100, metrics.progressPct)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Mission header bar */}
      <div className="px-5 pt-4 pb-3 border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-bullish/15">
              <Flag className="h-4 w-4 text-bullish" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs uppercase tracking-widest text-muted-foreground">Your Mission</span>
                {metrics.onTrack ? (
                  <span className="inline-flex items-center gap-1 text-xs text-bullish bg-bullish/10 border border-bullish/20 rounded px-1.5 py-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> ON PACE
                  </span>
                ) : metrics.weeksElapsed > 2 ? (
                  <span className="inline-flex items-center gap-1 text-xs text-bearish bg-bearish/10 border border-bearish/20 rounded px-1.5 py-0.5">
                    <AlertTriangle className="h-2.5 w-2.5" /> BEHIND PACE
                  </span>
                ) : null}
              </div>
              <p className="font-display text-base font-extrabold text-foreground truncate">
                {fmt(goal.startingCapital)} <span className="text-muted-foreground font-mono font-normal text-sm">→</span>{" "}
                <span className="text-bullish">{fmt(goal.targetCapital)}</span>
                <span className="text-muted-foreground font-mono font-normal text-sm ml-2">in {goal.timeframeYears}yr</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Edit2 className="h-3 w-3" /> Edit
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{fmt(goal.startingCapital)}</span>
            <span className="text-foreground font-semibold">{metrics.progressPct.toFixed(1)}% complete</span>
            <span>{fmt(goal.targetCapital)}</span>
          </div>
          <div className="h-1.5 rounded-full bg-accent overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: progressWidth }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className={`h-full rounded-full ${
                metrics.progressPct >= 75 ? "bg-bullish" :
                metrics.progressPct >= 25 ? "bg-primary" :
                "bg-muted-foreground/40"
              }`}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Current: <span className="text-foreground font-semibold">{fmt(cap)}</span>
            </span>
            <span className="text-muted-foreground">
              Remaining: <span className="text-foreground font-semibold">{fmt(goal.targetCapital - cap)}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Key metrics row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y sm:divide-y-0 divide-border/60">
        {[
          {
            label: "Required / Week",
            value: fmtPct(metrics.requiredWeeklyReturn, 2),
            sub: `${fmtPct(metrics.requiredAnnualReturn, 0)} / year`,
            icon: TrendingUp,
            accent: "text-bullish",
          },
          {
            label: "Multiplier",
            value: `${metrics.multiplier.toFixed(1)}×`,
            sub: `${fmt(goal.startingCapital)} → ${fmt(goal.targetCapital)}`,
            icon: Zap,
            accent: "text-primary",
          },
          {
            label: "At Current Pace",
            value: metrics.projectedYearsFromNow != null && metrics.weeksElapsed > 1
              ? `${metrics.projectedYearsFromNow.toFixed(1)} yrs`
              : "—",
            sub: metrics.projectedYearsFromNow != null && metrics.weeksElapsed > 1
              ? metrics.projectedYearsFromNow <= goal.timeframeYears ? "On schedule" : "Behind schedule"
              : "Tracking starts after week 1",
            icon: Clock,
            accent: metrics.projectedYearsFromNow != null && metrics.projectedYearsFromNow <= goal.timeframeYears
              ? "text-bullish"
              : "text-bearish",
          },
          {
            label: "Max Risk / Trade",
            value: fmt(cap * 0.02),
            sub: "2% of current capital",
            icon: BarChart3,
            accent: "text-foreground",
          },
        ].map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="px-4 py-3 space-y-1">
              <div className="flex items-center gap-1.5">
                <Icon className={`h-3 w-3 ${m.accent}`} />
                <span className="text-xs uppercase tracking-widest text-muted-foreground">{m.label}</span>
              </div>
              <p className={`font-mono text-base font-bold ${m.accent}`}>{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Goal-aligned directives */}
      {directives.length > 0 && (
        <div className="border-t border-border/60 px-5 py-3 space-y-2">
          <span className="text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <Flame className="h-3 w-3 text-watch" />
            Goal-aligned directives
          </span>
          <div className="space-y-2">
            {directives.map((d) => (
              <div
                key={d.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  d.urgency === "critical"
                    ? "border-bearish/25 bg-bearish/5"
                    : d.urgency === "high"
                    ? "border-border bg-card"
                    : "border-border/50 bg-card/50"
                }`}
              >
                <div className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${
                  d.urgency === "critical" ? "bg-bearish" :
                  d.urgency === "high" ? "bg-primary" : "bg-muted-foreground/40"
                }`} />
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-black uppercase tracking-wider ${
                      d.urgency === "critical" ? "text-bearish" : "text-primary"
                    }`}>{d.label}</span>
                    <span className="text-sm font-semibold text-foreground">{d.command}</span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">{d.reasoning}</p>
                  <Link
                    to={d.link}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    {d.linkLabel} <ArrowRight className="h-2.5 w-2.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
