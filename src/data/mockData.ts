export const portfolioStats = {
  totalCapital: 24830,
  todayPnl: 482.30,
  allTimeReturn: 24.83,
  deployed: 18620,
  available: 6210,
  winRate: 73.2,
};

export const signals = [
  {
    id: "1",
    ticker: "NVDA",
    strategyType: "Momentum + AI Sentiment",
    signalScore: 87,
    action: "Strong Buy" as const,
    entryPrice: 875.50,
    targetPrice: 1020.00,
    stopPrice: 820.00,
    positionSizePct: 15,
    positionSizeDollar: 3724.50,
    reasoning: [
      "AI chip demand accelerating with new data center contracts",
      "Technical breakout above 200-day MA with volume confirmation",
      "Institutional accumulation detected in dark pool flow",
      "Earnings beat estimates 3 consecutive quarters",
    ],
    expiresAt: "2026-04-05",
    createdAt: "2026-03-31",
  },
  {
    id: "2",
    ticker: "SPY",
    strategyType: "Index Momentum",
    signalScore: 72,
    action: "Buy" as const,
    entryPrice: 528.40,
    targetPrice: 560.00,
    stopPrice: 510.00,
    positionSizePct: 20,
    positionSizeDollar: 4966.00,
    reasoning: [
      "Broad market uptrend intact above key support levels",
      "Positive breadth divergence with advancing stocks",
      "Federal Reserve dovish stance supporting risk assets",
      "Seasonal strength pattern into Q2",
    ],
    expiresAt: "2026-04-10",
    createdAt: "2026-03-30",
  },
  {
    id: "3",
    ticker: "TSLA",
    strategyType: "Options Premium",
    signalScore: 58,
    action: "Watch" as const,
    entryPrice: 178.20,
    targetPrice: 195.00,
    stopPrice: 165.00,
    positionSizePct: 8,
    positionSizeDollar: 1986.40,
    reasoning: [
      "Elevated implied volatility creating premium selling opportunity",
      "Support holding at $170 level but momentum weakening",
      "Mixed delivery numbers creating uncertainty",
      "Wait for clearer directional signal before entry",
    ],
    expiresAt: "2026-04-07",
    createdAt: "2026-03-29",
  },
  {
    id: "4",
    ticker: "AMZN",
    strategyType: "Mean Reversion",
    signalScore: 31,
    action: "Exit" as const,
    entryPrice: 192.80,
    targetPrice: 185.00,
    stopPrice: 198.00,
    positionSizePct: 0,
    positionSizeDollar: 0,
    reasoning: [
      "Price approaching major resistance with declining volume",
      "RSI divergence signaling potential reversal",
      "Cloud growth deceleration concerns from analyst reports",
      "Close position to protect gains before earnings",
    ],
    expiresAt: "2026-04-02",
    createdAt: "2026-03-28",
  },
];

export const positions = [
  {
    id: "1",
    ticker: "NVDA",
    strategy: "Momentum",
    entryDate: "2026-03-15",
    entryPrice: 842.30,
    currentPrice: 878.90,
    shares: 4,
    value: 3515.60,
    pnlDollars: 146.40,
    pnlPercent: 4.34,
    signalScore: 87,
    status: "open" as const,
  },
  {
    id: "2",
    ticker: "SPY",
    strategy: "Index",
    entryDate: "2026-03-10",
    entryPrice: 518.60,
    currentPrice: 528.40,
    shares: 10,
    value: 5284.00,
    pnlDollars: 98.00,
    pnlPercent: 1.89,
    signalScore: 72,
    status: "open" as const,
  },
  {
    id: "3",
    ticker: "AAPL",
    strategy: "Options Premium",
    entryDate: "2026-03-20",
    entryPrice: 172.50,
    currentPrice: 169.80,
    shares: 15,
    value: 2547.00,
    pnlDollars: -40.50,
    pnlPercent: -1.57,
    signalScore: 64,
    status: "open" as const,
  },
  {
    id: "4",
    ticker: "AMZN",
    strategy: "Mean Reversion",
    entryDate: "2026-03-05",
    entryPrice: 185.20,
    currentPrice: 192.80,
    shares: 20,
    value: 3856.00,
    pnlDollars: 152.00,
    pnlPercent: 4.10,
    signalScore: 31,
    status: "open" as const,
  },
];

export const watchlistItems = [
  { ticker: "META", name: "Meta Platforms", price: 512.40, change: 2.34, signalScore: 78 },
  { ticker: "GOOG", name: "Alphabet Inc", price: 158.20, change: -0.82, signalScore: 65 },
  { ticker: "MSFT", name: "Microsoft Corp", price: 428.70, change: 1.15, signalScore: 71 },
  { ticker: "AMD", name: "AMD Inc", price: 178.50, change: 3.21, signalScore: 82 },
  { ticker: "COIN", name: "Coinbase Global", price: 245.80, change: -1.45, signalScore: 55 },
];

export const sentimentItems = [
  {
    headline: "NVIDIA announces next-gen AI chip partnership with major cloud providers",
    source: "Reuters",
    time: "12m ago",
    sentiment: 85,
  },
  {
    headline: "Federal Reserve signals potential rate cut in Q2 amid cooling inflation",
    source: "Bloomberg",
    time: "1h ago",
    sentiment: 72,
  },
  {
    headline: "Tesla delivery numbers miss analyst expectations for Q1",
    source: "CNBC",
    time: "3h ago",
    sentiment: 28,
  },
];

export const compoundData = Array.from({ length: 12 }, (_, i) => ({
  month: i,
  actual: i <= 10 ? Math.round(500 * Math.pow(1.08, i) * (1 + Math.random() * 0.1)) : null,
  projected: Math.round(500 * Math.pow(1.08, i)),
}));

export const candlestickData = (() => {
  const data = [];
  let price = 850;
  const now = new Date("2026-03-31");
  for (let i = 60; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    if (date.getDay() === 0 || date.getDay() === 6) continue;
    const open = price + (Math.random() - 0.48) * 10;
    const close = open + (Math.random() - 0.45) * 15;
    const high = Math.max(open, close) + Math.random() * 8;
    const low = Math.min(open, close) - Math.random() * 8;
    price = close;
    data.push({
      time: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`,
      open: +open.toFixed(2),
      high: +high.toFixed(2),
      low: +low.toFixed(2),
      close: +close.toFixed(2),
      volume: Math.floor(20000000 + Math.random() * 30000000),
    });
  }
  return data;
})();

export const strategyThresholds = [
  { capital: 0, label: "$0", strategies: ["Paper Trading", "Education Mode"] },
  { capital: 500, label: "$500", strategies: ["Options Premium Selling", "Micro Momentum"] },
  { capital: 2000, label: "$2K", strategies: ["Swing Trading", "Sector Rotation"] },
  { capital: 5000, label: "$5K", strategies: ["Full Momentum Suite", "Pairs Trading"] },
  { capital: 25000, label: "$25K", strategies: ["Day Trading (PDT)", "Advanced Options"] },
  { capital: 100000, label: "$100K", strategies: ["Hard Money Lending", "Portfolio Margin"] },
];
