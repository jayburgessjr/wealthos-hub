// Deterministic risk engine. Pure: no clock, no randomness, no I/O. Invalid input fails closed.
import { RISK_LIMITS, type RiskLimits } from "./limits.ts";
import { analyseOption, CREDIT_STRUCTURES, isOptionStructure } from "./options.ts";
import type { ProposedOrder } from "../types.ts";

export const ENGINE_VERSION = "risk-1.0.0";

export interface OpenPositionSnapshot {
  positionId?: string;
  positionGroup: string;
  symbol: string;
  underlying: string;
  structure: ProposedOrder["structure"];
  qty: number;
  exposure: number;
  maxLoss: number;
}

export interface RiskInput {
  order: ProposedOrder;
  /** Server-fetched quote (stock/crypto price, or option net premium per share). Never client supplied. */
  refPrice: number;
  equity: number;
  dayStartEquity: number;
  highWaterMark: number;
  halted: boolean;
  openPositions: OpenPositionSnapshot[];
  slippageBps?: number;
  /** Tests only. Production passes undefined. */
  limits?: Partial<RiskLimits>;
}

export interface RiskCheck {
  rule: string;
  passed: boolean;
  value: number | string;
  limit: number | string;
  message: string;
}

export interface RiskDecision {
  approved: boolean;
  reasons: string[];
  checks: RiskCheck[];
  sized: { maxQty: number; riskAmount: number; exposure: number; maxLoss: number };
  effects: { tripKillSwitch: boolean; newHighWaterMark: number; dailyLimitHit: boolean };
  engineVersion: string;
}

const fin = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const pos = (n: unknown): n is number => fin(n) && n > 0;
const EPS = 1e-9;
const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function reject(reason: string, hwm: number): RiskDecision {
  return {
    approved: false,
    reasons: [reason],
    checks: [{ rule: "invalid_input", passed: false, value: "invalid", limit: "valid", message: reason }],
    sized: { maxQty: 0, riskAmount: 0, exposure: 0, maxLoss: 0 },
    effects: { tripKillSwitch: false, newHighWaterMark: fin(hwm) ? hwm : 0, dailyLimitHit: false },
    engineVersion: ENGINE_VERSION,
  };
}

function finish(checks: RiskCheck[], sized: RiskDecision["sized"], effects: RiskDecision["effects"]): RiskDecision {
  const failed = checks.filter((c) => !c.passed);
  return { approved: failed.length === 0, reasons: failed.map((c) => `${c.rule}: ${c.message}`), checks, sized, effects, engineVersion: ENGINE_VERSION };
}

export function evaluateRisk(input: RiskInput): RiskDecision {
  const L = { ...RISK_LIMITS, ...(input.limits ?? {}) } as RiskLimits;
  const o = input.order;
  if (!o || !pos(o.qty) || typeof o.symbol !== "string" || !o.symbol) return reject("invalid_input: order missing symbol or positive qty", input.highWaterMark);
  if (!pos(input.equity) || !pos(input.dayStartEquity) || !pos(input.highWaterMark)) return reject("invalid_input: equity, day-start equity or high-water mark is not positive", input.highWaterMark);
  if (!pos(input.refPrice)) return reject("invalid_input: no usable reference price", input.highWaterMark);
  if (o.side !== "buy" && o.side !== "sell") return reject("invalid_input: side", input.highWaterMark);

  const checks: RiskCheck[] = [];
  const add = (rule: string, passed: boolean, value: number | string, limit: number | string, message: string) =>
    checks.push({ rule, passed, value, limit, message });

  const equity = input.equity;
  const newHWM = Math.max(input.highWaterMark, equity);
  const drawdown = (input.highWaterMark - equity) / input.highWaterMark;
  const dayPnl = equity - input.dayStartEquity;
  const dayPnlPct = dayPnl / input.dayStartEquity;
  const bps = fin(input.slippageBps) ? input.slippageBps : L.DEFAULT_SLIPPAGE_BPS;
  const riskBudget = L.MAX_RISK_PER_TRADE * equity;

  const isOption = isOptionStructure(o.structure);
  let tripKillSwitch = false;
  let sized = { maxQty: 0, riskAmount: 0, exposure: 0, maxLoss: 0 };

  // ---- mandatory stop (every order, open or close) ----
  const stopOk = pos(o.stopPrice);
  add(
    "mandatory_stop",
    stopOk,
    stopOk ? (o.stopPrice as number) : "missing",
    "finite > 0",
    stopOk ? "Stop present." : "Every order needs a stop price. None (or an invalid one) was supplied.",
  );

  if (o.intent === "close") {
    const p = input.openPositions.find((x) => x.positionId && x.positionId === o.positionId);
    add(
      "close_valid",
      !!p && o.qty <= p.qty + EPS,
      p ? o.qty : "no position",
      p ? p.qty : "open position",
      p ? "Close quantity within open quantity." : "Close order must reference an open position.",
    );
    return finish(checks, sized, { tripKillSwitch, newHighWaterMark: newHWM, dailyLimitHit: false });
  }

  // ---- kill switch ----
  add("kill_switch", !input.halted, input.halted ? "engaged" : "clear", "clear", input.halted ? "Kill switch is engaged. New orders are halted until the owner resets it." : "Kill switch clear.");
  const ddHit = drawdown >= L.DRAWDOWN_KILL - EPS;
  if (ddHit) tripKillSwitch = true;
  add("drawdown_kill", !ddHit, pct(Math.max(0, drawdown)), pct(L.DRAWDOWN_KILL), ddHit ? `Drawdown ${pct(drawdown)} reached the ${pct(L.DRAWDOWN_KILL)} kill-switch limit.` : "Drawdown within limit.");

  let entryRef = input.refPrice;
  if (o.orderType === "limit" && pos(o.limitPrice)) entryRef = Math.max(o.limitPrice, input.refPrice);

  if (!isOption) {
    if (o.structure !== "stock" && o.structure !== "crypto") add("structure", false, o.structure, "stock|crypto|defined-risk option", "Unknown structure.");
    add("long_only", o.side === "buy", o.side, "buy", o.side === "buy" ? "Long entry." : "Short selling is not allowed in phase 0.");
    if (stopOk) add("stop_side", (o.stopPrice as number) < entryRef, o.stopPrice as number, `< ${entryRef}`, "Stop must sit below entry for a long.");
    const effEntry = entryRef * (1 + bps / 10_000);
    const riskPerUnit = effEntry - (stopOk ? (o.stopPrice as number) : effEntry);
    const fractional = o.structure === "crypto";
    const round = (x: number) => (fractional ? Math.floor(x * 1e4 + EPS) / 1e4 : Math.floor(x + EPS));
    const maxQtyRisk = riskPerUnit > 0 ? round(riskBudget / riskPerUnit) : 0;
    const maxQtyPos = round((L.MAX_POSITION_PCT * equity) / effEntry);
    const maxQty = Math.min(maxQtyRisk, maxQtyPos);
    const riskAmount = o.qty * Math.max(0, riskPerUnit);
    const exposure = o.qty * effEntry;
    sized = { maxQty, riskAmount, exposure, maxLoss: riskAmount };
    add(
      "risk_per_trade",
      stopOk && maxQty > 0 && riskAmount <= riskBudget + EPS,
      pct(riskAmount / equity),
      pct(L.MAX_RISK_PER_TRADE),
      `Risk ${pct(riskAmount / equity)} of equity against a ${pct(L.MAX_RISK_PER_TRADE)} cap.`,
    );
    const sameUnderlying = input.openPositions.filter((p) => p.underlying === o.symbol).reduce((s, p) => s + p.exposure, 0);
    const posPct = (sameUnderlying + exposure) / equity;
    add("position_cap", posPct <= L.MAX_POSITION_PCT + EPS, pct(posPct), pct(L.MAX_POSITION_PCT), `Position would be ${pct(posPct)} of equity.`);
  } else {
    const a = analyseOption(o.structure, o.legs);
    add("defined_risk", a.ok, a.ok ? "defined" : (a.reason ?? "undefined"), "defined risk only", a.ok ? "Structure is defined-risk." : `Rejected: ${a.reason}.`);
    const credit = CREDIT_STRUCTURES.includes(o.structure);
    const wantSide = credit ? "sell" : "buy";
    add("order_side", o.side === wantSide, o.side, wantSide, "Order side must match the structure's debit or credit.");
    if (a.ok) {
      const maxLoss = a.maxLossPerContract * o.qty;
      const maxContracts = Math.floor(riskBudget / a.maxLossPerContract + EPS);
      sized = { maxQty: maxContracts, riskAmount: maxLoss, exposure: maxLoss, maxLoss };
      add("risk_per_trade", maxContracts >= 1 && maxLoss <= riskBudget + EPS, pct(maxLoss / equity), pct(L.MAX_RISK_PER_TRADE), `Max loss ${pct(maxLoss / equity)} of equity against a ${pct(L.MAX_RISK_PER_TRADE)} cap.`);
      if (stopOk) {
        const net = Math.abs(a.netPremium);
        const sideOk = credit ? (o.stopPrice as number) > net : (o.stopPrice as number) < net;
        add("stop_side", sideOk, o.stopPrice as number, credit ? `> ${net}` : `< ${net}`, "Premium stop must sit on the loss side of the net premium.");
      }
      const sameUnderlying = input.openPositions.filter((p) => p.underlying === o.symbol).reduce((s, p) => s + p.exposure, 0);
      const posPct = (sameUnderlying + maxLoss) / equity;
      add("position_cap", posPct <= L.MAX_POSITION_PCT + EPS, pct(posPct), pct(L.MAX_POSITION_PCT), `Exposure would be ${pct(posPct)} of equity.`);
      const groups = new Set(input.openPositions.filter((p) => isOptionStructure(p.structure)).map((p) => p.positionGroup));
      const adding = !!o.positionGroup && groups.has(o.positionGroup);
      const count = groups.size + (adding ? 0 : 1);
      add("options_count", count <= L.MAX_OPEN_OPTIONS_POSITIONS, count, L.MAX_OPEN_OPTIONS_POSITIONS, `Would hold ${count} options positions.`);
    }
  }

  // ---- daily loss: realised so far, and projected with this trade's worst case ----
  const projected = (dayPnl - sized.maxLoss) / input.dayStartEquity;
  const dayHit = dayPnlPct <= -L.DAILY_LOSS_LIMIT + EPS;
  const projHit = projected < -L.DAILY_LOSS_LIMIT - EPS;
  add(
    "daily_loss",
    !dayHit && !projHit,
    pct(dayPnlPct),
    `-${pct(L.DAILY_LOSS_LIMIT)}`,
    dayHit ? `Day P&L ${pct(dayPnlPct)} has reached the daily loss limit.` : projHit ? `Worst case for this trade would take the day to ${pct(projected)}.` : "Daily loss within limit.",
  );

  return finish(checks, sized, { tripKillSwitch, newHighWaterMark: newHWM, dailyLimitHit: dayHit });
}
