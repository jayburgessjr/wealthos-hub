import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { TrendingUp, Home, PiggyBank, ArrowRight } from "lucide-react";

const pillars = [
  {
    mode: "INVEST",
    icon: TrendingUp,
    accentText: "text-primary",
    accentBorder: "border-primary/20",
    accentBg: "bg-primary/10",
    accentDot: "bg-primary",
    title: "Personal Hedge Fund OS",
    description:
      "Trade like an institution. AI signals, compound modeling, and market intelligence — all calibrated to your capital and risk profile.",
    features: [
      "AI Signals",
      "Decision Hub",
      "Compound Engine",
      "Market Intelligence",
      "Prediction Markets",
    ],
    route: "/invs/dashboard",
  },
  {
    mode: "HOUSEHOLD",
    icon: Home,
    accentText: "text-emerald-400",
    accentBorder: "border-emerald-400/20",
    accentBg: "bg-emerald-400/10",
    accentDot: "bg-emerald-400",
    title: "Household Command Center",
    description:
      "Run your household finances like a CFO. Budgets, bills, subscriptions, debt payoff, and AI-generated monthly health reports.",
    features: [
      "Budget & Expenses",
      "Bills & Subscriptions",
      "Income Tracking",
      "Goals & Net Worth",
      "AI CFO Reports",
    ],
    route: "/household",
  },
  {
    mode: "WEALTH",
    icon: PiggyBank,
    accentText: "text-amber-400",
    accentBorder: "border-amber-400/20",
    accentBg: "bg-amber-400/10",
    accentDot: "bg-amber-400",
    title: "Long-term Wealth Builder",
    description:
      "Plan decades ahead. Retirement projections, real estate tracking, dividends, insurance, and estate planning in one place.",
    features: [
      "Retirement Planning",
      "Real Estate",
      "Dividends",
      "Insurance",
      "Estate Planning",
    ],
    route: "/wealth",
  },
];

export default function ThreePillars() {
  return (
    <section className="py-20 md:py-32 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-background via-card/20 to-background" />

      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-14 text-center"
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
            The Platform
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            One OS. <span className="text-primary">Three Modes.</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
            Choose the lens that fits your moment — or run all three
            simultaneously.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {pillars.map((pillar, i) => (
            <motion.div
              key={pillar.mode}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className={`group relative flex flex-col overflow-hidden rounded-2xl border ${pillar.accentBorder} bg-card p-6 transition-all hover:shadow-xl`}
            >
              {/* Icon */}
              <div
                className={`mb-5 flex h-12 w-12 items-center justify-center rounded-xl ${pillar.accentBg}`}
              >
                <pillar.icon className={`h-6 w-6 ${pillar.accentText}`} />
              </div>

              {/* Mode label */}
              <div
                className={`mb-2 text-xs font-mono font-bold uppercase tracking-widest ${pillar.accentText} opacity-70`}
              >
                {pillar.mode}
              </div>

              {/* Title */}
              <h3 className="mb-3 font-display text-xl font-bold">
                {pillar.title}
              </h3>

              {/* Description */}
              <p className="mb-5 text-sm text-muted-foreground leading-relaxed">
                {pillar.description}
              </p>

              {/* Feature list */}
              <ul className="mb-6 flex flex-col gap-1.5">
                {pillar.features.map((feat) => (
                  <li key={feat} className="flex items-center gap-2">
                    <span
                      className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${pillar.accentDot}`}
                    />
                    <span className="text-xs text-muted-foreground">
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              {/* Explore link */}
              <div className="mt-auto">
                <Link
                  to={pillar.route}
                  className={`inline-flex items-center gap-1.5 text-sm font-medium ${pillar.accentText} hover:opacity-80 transition-opacity`}
                >
                  Explore <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
