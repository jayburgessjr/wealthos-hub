import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

const gets = [
  "A home page that works with zero data, so day one is useful",
  "A wealth ladder that shows where you are and what comes next",
  "One next best move, with a plain reason why",
  "Short beginner lessons: compound interest, emergency funds, costly debt, index funds, risk",
  "Budget, bills, debts and goals in one private household",
  "An AI coach you can ask what to do next",
  "Pro tools for markets and planning, when you want them",
];

export default function SocialProof() {
  return (
    <section id="what-you-get" className="py-20 md:py-28">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-10 text-center"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              What you get
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              No hype and no promised returns. Just clear tools and honest guidance.
            </p>
          </motion.div>
          <ul className="space-y-3 rounded-2xl border border-border/50 bg-card p-6">
            {gets.map((g) => (
              <li key={g} className="flex items-start gap-3 text-sm text-foreground">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
