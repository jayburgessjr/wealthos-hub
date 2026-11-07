import { motion } from "framer-motion";
import { ClipboardList, Brain, Footprints, Repeat } from "lucide-react";

const steps = [
  {
    icon: ClipboardList,
    title: "Tell us where you are",
    description:
      "A few plain questions: your goal, what you have, and whether you have an emergency fund or costly debt. Any amount is fine, including $0.",
  },
  {
    icon: Footprints,
    title: "Get your next step",
    description:
      "The app places you on the wealth ladder and shows one next move, with a short reason why.",
  },
  {
    icon: Brain,
    title: "Ask the AI coach",
    description:
      "When you are unsure what to do next, the AI coach can talk it through with you. It is a thinking aid, not a licensed adviser.",
  },
  {
    icon: Repeat,
    title: "Keep going",
    description:
      "Update your numbers as life changes. Each step builds on the last, one small win at a time.",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="py-20 md:py-28">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-14 text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            How it works
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Four small steps, in plain words.
          </p>
        </motion.div>

        <ol className="grid grid-cols-1 gap-8 md:grid-cols-4">
          {steps.map((s, i) => (
            <motion.li
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <s.icon className="h-6 w-6" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-primary">Step {i + 1}</p>
              <h3 className="mt-1 font-display text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.description}</p>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
