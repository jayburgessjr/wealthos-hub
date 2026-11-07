import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Wallet, Sprout, Wrench, ArrowRight } from "lucide-react";

const pillars = [
  {
    icon: Wallet,
    title: "Know where you stand",
    description:
      "Add what you have and what you owe. See your net worth, bills, and budget in plain words, starting from zero if you need to.",
    features: ["Net worth", "Bills and budget", "Debts", "Savings goals"],
    route: "/home",
  },
  {
    icon: Sprout,
    title: "Climb the wealth ladder",
    description:
      "Starter fund, emergency fund, clearing costly debt, then investing basics. The app shows the one next move and why it matters.",
    features: ["Next best move", "Starter checklist", "Short lessons", "AI coach"],
    route: "/learn",
  },
  {
    icon: Wrench,
    title: "Pro tools when you want them",
    description:
      "Market charts, signals, and planning tools are there when you are ready. They stay out of the way until you switch to Pro mode.",
    features: ["Charts and screener", "Signals", "Planning tools", "Journal"],
    route: "/invs/dashboard",
  },
];

export default function ThreePillars() {
  return (
    <section id="features" className="py-20 md:py-28">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            One place for your whole money picture
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Simple by default. More depth is one switch away.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {pillars.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col rounded-2xl border border-border/50 bg-card p-6"
            >
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <p.icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="font-display text-xl font-bold">{p.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.description}</p>
              <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to={p.route}
                className="mt-auto inline-flex items-center gap-1 pt-6 text-sm font-semibold text-primary hover:underline"
              >
                Open <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
