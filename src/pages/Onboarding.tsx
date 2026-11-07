import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCircle2, Sprout } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  ASSET_INTERESTS,
  EMPTY_DRAFT,
  EXPERIENCES,
  GOALS,
  ONBOARDING_DESTINATION,
  ONBOARDING_STEPS,
  RISKS,
  canAdvance,
  toAnswers,
  visibleSteps,
  type Draft,
  type StepId,
} from "@/lib/onboardingProfile";
import { finishOnboarding, skipOnboarding } from "@/lib/onboardingActions";
import { resetNavMode } from "@/lib/navMode";

// ── Keyboard-accessible option card ──────────────────────────────────────────

interface OptionCardProps {
  selected: boolean;
  onSelect: () => void;
  label: string;
  desc?: string;
  role?: "radio" | "checkbox";
}

function OptionCard({ selected, onSelect, label, desc, role = "radio" }: OptionCardProps) {
  return (
    <div
      role={role}
      aria-checked={selected}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`cursor-pointer rounded-xl border-2 p-4 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-display font-bold">{label}</span>
        {selected && <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />}
      </div>
      {desc && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{desc}</p>}
    </div>
  );
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="space-y-2 text-center">
      <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
      {sub && <p className="text-muted-foreground">{sub}</p>}
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-border bg-accent px-4 py-4 font-mono text-2xl font-bold transition-colors focus:border-primary focus:outline-none";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function Onboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);

  const steps = visibleSteps(draft);
  const step: StepId = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = step === "done";
  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  const toggleAsset = (a: string) =>
    patch({
      assetInterests: draft.assetInterests.includes(a)
        ? draft.assetInterests.filter((x) => x !== a)
        : [...draft.assetInterests, a],
    });

  const handleFinish = async () => {
    const answers = toAnswers(draft);
    if (!answers) return;
    if (!user) {
      navigate(ONBOARDING_DESTINATION);
      return;
    }
    setSaving(true);
    try {
      const to = await finishOnboarding(supabase, user.id, answers);
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      resetNavMode();
      toast.success("You are set up. Here is your home page.");
      navigate(to);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    if (user) {
      try {
        await skipOnboarding(supabase, user.id);
        queryClient.invalidateQueries({ queryKey: ["profile"] });
      } catch {
        // Skipping must never trap the person on this screen.
      }
    }
    navigate(ONBOARDING_DESTINATION);
  };

  const titleOf = (id: StepId) => ONBOARDING_STEPS.find((s) => s.id === id)?.title ?? "";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-2xl">
        <div className="mb-10 flex gap-1" aria-label={`Step ${stepIndex + 1} of ${steps.length}`}>
          {steps.map((id, i) => (
            <div key={id} className="flex flex-1 flex-col items-center gap-2">
              <div className={`h-1 w-full rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`} />
              <span
                className={`hidden text-xs font-semibold sm:block ${
                  i <= stepIndex ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {titleOf(id)}
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
            transition={{ duration: 0.2 }}
          >
            {step === "goal" && (
              <div className="space-y-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Sprout size={28} aria-hidden="true" />
                </div>
                <Heading
                  title="What would you like to work on first?"
                  sub="Pick the one that matters most right now. You can change it later."
                />
                <div role="radiogroup" aria-label="Your goal" className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {GOALS.map((g) => (
                    <OptionCard
                      key={g.id}
                      selected={draft.goal === g.id}
                      onSelect={() => patch({ goal: g.id })}
                      label={g.label}
                      desc={g.desc}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === "experience" && (
              <div className="space-y-6">
                <Heading title="How familiar is this to you?" sub="This sets how much we show you at first." />
                <div role="radiogroup" aria-label="Your experience" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {EXPERIENCES.map((e) => (
                    <OptionCard
                      key={e.id}
                      selected={draft.experience === e.id}
                      onSelect={() => patch({ experience: e.id })}
                      label={e.label}
                      desc={e.desc}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === "amounts" && (
              <div className="space-y-6">
                <Heading
                  title="What are you starting with?"
                  sub="Any amount is fine, including $1 or $0. This stays private."
                />
                <div className="mx-auto max-w-md space-y-5">
                  <div className="space-y-2">
                    <label htmlFor="ob-start" className="text-sm font-semibold text-muted-foreground">
                      Money you have to start with ($)
                    </label>
                    <input
                      id="ob-start"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="For example 25"
                      value={draft.startingAmount}
                      onChange={(e) => patch({ startingAmount: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="ob-monthly" className="text-sm font-semibold text-muted-foreground">
                      Amount you could add each month ($, optional)
                    </label>
                    <input
                      id="ob-monthly"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      placeholder="For example 20"
                      value={draft.monthlyAmount}
                      onChange={(e) => patch({ monthlyAmount: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>
            )}

            {step === "checks" && (
              <div className="space-y-6">
                <Heading title="Two quick checks" sub="These help us pick the right first step for you." />
                <div className="space-y-6">
                  <div className="space-y-2">
                    <p id="ob-q-fund" className="text-center font-semibold">
                      Do you have an emergency fund (savings for surprises)?
                    </p>
                    <div role="radiogroup" aria-labelledby="ob-q-fund" className="grid grid-cols-2 gap-3">
                      <OptionCard
                        selected={draft.emergencyFund === "yes"}
                        onSelect={() => patch({ emergencyFund: "yes" })}
                        label="Yes"
                      />
                      <OptionCard
                        selected={draft.emergencyFund === "no"}
                        onSelect={() => patch({ emergencyFund: "no" })}
                        label="Not yet"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p id="ob-q-debt" className="text-center font-semibold">
                      Do you have any high-interest debt, like credit cards?
                    </p>
                    <div role="radiogroup" aria-labelledby="ob-q-debt" className="grid grid-cols-2 gap-3">
                      <OptionCard
                        selected={draft.highInterestDebt === "yes"}
                        onSelect={() => patch({ highInterestDebt: "yes" })}
                        label="Yes"
                      />
                      <OptionCard
                        selected={draft.highInterestDebt === "no"}
                        onSelect={() => patch({ highInterestDebt: "no" })}
                        label="No"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {step === "risk" && (
              <div className="space-y-6">
                <Heading
                  title="How do you feel about ups and downs?"
                  sub="Money that can grow can also shrink for a while. There is no wrong answer."
                />
                <div role="radiogroup" aria-label="Comfort with risk" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {RISKS.map((r) => (
                    <OptionCard
                      key={r.id}
                      selected={draft.risk === r.id}
                      onSelect={() => patch({ risk: r.id })}
                      label={r.label}
                      desc={r.desc}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === "assets" && (
              <div className="space-y-6">
                <Heading title="What are you curious about?" sub="Pick any that apply. Optional." />
                <div role="group" aria-label="Interests" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {ASSET_INTERESTS.map((a) => (
                    <OptionCard
                      key={a}
                      role="checkbox"
                      selected={draft.assetInterests.includes(a)}
                      onSelect={() => toggleAsset(a)}
                      label={a}
                    />
                  ))}
                </div>
              </div>
            )}

            {step === "done" && (
              <div className="space-y-6 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <CheckCircle2 size={32} aria-hidden="true" />
                </div>
                <Heading
                  title="You are ready"
                  sub="We will place you on the wealth ladder and show your one next step. Nothing here is a promise of any return, and investing always carries risk."
                />
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => setStepIndex((s) => Math.max(0, s - 1))}
            disabled={stepIndex === 0}
            className="h-12 rounded-full px-8"
          >
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" /> Back
          </Button>

          {isLast ? (
            <Button onClick={handleFinish} disabled={saving} className="h-12 rounded-full px-10 text-base font-bold">
              {saving ? "Saving..." : "Go to my home page"}
            </Button>
          ) : (
            <Button
              onClick={() => setStepIndex((s) => s + 1)}
              disabled={!canAdvance(step, draft)}
              className="h-12 rounded-full px-10 text-base font-bold"
            >
              Continue <ArrowRight className="ml-2 h-4 w-4" aria-hidden="true" />
            </Button>
          )}
        </div>

        {!isLast && (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <button onClick={handleSkip} className="underline underline-offset-2 transition-colors hover:text-foreground">
              Skip for now
            </button>
          </p>
        )}
      </div>
    </div>
  );
}
