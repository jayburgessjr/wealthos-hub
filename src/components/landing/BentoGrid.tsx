import { motion } from "framer-motion";
import { Zap, BarChart3, TrendingUp, ShieldCheck, Cpu, Globe } from "lucide-react";

const features = [
  {
    title: "AI-Powered Signals",
    description: "Institutional-grade momentum and value signals updated in real-time by our proprietary LLM engines.",
    icon: Zap,
    className: "md:col-span-2",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Strategy Tiers",
    description: "Diverse strategies from safe covered calls to high-alpha options trading.",
    icon: ShieldCheck,
    className: "md:col-span-1",
    color: "text-neutral",
    bgColor: "bg-neutral/10",
  },
  {
    title: "Compound Engine",
    description: "Simulate and track your long-term wealth growth with precise reinvestment modeling.",
    icon: TrendingUp,
    className: "md:col-span-1",
    color: "text-watch",
    bgColor: "bg-watch/10",
  },
  {
    title: "Global Market Coverage",
    description: "Unified tracking across stocks, options, hard money lending, and specialized assets.",
    icon: Globe,
    className: "md:col-span-2",
    color: "text-bearish",
    bgColor: "bg-bearish/10",
  },
  {
    title: "Smart Risk Analysis",
    description: "Automated drawdown protection and position sizing based on your personal risk tolerance.",
    icon: Cpu,
    className: "md:col-span-1",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    title: "Advanced Analytics",
    description: "Deep dive into your portfolio performance with institutional-grade metrics.",
    icon: BarChart3,
    className: "md:col-span-2",
    color: "text-neutral",
    bgColor: "bg-neutral/10",
  },
];

export default function BentoGrid() {
  return (
    <section id="features" className="py-20 md:py-32 bg-background/50">
      <div className="container px-4">
        <div className="mb-16 text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Everything You Need <br /> To <span className="text-primary">Outperform</span>.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A comprehensive suite of tools designed for the modern wealth manager.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className={`group relative overflow-hidden rounded-2xl border border-border/50 bg-card p-8 transition-all hover:border-primary/30 hover:shadow-2xl hover:shadow-primary/5 ${feature.className}`}
            >
              <div className="absolute top-0 right-0 p-8 opacity-5 transition-opacity group-hover:opacity-10">
                <feature.icon className="h-24 w-24" />
              </div>
              
              <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${feature.bgColor} ${feature.color}`}>
                <feature.icon className="h-6 w-6" />
              </div>
              
              <h3 className="mb-2 font-display text-xl font-bold">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.description}</p>
              
              <div className="mt-8 flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                Learn more <Zap className="h-3 w-3" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
