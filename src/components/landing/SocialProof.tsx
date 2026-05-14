import { motion } from "framer-motion";
import { TrendingUp, Shield, Zap, Brain, BarChart3, Globe } from "lucide-react";

const stats = [
  { icon: Zap,        value: "30+",          label: "Decision Tools" },
  { icon: Globe,      value: "10+",          label: "Asset Classes" },
  { icon: Brain,      value: "2",            label: "AI Advisors" },
  { icon: BarChart3,  value: "15+",          label: "Data Sources" },
  { icon: TrendingUp, value: "Real-Time",    label: "Signal Engine" },
  { icon: Shield,     value: "Institutional",label: "Risk Framework" },
];

const testimonials = [
  {
    quote: "Finally a platform that thinks like a fund manager. The Decision Hub alone saves me hours every week.",
    name: "M. Torres",
    title: "Independent Trader · $2M AUM",
  },
  {
    quote: "The signal scoring combined with regime detection is exactly what I was building manually in spreadsheets.",
    name: "R. Chen",
    title: "Systematic Trader · Quant Background",
  },
  {
    quote: "I run Kalshi, crypto, and equities all from one dashboard now. The allocation view changed how I think about risk.",
    name: "D. Okafor",
    title: "Multi-Asset Investor",
  },
];

export default function SocialProof() {
  return (
    <section className="py-16 border-y border-border/30 bg-card/20">
      <div className="container px-4">

        {/* Stats row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6 mb-16"
        >
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.07 }}
              className="flex flex-col items-center gap-2 rounded-2xl border border-border/40 bg-card p-4 text-center"
            >
              <s.icon className="h-5 w-5 text-primary" />
              <div className="font-display text-xl font-black text-foreground">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </motion.div>
          ))}
        </motion.div>

        {/* Testimonials */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10 text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">What Traders Say</p>
        </motion.div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl border border-border/50 bg-card p-6"
            >
              {/* Stars */}
              <div className="mb-4 flex gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className="h-3.5 w-3.5 rounded-sm bg-primary/80" />
                ))}
              </div>
              <p className="text-sm text-foreground/80 leading-relaxed mb-5">"{t.quote}"</p>
              <div className="border-t border-border/40 pt-4">
                <p className="text-sm font-semibold text-foreground">{t.name}</p>
                <p className="text-xs text-muted-foreground">{t.title}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
