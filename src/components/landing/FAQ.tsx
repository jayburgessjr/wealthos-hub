import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How do the AI signals work?",
    answer: "Our AI analysis engine processes market data, news sentiment, and technical indicators in real-time. It uses large language models specifically tuned for financial markets to identify high-probability setups across multiple strategies.",
  },
  {
    question: "What is the Compound Engine?",
    answer: "The Compound Engine is a sophisticated modeling tool that helps you project and track your wealth growth over years or decades. It accounts for monthly contributions, reinvestment rates, and different strategy performance tiers.",
  },
  {
    question: "Is my data secure?",
    answer: "Yes, we use industry-standard encryption and secure authentication via Supabase. We never have direct access to your brokerage accounts; WealthOS Hub is a tracking and analysis layer.",
  },
  {
    question: "What strategies are covered?",
    answer: "We provide signals and tracking for Momentum Stocks, Options (Covered Calls, Spreads, LEAPS), Hard Money Lending, and Tax Liens. Each strategy has its own risk-adjusted performance profile.",
  },
  {
    question: "Do I need trading experience?",
    answer: "WealthOS Hub is designed for sophisticated investors, but our AI Advisor helps break down complex trades and strategies. We recommend having a basic understanding of market mechanics before executing trades.",
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
              Everything you need to know about WealthOS Hub.
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
