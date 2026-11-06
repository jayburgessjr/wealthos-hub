// Single source of truth for risk limits. Changing these is an ADR-level decision.
export const RISK_LIMITS = {
  MAX_RISK_PER_TRADE: 0.015,
  MAX_POSITION_PCT: 0.25,
  MAX_OPEN_OPTIONS_POSITIONS: 3,
  DAILY_LOSS_LIMIT: 0.03,
  DRAWDOWN_KILL: 0.1,
  DEFAULT_SLIPPAGE_BPS: 10,
  OPTION_MULTIPLIER: 100,
} as const;

export type RiskLimits = { -readonly [K in keyof typeof RISK_LIMITS]: number };
