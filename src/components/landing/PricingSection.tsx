import { CheckCircle2, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";

const plans = [
  {
    name: "Free",
    price: "$0",
    description: "Core decision support for tracking, signals, and portfolio visibility.",
    features: [
      "Portfolio Tracking",
      "Live Price Charts",
      "Basic Watchlist",
      "Standard Performance Metrics",
    ],
    cta: "Start for Free",
    href: "/login",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$29",
    description: "Full decision-intelligence stack with AI guidance, allocation tooling, and regime analysis.",
    features: [
      "Everything in Free",
      "WealthOS AI Advisor",
      "Strategy Allocator Engine",
      "Advanced Market Regime Analysis",
      "Institutional-grade Signals",
      "Priority Support",
    ],
    cta: "Upgrade to Pro",
    href: "/login",
    highlight: true,
  },
];

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 md:py-32">
      <div className="container px-4">
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Simple, Transparent <span className="text-primary">Pricing</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Choose the level of decision support that fits how you manage capital.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 max-w-5xl mx-auto">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`relative rounded-3xl border p-8 shadow-sm transition-all hover:shadow-md ${
                plan.highlight 
                  ? "border-primary/50 bg-primary/5 shadow-primary/5 ring-1 ring-primary/20" 
                  : "border-border bg-card"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                  Most Popular
                </div>
              )}
              
              <div className="mb-8">
                <h3 className="font-display text-xl font-bold">{plan.name}</h3>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-black">{plan.price}</span>
                  <span className="text-muted-foreground">/month</span>
                </div>
                <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                  {plan.description}
                </p>
              </div>

              <div className="mb-8 space-y-4">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <Button 
                asChild 
                variant={plan.highlight ? "default" : "outline"} 
                className={`w-full rounded-xl py-6 text-base font-bold ${plan.highlight ? "" : "border-border/50"}`}
              >
                <Link to={plan.href} className="flex items-center justify-center gap-2">
                  {plan.highlight && <Rocket className="h-4 w-4" />}
                  {plan.cta}
                </Link>
              </Button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
