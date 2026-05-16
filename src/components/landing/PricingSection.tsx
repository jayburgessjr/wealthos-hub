import { CheckCircle2, XCircle, Rocket, Zap, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Free",
    icon: Zap,
    price: "$0",
    per: "/month",
    description: "The fundamentals to track your portfolio, manage positions, and start building your edge — no AI.",
    features: [
      { text: "Dashboard & portfolio overview", included: true },
      { text: "Positions & watchlist tracking", included: true },
      { text: "Live charts & asset screener", included: true },
      { text: "Paper trading simulator", included: true },
      { text: "Position sizer & trading journal", included: true },
      { text: "Performance metrics & P&L calendar", included: true },
      { text: "Markets overview (equities, crypto, forex)", included: true },
      { text: "Decision Hub (manual, no AI brief)", included: true },
      { text: "AI Advisor, Trading AI & Wealth AI", included: false },
      { text: "Compound Engine, Quantum Engine & Strategy Allocator", included: false },
    ],
    cta: "Start for Free",
    href: "/signup",
    highlight: false,
    badge: null,
  },
  {
    name: "Pro",
    icon: Rocket,
    price: "$29",
    per: "/month",
    description: "Everything in Free, plus the full AI stack. Your portfolio now has a co-pilot.",
    features: [
      { text: "Everything in Free", included: true },
      { text: "AI Advisor — real-time trading chat", included: true },
      { text: "Wealth AI — financial planning intelligence", included: true },
      { text: "AI Session Brief in Decision Hub", included: true },
      { text: "Compound Engine & Strategy Allocator", included: true },
      { text: "Quantum Engine — Monte Carlo optimization", included: true },
      { text: "1-2-3 Strategy with AI confirmation", included: true },
      { text: "AI Signals across all asset classes", included: true },
      { text: "Alert Engine with AI-scored triggers", included: true },
      { text: "All advanced intelligence tools", included: false },
    ],
    cta: "Start Pro — $29/mo",
    href: "/signup",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Elite",
    icon: Crown,
    price: "$250",
    per: "/month",
    description: "The complete platform — every feature unlocked for serious capital allocators managing $250K+.",
    features: [
      { text: "Everything in Pro", included: true },
      { text: "Options Flow, Insider Activity & Congress trades", included: true },
      { text: "Prediction Markets — Kalshi, Polymarket, Sports, Lottery EV", included: true },
      { text: "Full Wealth Planning suite — net worth, retirement, estate", included: true },
      { text: "Business tools — entity structure & fundraising", included: true },
      { text: "Weekly Briefing, Playbook & document vault", included: true },
      { text: "Trading Bots & custom webhook alerts", included: true },
      { text: "Tax harvesting, dividends & real asset tracking", included: true },
      { text: "Priority AI response speed", included: true },
      { text: "White-glove onboarding & dedicated support", included: true },
    ],
    cta: "Get Elite Access",
    href: "/signup",
    highlight: false,
    badge: "Full Platform",
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-card/20 to-background" />

      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            Transparent Pricing
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Choose Your <span className="text-primary">Operating Level.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            Start free. Upgrade when you're ready for AI signals, prediction markets, and the full decision stack.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3 max-w-6xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative flex flex-col rounded-3xl border p-8 transition-all ${
                plan.highlight
                  ? "border-primary/60 bg-primary/5 shadow-2xl shadow-primary/10 ring-1 ring-primary/20 scale-[1.02]"
                  : "border-border/50 bg-card hover:border-border"
              }`}
            >
              {plan.badge && (
                <div className={`absolute -top-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1 text-[10px] font-bold uppercase tracking-wider ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border text-muted-foreground"
                }`}>
                  {plan.badge}
                </div>
              )}

              <div className="mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${plan.highlight ? "bg-primary/20 text-primary" : "bg-card border border-border text-muted-foreground"}`}>
                    <plan.icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-muted-foreground text-sm">{plan.per}</span>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="mb-8 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature.text} className="flex items-start gap-3">
                    {feature.included ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/30" />
                    )}
                    <span className={`text-sm ${feature.included ? "text-foreground/80" : "text-muted-foreground/40"}`}>
                      {feature.text}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                asChild
                variant={plan.highlight ? "default" : "outline"}
                className={`w-full rounded-xl py-6 text-base font-bold ${
                  plan.highlight ? "" : "border-border/50 hover:bg-accent/50"
                }`}
              >
                <Link to={plan.href} className="flex items-center justify-center gap-2">
                  {plan.highlight && <Rocket className="h-4 w-4" />}
                  {plan.cta}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center text-sm text-muted-foreground"
        >
          No credit card required for Free tier. Cancel Pro or Elite anytime. All plans include full data privacy.
        </motion.p>
      </div>
    </section>
  );
}
