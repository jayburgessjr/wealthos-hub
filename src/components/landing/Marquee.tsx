import { motion } from "framer-motion";

const row1 = [
  { label: "NVDA +240%", color: "primary" },
  { label: "BTC Accumulation", color: "watch" },
  { label: "SPY Iron Condors", color: "neutral" },
  { label: "ETH Covered Calls", color: "primary" },
  { label: "AAPL Bull Put Spreads", color: "watch" },
  { label: "TSLA Momentum", color: "primary" },
  { label: "MSFT LEAPS", color: "neutral" },
  { label: "AMD Breakout", color: "primary" },
  { label: "META Signal High", color: "watch" },
  { label: "GOOG Value Play", color: "neutral" },
  { label: "SOL +180%", color: "primary" },
  { label: "GLD Hedge Active", color: "watch" },
];

const row2 = [
  { label: "Kalshi: Fed Pause 68%", color: "neutral" },
  { label: "Polymarket: Rate Cut Q3", color: "primary" },
  { label: "VIX 15 — Risk On", color: "primary" },
  { label: "DXY Breaking Down", color: "watch" },
  { label: "10Y Yield 4.32%", color: "neutral" },
  { label: "Oil WTI $82.40", color: "watch" },
  { label: "EUR/USD 1.0840", color: "neutral" },
  { label: "Silver Breakout", color: "primary" },
  { label: "FOMC Watch Active", color: "watch" },
  { label: "Earnings: AAPL Next Week", color: "neutral" },
  { label: "Insider Buy: MSFT", color: "primary" },
  { label: "Congress: Tech Long", color: "watch" },
];

const colorMap: Record<string, string> = {
  primary: "bg-primary",
  watch: "bg-watch",
  neutral: "bg-neutral",
};

function MarqueeRow({ items, reverse = false, duration = 28 }: { items: typeof row1; reverse?: boolean; duration?: number }) {
  return (
    <div className="flex overflow-hidden">
      <motion.div
        animate={{ x: reverse ? [-1400, 0] : [0, -1400] }}
        transition={{ duration, repeat: Infinity, ease: "linear" }}
        className="flex min-w-full shrink-0 items-center gap-4"
      >
        {[...items, ...items].map((item, i) => (
          <div
            key={i}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border/40 bg-card px-4 py-1.5 text-sm font-mono"
          >
            <div className={`h-2 w-2 rounded-full ${colorMap[item.color]} ${i % 4 === 0 ? "animate-pulse" : ""}`} />
            <span className="text-foreground/80">{item.label}</span>
          </div>
        ))}
      </motion.div>
    </div>
  );
}

export default function Marquee() {
  return (
    <div className="relative w-full overflow-hidden py-8 border-y border-border/30 bg-background/30">
      {/* Fade masks */}
      <div className="pointer-events-none absolute left-0 top-0 z-10 h-full w-32 bg-gradient-to-r from-background to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 z-10 h-full w-32 bg-gradient-to-l from-background to-transparent" />

      <div className="mb-2 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Live Signals · Markets · Intelligence
        </p>
      </div>

      <div className="flex flex-col gap-3 mt-4">
        <MarqueeRow items={row1} duration={32} />
        <MarqueeRow items={row2} reverse duration={28} />
      </div>
    </div>
  );
}
