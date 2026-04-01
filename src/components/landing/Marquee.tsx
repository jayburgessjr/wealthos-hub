import { motion } from "framer-motion";

const items = [
  "NVDA +240%",
  "TSLA Momentum",
  "BTC Accumulation",
  "ETH Covered Calls",
  "SPY Iron Condors",
  "AAPL Bull Put Spreads",
  "MSFT Leap Options",
  "AMD Breakout",
  "META Signal High",
  "GOOG Value Play",
];

export default function Marquee() {
  return (
    <div className="relative flex w-full flex-col items-center justify-center overflow-hidden py-10 border-y border-border/30 bg-background/30">
      <div className="container px-4 text-center mb-6">
        <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
          Live Strategy Signals & Market Flow
        </p>
      </div>
      
      <div className="flex select-none gap-8 py-4">
        <motion.div
          animate={{ x: [0, -1035] }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="flex min-w-full shrink-0 items-center justify-around gap-8"
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="flex items-center gap-2 rounded-full border border-border/50 bg-card px-4 py-1.5 font-mono text-sm"
            >
              <div className={`h-2 w-2 rounded-full ${i % 3 === 0 ? 'bg-primary animate-pulse' : i % 3 === 1 ? 'bg-neutral' : 'bg-watch'}`} />
              {item}
            </div>
          ))}
          {items.map((item, i) => (
            <div
              key={`dup-${i}`}
              className="flex items-center gap-2 rounded-full border border-border/50 bg-card px-4 py-1.5 font-mono text-sm"
            >
              <div className={`h-2 w-2 rounded-full ${i % 3 === 0 ? 'bg-primary animate-pulse' : i % 3 === 1 ? 'bg-neutral' : 'bg-watch'}`} />
              {item}
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}
