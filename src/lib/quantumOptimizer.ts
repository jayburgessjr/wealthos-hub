// ── Quantum-inspired portfolio optimizer ─────────────────────────────────────
// Classical math with quantum branding (as in Stratford Wealth).
// Algorithms: Monte Carlo simulation + Simulated Annealing.
// Zero external dependencies — pure TypeScript.

export interface AssetInput {
  symbol: string;
  price: number;
  changePct: number; // 24h % change, used as volatility proxy
  assetClass: "equity" | "crypto" | "commodity" | "bond" | "alternative";
}

export interface AllocationSlice {
  symbol: string;
  assetClass: string;
  weight: number;       // 0–1
  percentage: number;   // 0–100
  dollarAmount: number;
  reasoning: string;
}

export interface QuantumResult {
  allocation: AllocationSlice[];
  riskScore: number;           // 1–10
  expectedReturn: number;      // annualised %
  portfolioVariance: number;
  sharpeRatio: number;
  maxDrawdownEst: number;      // %
  var95: number;               // Value at Risk 95%, %
  cvar95: number;              // Conditional VaR 95%, %
  monteCarloRuns: number;
  iterations: number;
  agentSummary: string;
  log: string[];
}

// ── Box-Muller Gaussian sample ─────────────────────────────────────────────
function gaussianRandom(mu = 0, sigma = 1): number {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// ── Step 1: Monte Carlo simulation → estimate mu & covariance ──────────────
function performMonteCarloSimulation(
  assets: AssetInput[],
  runs = 2000,
): { mu: number[]; sigma: number[][] } {
  const n = assets.length;
  // infer daily vol from 24h change (rough proxy — improves with real OHLCV)
  const vols = assets.map(a => Math.abs(a.changePct / 100) || 0.01);
  const mus  = assets.map(a => (a.changePct / 100) * 252); // annualise daily drift

  // Run Monte Carlo paths
  const returns: number[][] = Array.from({ length: n }, () => []);
  for (let r = 0; r < runs; r++) {
    for (let i = 0; i < n; i++) {
      const dailyReturn = gaussianRandom(mus[i] / 252, vols[i]);
      returns[i].push(dailyReturn);
    }
  }

  // Sample means
  const mu = returns.map(rs => rs.reduce((s, v) => s + v, 0) / runs * 252);

  // Sample covariance matrix
  const sigma: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      let cov = 0;
      for (let r = 0; r < runs; r++) {
        cov += (returns[i][r] - mu[i] / 252) * (returns[j][r] - mu[j] / 252);
      }
      sigma[i][j] = (cov / (runs - 1)) * 252;
    }
  }

  return { mu, sigma };
}

// ── Portfolio utility (negative energy for minimization) ──────────────────
function portfolioUtility(
  weights: number[],
  mu: number[],
  sigma: number[][],
  lambda: number,
): number {
  const n = weights.length;
  let ret = 0;
  for (let i = 0; i < n; i++) ret += weights[i] * mu[i];

  let variance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      variance += weights[i] * weights[j] * sigma[i][j];
    }
  }

  return ret - lambda * variance; // maximise
}

// ── Step 2: Simulated Annealing optimiser ─────────────────────────────────
function runSimulatedAnnealing(
  mu: number[],
  sigma: number[][],
  riskAversion: number, // 1–10 (10 = max risk averse)
  numAssets: number,
  iterations = 1000,
): number[] {
  const lambda = (11 - riskAversion) / 10;
  let weights = Array(numAssets).fill(1 / numAssets);
  let bestWeights = [...weights];
  let bestScore = portfolioUtility(weights, mu, sigma, lambda);
  let temperature = 1.0;

  for (let iter = 0; iter < iterations; iter++) {
    // Randomly transfer weight between two assets
    const candidate = [...weights];
    const i = Math.floor(Math.random() * numAssets);
    let j = Math.floor(Math.random() * numAssets);
    while (j === i) j = Math.floor(Math.random() * numAssets);

    const transfer = Math.random() * Math.min(candidate[i], 0.2);
    candidate[i] -= transfer;
    candidate[j] += transfer;

    // Re-normalise
    const sum = candidate.reduce((s, v) => s + v, 0);
    for (let k = 0; k < numAssets; k++) candidate[k] /= sum;

    const score = portfolioUtility(candidate, mu, sigma, lambda);
    const delta = score - portfolioUtility(weights, mu, sigma, lambda);

    // Accept if better, or probabilistically if worse (Boltzmann)
    if (delta > 0 || Math.random() < Math.exp(delta / temperature)) {
      weights = candidate;
      if (score > bestScore) { bestScore = score; bestWeights = [...candidate]; }
    }

    temperature *= 0.995;
  }

  return bestWeights;
}

// ── Step 3: VaR / CVaR via parametric normal ────────────────────────────
function computeRiskMetrics(
  weights: number[],
  mu: number[],
  sigma: number[][],
  capital: number,
): { var95: number; cvar95: number; maxDrawdownEst: number; sharpe: number; variance: number; expectedReturn: number } {
  const n = weights.length;
  let portfolioReturn = 0;
  for (let i = 0; i < n; i++) portfolioReturn += weights[i] * mu[i];

  let portfolioVariance = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      portfolioVariance += weights[i] * weights[j] * sigma[i][j];
    }
  }

  const portfolioVol = Math.sqrt(Math.max(portfolioVariance, 0));
  // z-score for 95% VaR ≈ 1.645
  const var95 = Math.abs(portfolioReturn - 1.645 * portfolioVol) * 100;
  // CVaR 95% ≈ mu - sigma * phi(z) / (1 - 0.95) where phi(1.645) ≈ 0.103
  const cvar95 = Math.abs(portfolioReturn - portfolioVol * (0.103 / 0.05)) * 100;
  // Rough max drawdown estimate: 2× annual vol
  const maxDrawdownEst = portfolioVol * 2 * 100;
  const riskFreeRate = 0.05; // 5% risk-free
  const sharpe = portfolioVol > 0 ? (portfolioReturn - riskFreeRate) / portfolioVol : 0;

  return {
    expectedReturn: portfolioReturn * 100,
    variance: portfolioVariance,
    sharpe,
    var95,
    cvar95,
    maxDrawdownEst,
  };
}

// ── Reasoning generator ────────────────────────────────────────────────────
function generateReasoning(
  asset: AssetInput,
  weight: number,
  mu: number,
  riskTolerance: number,
): string {
  const dir = asset.changePct >= 0 ? "positive" : "negative";
  const adjective = weight > 0.25 ? "overweight" : weight > 0.15 ? "neutral" : "underweight";
  return `${adjective.charAt(0).toUpperCase() + adjective.slice(1)} position. ` +
    `${asset.symbol} shows ${dir} 24h momentum (${asset.changePct.toFixed(2)}%). ` +
    `Expected annualised return: ${(mu * 100).toFixed(1)}%. ` +
    (riskTolerance <= 4 ? "Conservative weighting applied per risk profile." : "");
}

// ── Main entry point ───────────────────────────────────────────────────────
export function optimizePortfolio(
  assets: AssetInput[],
  capital: number,
  riskTolerance: number, // 1–10
  monteCarloRuns = 2000,
  saIterations = 1000,
): QuantumResult {
  const log: string[] = [];
  const n = assets.length;

  log.push(`[QE] Initialising with ${n} assets, capital $${capital.toLocaleString()}, risk ${riskTolerance}/10`);
  log.push(`[MC] Running ${monteCarloRuns} Monte Carlo paths…`);

  const { mu, sigma } = performMonteCarloSimulation(assets, monteCarloRuns);

  log.push(`[MC] Complete. Estimated returns: [${mu.map(m => (m * 100).toFixed(1) + "%").join(", ")}]`);
  log.push(`[SA] Running Simulated Annealing (${saIterations} iterations)…`);

  const weights = runSimulatedAnnealing(mu, sigma, riskTolerance, n, saIterations);

  log.push(`[SA] Converged. Optimal weights: [${weights.map(w => (w * 100).toFixed(1) + "%").join(", ")}]`);

  const metrics = computeRiskMetrics(weights, mu, sigma, capital);

  log.push(`[RM] Expected return: ${metrics.expectedReturn.toFixed(2)}%  Sharpe: ${metrics.sharpe.toFixed(3)}`);
  log.push(`[RM] VaR 95%: ${metrics.var95.toFixed(2)}%  CVaR 95%: ${metrics.cvar95.toFixed(2)}%`);
  log.push(`[QE] Optimisation complete.`);

  const allocation: AllocationSlice[] = assets.map((asset, i) => ({
    symbol: asset.symbol,
    assetClass: asset.assetClass,
    weight: weights[i],
    percentage: weights[i] * 100,
    dollarAmount: weights[i] * capital,
    reasoning: generateReasoning(asset, weights[i], mu[i], riskTolerance),
  })).sort((a, b) => b.weight - a.weight);

  const agentSummary = `Quantum engine recommends a ${riskTolerance <= 3 ? "conservative" : riskTolerance <= 6 ? "balanced" : "aggressive"} allocation across ${n} assets. ` +
    `Projected annual return of ${metrics.expectedReturn.toFixed(1)}% with a Sharpe ratio of ${metrics.sharpe.toFixed(2)}. ` +
    `At the 95% confidence level, maximum single-year loss is estimated at ${metrics.var95.toFixed(1)}% (VaR) or ${metrics.cvar95.toFixed(1)}% in tail scenarios (CVaR). ` +
    `Top holding: ${allocation[0]?.symbol} at ${allocation[0]?.percentage.toFixed(1)}%.`;

  return {
    allocation,
    riskScore: riskTolerance,
    expectedReturn: metrics.expectedReturn,
    portfolioVariance: metrics.variance,
    sharpeRatio: metrics.sharpe,
    maxDrawdownEst: metrics.maxDrawdownEst,
    var95: metrics.var95,
    cvar95: metrics.cvar95,
    monteCarloRuns,
    iterations: saIterations,
    agentSummary,
    log,
  };
}
