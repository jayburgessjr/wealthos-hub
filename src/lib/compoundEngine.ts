import { calcBlendedReturn, getCurrentTier, getAvailableStrategies, getNextTierUnlock } from "@/data/strategyTiers";

export { calcBlendedReturn };

// Re-export for convenience
function calcBlendedReturnLocal(capital: number, riskTier: string = "moderate"): number {
  const available = getAvailableStrategies(capital);
  if (!available.length) return 0.02;
  const riskMultiplier: Record<string, number> = { conservative: 0.6, moderate: 1.0, aggressive: 1.4 };
  const avgReturn = available.reduce((sum, s) => sum + s.avg_monthly_return, 0) / available.length;
  return avgReturn * (riskMultiplier[riskTier] || 1.0);
}

export interface ProjectionRow {
  month: number;
  capital: number;
  monthly_return_dollars: number;
  monthly_return_pct: string;
  reinvested: number;
  withdrawn: number;
  cumulative_return: number;
  cumulative_return_pct: string;
  tier_label: string;
  tier_color: string;
  strategies_available: number;
  next_unlock: string;
  next_unlock_pct: number;
}

export function projectGrowth(opts: {
  startingCapital?: number;
  monthlyContribution?: number;
  timeHorizonMonths?: number;
  reinvestmentPct?: number;
  riskTier?: string;
  customMonthlyRate?: number | null;
}): ProjectionRow[] {
  const { startingCapital = 0, monthlyContribution = 0, timeHorizonMonths = 24, reinvestmentPct = 100, riskTier = "moderate", customMonthlyRate = null } = opts;
  const rows: ProjectionRow[] = [];
  let capital = startingCapital;

  for (let month = 0; month <= timeHorizonMonths; month++) {
    const monthlyRate = customMonthlyRate !== null ? customMonthlyRate / 100 : calcBlendedReturnLocal(capital, riskTier);
    const returnDollars = capital * monthlyRate;
    const reinvested = returnDollars * (reinvestmentPct / 100);
    const withdrawn = returnDollars - reinvested;
    const tier = getCurrentTier(capital);
    const strategies = getAvailableStrategies(capital);
    const nextUnlock = getNextTierUnlock(capital);

    rows.push({
      month,
      capital: Math.round(capital * 100) / 100,
      monthly_return_dollars: Math.round(returnDollars * 100) / 100,
      monthly_return_pct: (monthlyRate * 100).toFixed(2),
      reinvested: Math.round(reinvested * 100) / 100,
      withdrawn: Math.round(withdrawn * 100) / 100,
      cumulative_return: Math.round((capital - startingCapital) * 100) / 100,
      cumulative_return_pct: startingCapital > 0 ? (((capital - startingCapital) / startingCapital) * 100).toFixed(1) : "0",
      tier_label: tier.label,
      tier_color: tier.color,
      strategies_available: strategies.length,
      next_unlock: nextUnlock ? `$${nextUnlock.amount_needed.toLocaleString()} to ${nextUnlock.tier.label}` : "All tiers unlocked",
      next_unlock_pct: nextUnlock ? Math.round(nextUnlock.pct_of_way) : 100,
    });

    if (month < timeHorizonMonths) {
      capital += reinvested + monthlyContribution;
    }
  }
  return rows;
}

export interface MonteCarloResult {
  p10: number; p25: number; p50: number; p75: number; p90: number;
  mean: number; probability_of_loss: number; probability_double: number;
}

export function monteCarlo(opts: {
  startingCapital: number; monthlyContribution: number; timeHorizonMonths: number; riskTier?: string; runs?: number;
}): MonteCarloResult {
  const { startingCapital, monthlyContribution, timeHorizonMonths, riskTier = "moderate", runs = 500 } = opts;
  const baseRate = calcBlendedReturnLocal(startingCapital, riskTier);
  const volatility: Record<string, number> = { conservative: 0.005, moderate: 0.012, aggressive: 0.022 };
  const vol = volatility[riskTier] || 0.012;
  const endings: number[] = [];

  for (let run = 0; run < runs; run++) {
    let capital = startingCapital;
    for (let m = 0; m < timeHorizonMonths; m++) {
      const rand = (Math.random() + Math.random() - 1) * vol;
      const monthRate = Math.max(-0.15, baseRate + rand);
      capital = capital * (1 + monthRate) + monthlyContribution;
    }
    endings.push(capital);
  }

  endings.sort((a, b) => a - b);
  return {
    p10: endings[Math.floor(runs * 0.10)],
    p25: endings[Math.floor(runs * 0.25)],
    p50: endings[Math.floor(runs * 0.50)],
    p75: endings[Math.floor(runs * 0.75)],
    p90: endings[Math.floor(runs * 0.90)],
    mean: endings.reduce((a, b) => a + b, 0) / runs,
    probability_of_loss: (endings.filter(e => e < startingCapital).length / runs) * 100,
    probability_double: (endings.filter(e => e >= startingCapital * 2).length / runs) * 100,
  };
}

export function reverseCalc(opts: {
  startingCapital: number; monthlyContribution: number; targetCapital: number; timeHorizonMonths: number;
}) {
  const { startingCapital, monthlyContribution, targetCapital, timeHorizonMonths } = opts;
  let low = 0, high = 1, mid = 0;

  for (let i = 0; i < 100; i++) {
    mid = (low + high) / 2;
    let capital = startingCapital;
    for (let m = 0; m < timeHorizonMonths; m++) capital = capital * (1 + mid) + monthlyContribution;
    if (capital < targetCapital) low = mid; else high = mid;
  }

  const requiredMonthlyPct = mid * 100;
  const requiredAnnualPct = ((1 + mid) ** 12 - 1) * 100;
  const isAchievable = requiredMonthlyPct < 20;

  return {
    required_monthly_pct: requiredMonthlyPct.toFixed(2),
    required_annual_pct: requiredAnnualPct.toFixed(1),
    is_achievable: isAchievable,
    verdict: isAchievable
      ? `Achievable — needs ${requiredMonthlyPct.toFixed(1)}%/mo`
      : `Aggressive — needs ${requiredMonthlyPct.toFixed(1)}%/mo. Extend timeline or increase contributions.`,
    suggested_strategies: getAvailableStrategies(startingCapital)
      .filter(s => s.avg_monthly_return * 100 >= requiredMonthlyPct * 0.8)
      .map(s => s.name),
  };
}

export function timeToGoal(opts: {
  startingCapital: number; monthlyContribution: number; targetCapital: number; riskTier?: string;
}) {
  const { startingCapital, monthlyContribution, targetCapital, riskTier = "moderate" } = opts;
  let capital = startingCapital;
  let months = 0;
  const maxMonths = 600;

  while (capital < targetCapital && months < maxMonths) {
    const rate = calcBlendedReturnLocal(capital, riskTier);
    capital = capital * (1 + rate) + monthlyContribution;
    months++;
  }

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  return {
    months, years, remaining_months: remainingMonths,
    label: years > 0 ? `${years}y ${remainingMonths}m` : `${months} months`,
    final_capital: Math.round(capital),
    achievable: months < maxMonths,
  };
}
