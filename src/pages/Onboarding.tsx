import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { getCurrentTier } from "@/data/strategyTiers";
import {
  Rocket, ArrowRight, ArrowLeft, CheckCircle2,
  Target, Shield, TrendingUp, Landmark, Zap,
  Clock, DollarSign, BarChart3, Leaf,
  LineChart, Layers, Bitcoin, Home, Building2,
  Wheat, ArrowLeftRight, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// ── Step definitions ─────────────────────────────────────────────────────────

const STEPS = [
  { id: "persona",   title: "Who You Are" },
  { id: "goal",      title: "Primary Goal" },
  { id: "horizon",   title: "Time Horizon" },
  { id: "capital",   title: "Capital" },
  { id: "risk",      title: "Risk Profile" },
  { id: "assets",    title: "Asset Interests" },
  { id: "launch",    title: "Launch" },
];

const PERSONAS = [
  { id: "novice",        label: "New Investor",   desc: "Just getting started. Learning as I go." },
  { id: "active",        label: "Active Trader",  desc: "I follow markets daily and trade regularly." },
  { id: "wealth",        label: "Wealth Builder", desc: "Long-term compounder focused on fundamentals." },
  { id: "institutional", label: "Institutional",  desc: "Family office, fund, or high-net-worth operator." },
];

const GOALS = [
  { id: "growth",       label: "Grow Wealth",        desc: "Maximize capital appreciation over time.", icon: TrendingUp },
  { id: "income",       label: "Generate Income",     desc: "Build consistent cash flow from assets.", icon: DollarSign },
  { id: "preserve",     label: "Preserve Capital",    desc: "Protect purchasing power with low volatility.", icon: Shield },
  { id: "retirement",   label: "Retirement Planning", desc: "Optimize for a specific retirement date.", icon: Leaf },
];

const HORIZONS = [
  { id: "short",    label: "< 1 Year",   desc: "Tactical — quick opportunities & short-term plays." },
  { id: "medium",   label: "1 – 3 Years", desc: "Swing — medium-term trends and position trades." },
  { id: "long",     label: "3 – 10 Years", desc: "Growth — compounding over a business cycle." },
  { id: "legacy",   label: "10+ Years",  desc: "Legacy — generational wealth building." },
];

const RISK_TIERS = [
  { id: "conservative", label: "Conservative", desc: "Capital preservation first. Low volatility, steady yield.", color: "text-blue-400" },
  { id: "moderate",     label: "Moderate",     desc: "Balanced growth and downside protection.", color: "text-primary" },
  { id: "aggressive",   label: "Aggressive",   desc: "Maximum alpha. High conviction, high volatility.", color: "text-bearish" },
];

const ASSET_OPTIONS = [
  { id: "Equities",     label: "Equities",     Icon: LineChart },
  { id: "Options",      label: "Options",      Icon: Layers },
  { id: "Crypto",       label: "Crypto",       Icon: Bitcoin },
  { id: "Real Estate",  label: "Real Estate",  Icon: Home },
  { id: "Fixed Income", label: "Fixed Income", Icon: Building2 },
  { id: "Commodities",  label: "Commodities",  Icon: Wheat },
  { id: "Forex",        label: "Forex",        Icon: ArrowLeftRight },
  { id: "Alternatives", label: "Alternatives", Icon: Briefcase },
];

const SECTOR_WATCHLIST: Record<string, string[]> = {
  "Equities":     ["SPY", "QQQ", "AAPL", "MSFT"],
  "Options":      ["VIX", "SPY", "NVDA"],
  "Crypto":       ["BTC", "ETH", "COIN"],
  "Real Estate":  ["VNQ", "O", "AMT"],
  "Fixed Income": ["TLT", "AGG", "HYG"],
  "Commodities":  ["GLD", "SLV", "USO"],
  "Forex":        ["UUP", "FXE"],
  "Alternatives": ["BRK.B", "KKR", "BX"],
};

// ── Component ────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [persona, setPersona]           = useState("");
  const [goal, setGoal]                 = useState("");
  const [horizon, setHorizon]           = useState("");
  const [capital, setCapital]           = useState("10000");
  const [monthly, setMonthly]           = useState("500");
  const [risk, setRisk]                 = useState("moderate");
  const [assets, setAssets]             = useState<string[]>([]);

  const capNum = parseFloat(capital) || 0;
  const tier = getCurrentTier(capNum);

  const toggleAsset = (id: string) =>
    setAssets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const canAdvance = () => {
    if (step === 0) return !!persona;
    if (step === 1) return !!goal;
    if (step === 2) return !!horizon;
    if (step === 3) return capNum > 0;
    if (step === 5) return assets.length > 0;
    return true;
  };

  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({
          onboarding_completed: true,
          persona,
          primary_goal: goal,
          investment_horizon: horizon,
          risk_tier: risk,
          asset_preferences: assets,
        })
        .eq("id", user.id);
      if (profileErr) throw profileErr;

      const { error: portErr } = await supabase
        .from("portfolios")
        .upsert(
          { user_id: user.id, total_capital: capNum, available_capital: capNum, deployed_capital: 0, total_pnl: 0, win_rate: 0, total_trades: 0 },
          { onConflict: "user_id" }
        );
      if (portErr) throw portErr;

      const { error: compoundErr } = await supabase
        .from("compound_settings")
        .upsert(
          { user_id: user.id, starting_capital: capNum, monthly_contribution: parseFloat(monthly) || 0, risk_tier: risk, reinvestment_pct: 100 },
          { onConflict: "user_id" }
        );
      if (compoundErr) throw compoundErr;

      const tickers = Array.from(new Set(assets.flatMap(a => SECTOR_WATCHLIST[a] || [])));
      if (tickers.length > 0) {
        await supabase.from("watchlist").insert(
          tickers.map(t => ({ user_id: user.id, ticker: t, company_name: t }))
        );
      }

      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("AJE configured — welcome aboard.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Progress bar */}
        <div className="mb-12 flex gap-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex flex-1 flex-col items-center gap-2">
              <div className={`h-1 w-full rounded-full transition-all duration-500 ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <span className={`hidden text-[9px] font-bold uppercase tracking-wider sm:block ${i <= step ? "text-primary" : "text-muted-foreground/50"}`}>
                {s.title}
              </span>
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >

            {/* ── Step 0: Persona ─────────────────────────────────────── */}
            {step === 0 && (
              <div className="space-y-8 text-center">
                <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                  <Target size={40} />
                </div>
                <div>
                  <h1 className="font-display text-4xl font-black tracking-tight sm:text-5xl">Welcome to AJE.</h1>
                  <p className="mt-3 text-lg text-muted-foreground">Let's personalize your decision intelligence platform. This takes about 2 minutes.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PERSONAS.map(p => (
                    <Card
                      key={p.id}
                      onClick={() => setPersona(p.id)}
                      className={`cursor-pointer p-5 border-2 text-left transition-all hover:scale-[1.02] ${persona === p.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-display font-bold">{p.label}</span>
                        {persona === p.id && <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 1: Goal ────────────────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <BarChart3 size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-black tracking-tight">What's your primary goal?</h2>
                  <p className="text-muted-foreground">This shapes which signals, strategies, and tools we surface first.</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {GOALS.map(g => (
                    <Card
                      key={g.id}
                      onClick={() => setGoal(g.id)}
                      className={`cursor-pointer p-5 border-2 text-left transition-all hover:scale-[1.02] ${goal === g.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <g.icon size={16} className={goal === g.id ? "text-primary" : "text-muted-foreground"} />
                          <span className="font-display font-bold">{g.label}</span>
                        </div>
                        {goal === g.id && <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{g.desc}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 2: Horizon ─────────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Clock size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-black tracking-tight">Investment time horizon?</h2>
                  <p className="text-muted-foreground">How long are you planning to let your capital work?</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {HORIZONS.map(h => (
                    <Card
                      key={h.id}
                      onClick={() => setHorizon(h.id)}
                      className={`cursor-pointer p-5 border-2 text-left transition-all hover:scale-[1.02] ${horizon === h.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className="font-display text-lg font-black">{h.label}</span>
                        {horizon === h.id && <CheckCircle2 size={16} className="text-primary shrink-0 mt-1" />}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{h.desc}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 3: Capital ─────────────────────────────────────── */}
            {step === 3 && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Landmark size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-black tracking-tight">Capital & Contributions</h2>
                  <p className="text-muted-foreground">Seed the Compound Engine and strategy tier engine with your numbers.</p>
                </div>
                <div className="space-y-5 max-w-md mx-auto">
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Starting Capital ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={capital}
                      onChange={e => setCapital(e.target.value)}
                      className="w-full bg-accent border border-border rounded-xl px-4 py-4 font-mono text-2xl font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Monthly Contribution ($)</label>
                    <input
                      type="number"
                      min="0"
                      value={monthly}
                      onChange={e => setMonthly(e.target.value)}
                      className="w-full bg-accent border border-border rounded-xl px-4 py-4 font-mono text-2xl font-bold focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>
                  {capNum > 0 && (
                    <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: tier.color + "40", background: tier.color + "10" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Strategy Tier</span>
                        <span className="font-display font-black" style={{ color: tier.color }}>{tier.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{tier.strategies.map(s => s.name).join(" · ")}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Step 4: Risk ────────────────────────────────────────── */}
            {step === 4 && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Shield size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-black tracking-tight">Risk tolerance?</h2>
                  <p className="text-muted-foreground">How much drawdown can you stomach without changing your strategy?</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {RISK_TIERS.map(r => (
                    <Card
                      key={r.id}
                      onClick={() => setRisk(r.id)}
                      className={`cursor-pointer p-5 border-2 text-left transition-all hover:scale-[1.02] ${risk === r.id ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border"}`}
                    >
                      <div className="flex items-start justify-between">
                        <span className={`font-display font-bold ${risk === r.id ? "text-primary" : ""}`}>{r.label}</span>
                        {risk === r.id && <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 5: Assets ──────────────────────────────────────── */}
            {step === 5 && (
              <div className="space-y-8">
                <div className="text-center space-y-3">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Zap size={32} />
                  </div>
                  <h2 className="font-display text-3xl font-black tracking-tight">Which markets interest you?</h2>
                  <p className="text-muted-foreground">Select all that apply. We'll pre-load your watchlist and signals.</p>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {ASSET_OPTIONS.map(({ id, label, Icon }) => (
                    <div
                      key={id}
                      onClick={() => toggleAsset(id)}
                      className={`cursor-pointer flex flex-col items-center justify-center gap-2 rounded-2xl border-2 p-4 transition-all hover:scale-[1.02] ${assets.includes(id) ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-border"}`}
                    >
                      <Icon size={22} className={assets.includes(id) ? "text-primary" : "text-muted-foreground"} />
                      <span className="text-xs font-bold text-center">{label}</span>
                      {assets.includes(id) && <CheckCircle2 size={14} className="text-primary" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Step 6: Launch ──────────────────────────────────────── */}
            {step === 6 && (
              <div className="text-center space-y-8">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-2xl shadow-primary/40 animate-bounce">
                  <Rocket size={48} />
                </div>
                <div>
                  <h2 className="font-display text-4xl font-black tracking-tight">Ready for Liftoff.</h2>
                  <p className="mt-3 text-lg text-muted-foreground max-w-md mx-auto">
                    Your AJE is configured and ready to deploy.
                  </p>
                </div>
                <Card className="max-w-sm mx-auto p-6 bg-accent/50 border-primary/20 text-left space-y-3">
                  {[
                    { label: "Persona",   value: PERSONAS.find(p => p.id === persona)?.label || "—" },
                    { label: "Goal",      value: GOALS.find(g => g.id === goal)?.label || "—" },
                    { label: "Horizon",   value: HORIZONS.find(h => h.id === horizon)?.label || "—" },
                    { label: "Capital",   value: `$${Number(capital).toLocaleString()}` },
                    { label: "Monthly",   value: `$${Number(monthly).toLocaleString()}` },
                    { label: "Risk",      value: RISK_TIERS.find(r => r.id === risk)?.label || "—" },
                    { label: "Tier",      value: tier.label },
                    { label: "Markets",   value: assets.length > 0 ? assets.join(", ") : "None selected" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-bold text-right max-w-[55%]">{row.value}</span>
                    </div>
                  ))}
                </Card>
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-12 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => setStep(s => s - 1)}
            disabled={step === 0}
            className="rounded-full px-8 h-12"
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Button>

          {step === STEPS.length - 1 ? (
            <Button
              onClick={handleFinish}
              disabled={saving}
              className="rounded-full px-12 h-12 text-base font-bold shadow-xl shadow-primary/20"
            >
              {saving ? "Launching…" : <>Launch My Hub <Rocket className="ml-2 h-4 w-4" /></>}
            </Button>
          ) : (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              className="rounded-full px-12 h-12 text-base font-bold shadow-xl shadow-primary/20"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Skip escape hatch */}
        {step < STEPS.length - 1 && (
          <p className="mt-4 text-center text-xs text-muted-foreground/50">
            <button
              onClick={() => navigate("/dashboard")}
              className="hover:text-muted-foreground transition-colors underline underline-offset-2"
            >
              Skip for now
            </button>
          </p>
        )}

      </div>
    </div>
  );
}
