import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bot,
  Briefcase,
  Eye,
  FileText,
  Globe,
  LayoutDashboard,
  PieChart,
  ShieldAlert,
  TrendingUp,
  Zap,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const gettingStartedSteps = [
  {
    title: "1. Set your capital rules first",
    description:
      "Open Risk Controls before taking any trades. Set your risk tier, max drawdown, contribution cadence, and reinvestment rate so every later buy, sell, and sizing decision is framed by hard portfolio rules.",
    to: "/settings",
    label: "Open Risk Controls",
  },
  {
    title: "2. Refresh signals and shortlist opportunities",
    description:
      "Use AI Signals to generate the current opportunity set. Start with the strongest scores, then compare entry, target, stop, and reasoning before deciding what deserves capital.",
    to: "/signals",
    label: "Review Signals",
  },
  {
    title: "3. Track execution in Positions",
    description:
      "Positions is the execution layer. Use it to monitor open exposure, validate whether sizing matches your plan, and keep live risk separate from closed ideas.",
    to: "/positions",
    label: "Review Positions",
  },
  {
    title: "4. Use the Compound Engine for capital planning",
    description:
      "The Compound Engine helps you model how contributions, reinvestment, and strategy assumptions affect growth. Treat it as the portfolio policy layer, not as a prediction engine.",
    to: "/compound",
    label: "Open Compound Engine",
  },
  {
    title: "5. Close the loop with performance review",
    description:
      "Use Performance and Market Regime together. One tells you what results your decisions produced; the other explains the market environment those results were generated in.",
    to: "/performance",
    label: "Open Performance",
  },
];

const featureCards = [
  {
    icon: LayoutDashboard,
    title: "Dashboard",
    description: "Mission control for capital, P&L, signal strength, chart context, and current portfolio state.",
    to: "/dashboard",
  },
  {
    icon: TrendingUp,
    title: "Signals",
    description: "Decision intelligence for what to buy, avoid, watch, or exit, ranked by score with entry, target, stop, and factor breakdowns.",
    to: "/signals",
  },
  {
    icon: Briefcase,
    title: "Positions",
    description: "Execution and monitoring layer for what is currently deployed, how each trade is behaving, and where live risk sits.",
    to: "/positions",
  },
  {
    icon: Zap,
    title: "Compound Engine",
    description: "Capital compounding model for contribution schedules, reinvestment policy, and long-range wealth planning.",
    to: "/compound",
  },
  {
    icon: PieChart,
    title: "Strategy Allocator",
    description: "Allocation planning across strategies so concentration risk does not drift as conviction changes.",
    to: "/strategy-allocator",
  },
  {
    icon: Bot,
    title: "AI Advisor",
    description: "Decision support layer for translating platform data into next actions, trade-offs, and portfolio decisions.",
    to: "/ai-advisor",
  },
  {
    icon: Globe,
    title: "Market Regime",
    description: "Context layer for whether the environment is risk-on, defensive, trending, or unstable before you press risk.",
    to: "/market-regime",
  },
  {
    icon: Eye,
    title: "Watchlist",
    description: "Idea staging area for symbols worth monitoring before they become active portfolio candidates.",
    to: "/watchlist",
  },
  {
    icon: ShieldAlert,
    title: "Risk Controls",
    description: "Portfolio guardrails that define how aggressive your decision engine is allowed to become.",
    to: "/settings",
  },
];

const operatingCadence = [
  {
    title: "Morning setup",
    points: [
      "Open Dashboard for portfolio context and headline state.",
      "Refresh AI Signals if the current set is stale or after a meaningful market move.",
      "Check Market Regime before acting on high-beta or leverage-sensitive ideas.",
    ],
  },
  {
    title: "Trade selection",
    points: [
      "Prioritize ideas with strong signal scores and coherent target/stop structure.",
      "Compare new setups against open Positions so you do not duplicate exposure unintentionally.",
      "Use Strategy Allocator if multiple good ideas compete for the same capital.",
    ],
  },
  {
    title: "Portfolio review",
    points: [
      "Use Performance to see whether outcomes match the profile of the strategy you think you are running.",
      "Revisit Risk Controls after drawdowns, contribution changes, or a shift in time horizon.",
      "Treat Watchlist as the queue for next candidates rather than opening positions impulsively.",
    ],
  },
];

const faqItems = [
  {
    question: "What is AJE doing under the hood?",
    answer:
      "AJE combines portfolio state, AI-generated signals, market context, and compounding assumptions into one operating system for managing capital. It is built to function like a personal hedge-fund intelligence layer for an individual investor, connecting idea generation, sizing, monitoring, and review.",
  },
  {
    question: "What should a new user do first?",
    answer:
      "Start with Risk Controls, then review Signals, and only then move into Positions and capital deployment. Most mistakes in products like this come from acting on trade ideas before defining portfolio constraints.",
  },
  {
    question: "Does the platform replace judgment?",
    answer:
      "No. The platform structures information and shortens the decision loop. You still decide whether to buy, sell, hold, size up, size down, or wait.",
  },
  {
    question: "How often should signals be refreshed?",
    answer:
      "Refresh when markets materially change, when you are beginning a new review cycle, or when you have cleared stale ideas. You do not need to regenerate constantly if the market structure has not changed.",
  },
  {
    question: "What is the right mental model for the Compound Engine?",
    answer:
      "Use it as a planning and scenario tool. It helps you understand how discipline, contributions, and reinvestment policy shape long-term outcomes. It should inform allocation policy, not justify reckless near-term risk.",
  },
];

export default function Documents() {
  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-3xl border border-border bg-card">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,197,94,0.14),transparent_38%),radial-gradient(circle_at_top_right,rgba(59,130,246,0.10),transparent_32%)]" />
          <div className="relative grid gap-8 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                <FileText className="h-3.5 w-3.5" />
                Product Documentation
              </div>
              <div className="space-y-3">
                <h2 className="font-display text-3xl font-bold tracking-tight text-foreground lg:text-4xl">
                  Personal hedge-fund-style decision intelligence for building wealth in the market.
                </h2>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground lg:text-base">
                  AJE helps you build wealth through the market by surfacing decision intelligence across
                  entry, exit, sizing, risk, and portfolio management. It links signals, risk controls, position
                  monitoring, compounding logic, and performance review so you can make better buy, sell, hold,
                  and allocation decisions from one operating loop.
                </p>
              </div>
            </div>

            <Card className="border-border/80 bg-background/70">
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">Core Operating Loop</CardTitle>
                <CardDescription>Use the platform in this order to keep decisions coherent.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  "Set constraints in Risk Controls.",
                  "Generate buy, sell, hold, and watch decisions in Signals.",
                  "Track live exposure and execution in Positions.",
                  "Model portfolio policy in Compound Engine.",
                  "Review results and context in Performance and Market Regime.",
                ].map((step) => (
                  <div
                    key={step}
                    className="rounded-xl border border-border bg-card px-3 py-3 text-sm text-foreground"
                  >
                    {step}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-3">
          {gettingStartedSteps.map((step) => (
            <Card key={step.title} className="border-border/80">
              <CardHeader>
                <CardTitle className="text-base">{step.title}</CardTitle>
                <CardDescription className="text-sm leading-6">{step.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Link
                  to={step.to}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-bullish transition-fast hover:text-foreground"
                >
                  {step.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Page-by-Page Guide</CardTitle>
              <CardDescription>
                Each major module has a specific job in the decision stack. The product works best when those jobs stay distinct.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {featureCards.map((feature) => (
                <Link
                  key={feature.title}
                  to={feature.to}
                  className="group rounded-2xl border border-border bg-background p-4 transition-fast hover:border-bullish/30 hover:bg-accent/30"
                >
                  <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-foreground transition-fast group-hover:bg-bullish/10 group-hover:text-bullish">
                    <feature.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-sm font-semibold text-foreground">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{feature.description}</p>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Recommended Usage Cadence</CardTitle>
              <CardDescription>
                Run the platform as a repeatable investment process instead of opening pages at random.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {operatingCadence.map((block) => (
                <div key={block.title} className="rounded-2xl border border-border bg-background p-4">
                  <h3 className="text-sm font-semibold text-foreground">{block.title}</h3>
                  <ul className="mt-3 space-y-2">
                    {block.points.map((point) => (
                      <li key={point} className="flex gap-3 text-sm leading-6 text-muted-foreground">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-bullish" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Frequently Asked Questions</CardTitle>
            <CardDescription>
              Practical answers for using the platform as a decision engine rather than a feed of isolated widgets.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="single" collapsible className="w-full">
              {faqItems.map((item) => (
                <AccordionItem key={item.question} value={item.question}>
                  <AccordionTrigger className="text-left text-sm text-foreground hover:no-underline">
                    {item.question}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-3xl text-sm leading-6 text-muted-foreground">
                    {item.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
