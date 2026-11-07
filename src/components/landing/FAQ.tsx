import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "What is this, and who is it for?",
    answer:
      "It is a private money app for friends and family invited by Jay. It helps you see where you stand, pick one next step, and build wealth from whatever you have today, even $1.",
  },
  {
    question: "Do I need to know anything about investing?",
    answer:
      "No. The app starts with the basics: a starter fund, an emergency fund, and costly debt. Short lessons explain terms in plain words. If you already trade, switch to Pro mode for the full toolset.",
  },
  {
    question: "What does the AI do?",
    answer:
      "The AI coach helps you think through what to do next. It is a thinking aid and not a licensed financial adviser, so check important decisions with a qualified professional.",
  },
  {
    question: "Does it promise returns?",
    answer:
      "No. Investments can lose value and nothing here guarantees any result. The tools are educational.",
  },
  {
    question: "Can I try it without signing in?",
    answer:
      "Yes. The demo shows sample data and saves nothing. To keep your own numbers, sign in with your invitation.",
  },
  {
    question: "Does it connect to my bank or broker?",
    answer:
      "No. You enter your own numbers. The app is a planning and learning tool, not a broker.",
  },
  {
    question: "Is my data private?",
    answer:
      "Your data is stored with row level security, so it is only available to your signed-in account.",
  },
  {
    question: "Is there a cost?",
    answer: "No. Everything is open to everyone Jay invites.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-28">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-12 text-center"
          >
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Common questions
            </h2>
          </motion.div>
          <Accordion type="single" collapsible className="w-full space-y-2">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={faq.question}
                value={`item-${i}`}
                className="rounded-xl border border-border/50 bg-card px-6 transition-colors data-[state=open]:border-primary/30"
              >
                <AccordionTrigger className="py-5 text-left font-display text-base font-bold hover:text-primary hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="pb-5 text-sm leading-relaxed text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
