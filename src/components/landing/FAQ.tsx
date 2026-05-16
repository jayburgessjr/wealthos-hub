import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { motion } from "framer-motion";

const faqs = [
  {
    question: "What is AJE and who is it for?",
    answer:
      "AJE is a personal hedge fund operating system for sophisticated individual investors. It gives you the same decision infrastructure that institutional traders use — signals, risk controls, AI advisors, allocation modeling — without needing a Bloomberg terminal or a prop desk. It's built for investors who want to run their capital with intention, not guesswork.",
  },
  {
    question: "How do the AI signals work?",
    answer:
      "The signal engine combines market data, sentiment, technical context, and regime analysis to produce scored trade ideas with suggested actions, entries, targets, stops, and sizing context. Signals are ranked by urgency and filtered to your watchlist and portfolio. It's designed to support your decisions — not replace your judgment.",
  },
  {
    question: "What is the Decision Hub?",
    answer:
      "The Decision Hub is your daily command center. It shows every decision you need to make today, ranked by urgency: what to enter, what to exit, what to watch, how to deploy capital, and which strategies to run given the current market regime. It's the first page you open, every session.",
  },
  {
    question: "What is the Compound Engine?",
    answer:
      "The Compound Engine is a long-term capital planning tool. You set a starting balance, contribution schedule, return assumption, and target number — it models how consistent execution compounds into 7-figure outcomes. Pressure-test your portfolio policy before you change how you deploy capital.",
  },
  {
    question: "What markets and asset classes are supported?",
    answer:
      "Stocks, ETFs, options, crypto, forex, commodities, fixed income, Kalshi prediction contracts, Polymarket, sports betting EV analysis, lottery EV, real estate holdings, and cash — all tracked in one place. 10+ asset classes across 15+ data sources.",
  },
  {
    question: "What are prediction markets and why are they on a financial platform?",
    answer:
      "Prediction markets like Kalshi and Polymarket price the probability of real-world events — Fed rate decisions, election outcomes, economic data releases. Those probabilities are directly relevant to how you position your portfolio. AJE integrates them so your trading thesis and your macro bets are informed by the same probability data.",
  },
  {
    question: "Can I input my real portfolio from other brokers?",
    answer:
      "Yes. The My Portfolio page lets you manually input all your real holdings — stocks, crypto, options, real estate, Kalshi contracts, bonds, cash — across any broker or exchange. Once entered, AJE uses that data to personalize every signal, risk calculation, and allocation recommendation to your actual positions.",
  },
  {
    question: "Is my financial data secure?",
    answer:
      "Yes. All data is stored securely via Supabase with Row Level Security — your holdings, portfolio, and decisions are only accessible to your authenticated account. AJE is a decision and analysis layer, not a broker. We do not connect to or have access to your brokerage accounts.",
  },
  {
    question: "What is the AI Financial Advisor?",
    answer:
      "The AI Financial Advisor is a sophisticated AI model trained on financial strategy, portfolio theory, risk management, and market psychology. You can ask it anything — position sizing for a specific setup, whether a trade aligns with your mission, how to structure a hedge, what historical data says about a pattern. It responds with your full portfolio context in mind.",
  },
  {
    question: "Do I need trading experience to use AJE?",
    answer:
      "Basic market familiarity helps. AJE is not an autopilot system — it's a decision-intelligence layer that helps you think more clearly about what to buy, sell, hold, size, and monitor. The more context you bring, the more valuable the platform becomes.",
  },
  {
    question: "What's included in the Weekly Briefing?",
    answer:
      "The Weekly Briefing is an AI-generated intelligence report covering market regime, top signals, macro events to watch, insider activity trends, and your portfolio's current risk exposure — delivered fresh each week so you start every trading week with full situational awareness.",
  },
  {
    question: "What's included in the Free tier?",
    answer:
      "The Free tier includes the full dashboard, portfolio tracking, position management, live charts, asset screener, paper trading simulator, position sizer, trading journal, P&L calendar, performance metrics, markets overview, watchlist, and the Decision Hub — all at no cost, no credit card required. AI features and advanced engines require a Pro or Elite subscription.",
  },
  {
    question: "What does Elite include that Pro doesn't?",
    answer:
      "Elite ($250/mo) unlocks the complete platform: Options Flow and Insider Activity, all four Prediction Markets (Kalshi, Polymarket, Sports, Lottery EV), the full Wealth Planning suite (Net Worth, Retirement, Estate Planning, Cash Flow, Debt Manager, Dividends, Real Estate, Collectibles, Insurance), Business tools (Entity Structure, Fundraising), Private Equity, M&A Tracker, IPO Tracker, Weekly Briefing, and the Document Vault. It's designed for serious capital allocators managing $250K+.",
  },
];

export default function FAQ() {
  return (
    <section id="faq" className="py-20 md:py-32">
      <div className="container px-4">
        <div className="mx-auto max-w-4xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-14 text-center"
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              Got Questions?
            </div>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
              Frequently Asked <span className="text-primary">Questions</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              What the platform does, how it works, and what to expect.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
          >
            <Accordion type="single" collapsible className="w-full space-y-2">
              {faqs.map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="rounded-xl border border-border/50 bg-card px-6 data-[state=open]:border-primary/30 data-[state=open]:bg-primary/5 transition-colors"
                >
                  <AccordionTrigger className="font-display text-left text-base font-bold py-5 hover:text-primary transition-colors hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground text-sm pb-5 leading-relaxed">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
