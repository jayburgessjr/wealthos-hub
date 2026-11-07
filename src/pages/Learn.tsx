import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";

interface Lesson {
  id: string;
  title: string;
  short: string;
  points: string[];
}

const LESSONS: Lesson[] = [
  {
    id: "compound-interest",
    title: "Compound interest",
    short: "Growth on your growth.",
    points: [
      "When you earn interest, that interest can start earning interest too. Over many years this adds up.",
      "Time matters more than size. Starting early with a small amount can matter more than starting late with a larger one.",
      "It works in reverse on debt: unpaid interest can grow too.",
      "Growth rates are never guaranteed. Savings and investments can earn less than expected, or lose value.",
    ],
  },
  {
    id: "emergency-fund",
    title: "Emergency fund",
    short: "Cash set aside for surprises.",
    points: [
      "It is money kept for things you cannot plan for, like a car repair or a gap in income.",
      "A common first goal is a small starter amount, then about three months of basic costs.",
      "Keep it somewhere safe and easy to reach, such as a savings account, not in investments that can drop in value.",
      "Having one helps you avoid borrowing at high rates when something goes wrong.",
    ],
  },
  {
    id: "high-interest-debt",
    title: "High-interest debt",
    short: "Debt that grows fast.",
    points: [
      "Credit cards and some personal loans can charge a high yearly rate.",
      "Paying down a balance that charges more than you are likely to earn on savings saves you that interest for sure.",
      "Pay at least the minimum on everything, then put extra toward the highest rate (avalanche) or the smallest balance (snowball).",
      "If a payment feels out of reach, a nonprofit credit counselor can help.",
    ],
  },
  {
    id: "index-funds",
    title: "Index funds",
    short: "Own a small slice of many companies.",
    points: [
      "An index fund holds a whole group of companies, so you are not relying on any single one.",
      "Many have low fees, and fees matter because they come out of your results every year.",
      "Their value goes up and down with the market. They can lose money, sometimes for years.",
      "Many people invest a set amount on a regular schedule rather than trying to pick the perfect moment.",
    ],
  },
  {
    id: "risk",
    title: "Risk",
    short: "The chance things turn out worse than hoped.",
    points: [
      "Higher possible growth usually comes with bigger ups and downs.",
      "Money you need soon should not sit in things that can drop in value.",
      "Spreading money across different kinds of assets can reduce the damage from any one of them.",
      "Your comfort matters. If a drop would make you panic and sell, a calmer mix may suit you better.",
    ],
  },
];

export default function Learn() {
  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold tracking-tight">Learn the basics</h1>
          <p className="mt-2 text-muted-foreground">
            Five short lessons in plain words. Read one a day and you will know more than you did
            yesterday.
          </p>
        </header>

        <div className="space-y-4">
          {LESSONS.map((l) => (
            <Card key={l.id} className="p-5" data-testid={`lesson-${l.id}`}>
              <h2 className="font-display text-xl font-bold">{l.title}</h2>
              <p className="text-sm text-muted-foreground">{l.short}</p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
                {l.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </Card>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          This is general education, not investment, tax or legal advice, and BWH is not a
          registered investment adviser. Investments can lose value and nothing here promises any
          return.{" "}
          <Link to="/disclaimer" className="underline">
            Read the full disclaimer
          </Link>
          .
        </p>
      </div>
    </DashboardLayout>
  );
}
