import { motion } from "framer-motion";
import {
  TrendingUp, Bitcoin, DollarSign, Wheat, LineChart,
  Vote, Activity, Trophy, Ticket, Building2, Banknote, Package
} from "lucide-react";

const assets = [
  { icon: TrendingUp, label: "Stocks & ETFs", sub: "Equities", color: "text-primary", bg: "bg-primary/10" },
  { icon: Bitcoin, label: "Crypto", sub: "Digital Assets", color: "text-watch", bg: "bg-watch/10" },
  { icon: Package, label: "Options", sub: "Derivatives", color: "text-neutral", bg: "bg-neutral/10" },
  { icon: DollarSign, label: "Forex", sub: "Currency Pairs", color: "text-primary", bg: "bg-primary/10" },
  { icon: Wheat, label: "Commodities", sub: "Gold, Oil, Metals", color: "text-watch", bg: "bg-watch/10" },
  { icon: LineChart, label: "Fixed Income", sub: "Bonds & Yields", color: "text-neutral", bg: "bg-neutral/10" },
  { icon: Vote, label: "Kalshi", sub: "Prediction Contracts", color: "text-primary", bg: "bg-primary/10" },
  { icon: Activity, label: "Polymarket", sub: "Decentralized Markets", color: "text-watch", bg: "bg-watch/10" },
  { icon: Trophy, label: "Sports Betting", sub: "EV Analysis", color: "text-neutral", bg: "bg-neutral/10" },
  { icon: Ticket, label: "Lottery / EV", sub: "Probabilistic Bets", color: "text-primary", bg: "bg-primary/10" },
  { icon: Building2, label: "Real Estate", sub: "Property Holdings", color: "text-watch", bg: "bg-watch/10" },
  { icon: Banknote, label: "Cash", sub: "Liquidity Tracking", color: "text-neutral", bg: "bg-neutral/10" },
];

export default function AssetClasses() {
  return (
    <section className="py-20 md:py-28 bg-card/30 border-y border-border/30">
      <div className="container px-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            Universal Coverage
          </div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-5xl">
            Every Asset Class <span className="text-primary">You Trade.</span>
          </h2>
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            From blue-chip stocks to Kalshi prediction contracts — AJE tracks,
            analyzes, and generates signals across all 10+ asset types you hold.
          </p>
        </motion.div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {assets.map((asset, i) => (
            <motion.div
              key={asset.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.05 }}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border/40 bg-card p-5 text-center transition-all hover:border-primary/30 hover:bg-card/80"
            >
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${asset.bg} ${asset.color} transition-transform group-hover:scale-110`}>
                <asset.icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-foreground">{asset.label}</div>
                <div className="text-xs text-muted-foreground">{asset.sub}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
