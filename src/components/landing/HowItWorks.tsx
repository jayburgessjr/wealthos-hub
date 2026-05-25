import { motion } from "framer-motion";
import { Layers, Brain, Zap, TrendingUp } from "lucide-react";

const steps = [
  {
    step: "01",
    icon: Layers,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    glow: "shadow-primary/20",
    title: "Connect Your World",
    description:
      "Link your portfolio, set your household budget, and map your wealth — BWH builds a unified picture of your entire financial life in minutes.",
  },
  {
    step: "02",
    icon: Brain,
    color: "text-watch",
    bg: "bg-watch/10",
    border: "border-watch/20",
    glow: "shadow-watch/20",
    title: "Get AI Clarity",
    description:
      "AI signals surface trade opportunities, AI CFO reports analyze your household health, and wealth tools project your long-term trajectory — all contextual to your situation.",
  },
  {
    step: "03",
    icon: Zap,
    color: "text-neutral",
    bg: "bg-neutral/10",
    border: "border-neutral/20",
    glow: "shadow-neutral/20",
    title: "Execute With Discipline",
    description:
      "Act on ranked signals, pay bills on time, track debt payoff, and deploy capital — every action is guided, sized, and recorded.",
  },
  {
    step: "04",
    icon: TrendingUp,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    glow: "shadow-primary/20",
    title: "Compound & Review",
    description:
      "Weekly briefings, monthly closeouts, and performance analytics close the loop so each quarter builds on the last.",
  },
];

export default function HowItWorks() {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-card/30 to-background" />

      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            The Operating Loop
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            From Mission to Capital Growth —
            <br />
            <span className="text-primary">Four Steps.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            BWH is built around a repeatable growth loop. Every tool — invest,
            household, or wealth — feeds into one of these four phases.
          </p>
        </motion.div>

        {/* Desktop: horizontal connector line */}
        <div className="relative">
          <div className="hidden md:block absolute top-[52px] left-[12.5%] right-[12.5%] h-px bg-gradient-to-r from-transparent via-border to-transparent z-0" />

          <div className="grid grid-cols-1 gap-8 md:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                className="relative flex flex-col items-center text-center"
              >
                {/* Icon circle */}
                <div
                  className={`relative z-10 mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-2xl border ${step.border} ${step.bg} shadow-lg ${step.glow}`}
                >
                  <step.icon className={`h-7 w-7 ${step.color}`} />
                  <div
                    className={`absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full ${step.bg} border ${step.border} text-[10px] font-bold ${step.color}`}
                  >
                    {i + 1}
                  </div>
                </div>

                <div
                  className={`mb-1 text-xs font-mono font-bold uppercase tracking-widest ${step.color} opacity-60`}
                >
                  Step {step.step}
                </div>
                <h3 className="mb-3 font-display text-xl font-bold">
                  {step.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
