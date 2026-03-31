export interface Strategy {
  name: string;
  type: string;
  avg_monthly_return: number;
  description: string;
}

export interface StrategyTier {
  min_capital: number;
  max_capital: number;
  label: string;
  color: string;
  strategies: Strategy[];
}

export const STRATEGY_TIERS: StrategyTier[] = [
  {
    min_capital: 0, max_capital: 499, label: "Seed", color: "#7A8BA3",
    strategies: [
      { name: "Cash-Back Stacking", type: "arbitrage", avg_monthly_return: 0.02, description: "Credit card rewards + sign-up bonuses" },
      { name: "Fractional Shares", type: "equities", avg_monthly_return: 0.04, description: "Buy partial shares of high-value stocks" },
    ],
  },
  {
    min_capital: 500, max_capital: 1999, label: "Entry", color: "#3D8EFF",
    strategies: [
      { name: "Cash-Secured Puts", type: "options", avg_monthly_return: 0.03, description: "Sell puts on stocks you want to own" },
      { name: "Covered Calls", type: "options", avg_monthly_return: 0.025, description: "Generate income on existing shares" },
      { name: "Momentum Trades", type: "equities", avg_monthly_return: 0.06, description: "Signal-driven stock entries/exits" },
    ],
  },
  {
    min_capital: 2000, max_capital: 9999, label: "Active", color: "#00E5A0",
    strategies: [
      { name: "Options Spreads", type: "options", avg_monthly_return: 0.05, description: "Defined risk vertical spreads" },
      { name: "P2P Lending", type: "lending", avg_monthly_return: 0.008, description: "Private notes, 8-12% annualized" },
      { name: "Tax Lien Certificates", type: "real_estate", avg_monthly_return: 0.012, description: "12-36% statutory returns by state" },
    ],
  },
  {
    min_capital: 10000, max_capital: 49999, label: "Growth", color: "#FFB830",
    strategies: [
      { name: "Hard Money Lending", type: "lending", avg_monthly_return: 0.01, description: "Short-term RE loans at 10-14%" },
      { name: "SPV Participation", type: "alternatives", avg_monthly_return: 0.015, description: "Join small fund deals as LP" },
      { name: "Options Wheel Strategy", type: "options", avg_monthly_return: 0.04, description: "CSP → assignment → covered call loop" },
    ],
  },
  {
    min_capital: 50000, max_capital: 249999, label: "Scale", color: "#FF4D6A",
    strategies: [
      { name: "Distressed Debt", type: "alternatives", avg_monthly_return: 0.02, description: "Buy notes at discount" },
      { name: "BRRRR Real Estate", type: "real_estate", avg_monthly_return: 0.018, description: "Buy, rehab, rent, refinance, repeat" },
      { name: "Private Business Loans", type: "lending", avg_monthly_return: 0.014, description: "Direct lending to small businesses" },
    ],
  },
  {
    min_capital: 250000, max_capital: Infinity, label: "Institutional", color: "#E8EDF5",
    strategies: [
      { name: "Micro Fund / SPV", type: "alternatives", avg_monthly_return: 0.025, description: "Launch your own fund structure" },
      { name: "Fix & Flip Financing", type: "real_estate", avg_monthly_return: 0.02, description: "Be the bank on RE deals" },
      { name: "Portfolio of Notes", type: "lending", avg_monthly_return: 0.015, description: "Diversified private debt portfolio" },
    ],
  },
];

export function getCurrentTier(capital: number): StrategyTier {
  return STRATEGY_TIERS.find(t => capital >= t.min_capital && capital <= t.max_capital) || STRATEGY_TIERS[0];
}

export function getAvailableStrategies(capital: number): Strategy[] {
  return STRATEGY_TIERS.filter(t => capital >= t.min_capital).flatMap(t => t.strategies);
}

export function getNextTierUnlock(capital: number) {
  const next = STRATEGY_TIERS.find(t => t.min_capital > capital);
  if (!next) return null;
  return { tier: next, amount_needed: next.min_capital - capital, pct_of_way: (capital / next.min_capital) * 100 };
}
