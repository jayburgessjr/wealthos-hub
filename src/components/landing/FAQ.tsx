import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do the AI signals work?",
    answer: "The signal engine combines market data, sentiment, and technical context to produce scored ideas with suggested actions, entries, targets, stops, and sizing context. It is designed to support decisions, not to remove judgment.",
  },
  {
    question: "What is the Compound Engine?",
    answer: "The Compound Engine is a planning tool for modeling long-term wealth growth. It accounts for contributions, reinvestment, and strategy assumptions so you can pressure-test portfolio policy before changing how you deploy capital.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes. We use secure authentication and storage via Supabase. WealthOS is a decision and analysis layer, not a broker, and it does not require direct custody of your assets to deliver portfolio intelligence.",
  },
  {
    question: "What does WealthOS actually help me decide?",
    answer: "The current product is built around entry, exit, sizing, risk, and portfolio management. It helps you review opportunities, open and close tracked positions, compare allocations, understand market regime, and evaluate performance over time.",
  },
  {
    question: "Do I need trading experience?",
    answer: "Basic market familiarity helps. WealthOS is not an autopilot hedge fund manager; it is a decision-intelligence layer that helps you think more clearly about what to buy, sell, hold, size, and monitor.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-32">
      <div className="container px-4">
        <div className="mx-auto max-w-3xl">
          <div className="mb-12 text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Frequently Asked Questions
            </h2>
            <p className="mt-4 text-muted-foreground">
              What the product does today, and how to think about it accurately.
            </p>
          </div>
          
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, i) => (
              <AccordionItem key={i} value={`item-${i}`} className="border-border/50">
                <AccordionTrigger className="font-display text-left text-lg font-bold py-6 hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground text-base pb-6 leading-relaxed">
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
