import { useMemo } from "react";
import { RISK_LIMITS } from "../../../supabase/functions/_shared/desk/risk/limits.ts";
import { useAccount, useOpenPositions } from "@/lib/desk/hooks";
import { pct, toNum } from "@/lib/desk/format";
import { NUM, MICRO, Panel, PanelState } from "./Panel";
import { cn } from "@/lib/utils";

const OPTION_STRUCTURES = new Set(["long_call", "long_put", "debit_spread", "credit_spread", "iron_condor", "iron_butterfly"]);

interface GaugeProps {
  label: string;
  value: number;
  limit: number;
  valueText: string;
  limitText: string;
}

export function Gauge({ label, value, limit, valueText, limitText }: GaugeProps) {
  const ratio = limit > 0 && Number.isFinite(value) ? Math.max(0, Math.min(1, value / limit)) : 0;
  const hot = ratio >= 0.8;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className={MICRO}>{label}</span>
        <span className={cn(NUM, "text-white/80")}>
          {valueText} <span className="text-white/50">/ {limitText}</span>
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        aria-valuetext={`${valueText} of ${limitText} limit`}
        className="mt-1 h-1.5 w-full bg-white/10"
      >
        <div className={cn("h-full", hot ? "bg-[hsl(20,82%,51%)]" : "bg-white/60")} style={{ width: `${ratio * 100}%` }} />
      </div>
    </div>
  );
}

export function RiskGauges() {
  const account = useAccount();
  const positions = useOpenPositions();

  const g = useMemo(() => {
    const a = account.data;
    if (!a) return null;
    const equity = a.account.equity;
    const open = (positions.data ?? []).filter((p) => p.status === "open");
    const maxLoss = Math.max(0, ...open.map((p) => toNum(p.max_loss)).filter(Number.isFinite));
    const maxExposure = Math.max(0, ...open.map((p) => toNum(p.exposure)).filter(Number.isFinite));
    const optionGroups = new Set(open.filter((p) => OPTION_STRUCTURES.has(p.structure)).map((p) => p.position_group));
    const dayLoss = a.state.day_start_equity > 0 ? Math.max(0, (a.state.day_start_equity - equity) / a.state.day_start_equity) : 0;
    const dd = a.state.high_water_mark > 0 ? Math.max(0, (a.state.high_water_mark - equity) / a.state.high_water_mark) : 0;
    return { equity, maxLoss, maxExposure, options: optionGroups.size, dayLoss, dd };
  }, [account.data, positions.data]);

  const L = RISK_LIMITS;

  return (
    <Panel title="Risk gauges">
      <PanelState
        isLoading={account.isLoading || positions.isLoading}
        error={(account.error ?? positions.error) as Error | null}
        onRetry={() => {
          account.refetch();
          positions.refetch();
        }}
        isEmpty={!g}
        empty="Risk usage appears here once account data loads."
      >
        {g && (
          <div className="grid gap-3 px-3 py-2">
            <Gauge label="Largest risk per trade" value={g.maxLoss / g.equity} limit={L.MAX_RISK_PER_TRADE} valueText={pct(g.maxLoss / g.equity)} limitText={pct(L.MAX_RISK_PER_TRADE)} />
            <Gauge label="Largest position" value={g.maxExposure / g.equity} limit={L.MAX_POSITION_PCT} valueText={pct(g.maxExposure / g.equity)} limitText={pct(L.MAX_POSITION_PCT)} />
            <Gauge label="Open options positions" value={g.options} limit={L.MAX_OPEN_OPTIONS_POSITIONS} valueText={String(g.options)} limitText={String(L.MAX_OPEN_OPTIONS_POSITIONS)} />
            <Gauge label="Daily loss" value={g.dayLoss} limit={L.DAILY_LOSS_LIMIT} valueText={pct(g.dayLoss)} limitText={pct(L.DAILY_LOSS_LIMIT)} />
            <Gauge label="Drawdown" value={g.dd} limit={L.DRAWDOWN_KILL} valueText={pct(g.dd)} limitText={pct(L.DRAWDOWN_KILL)} />
          </div>
        )}
      </PanelState>
    </Panel>
  );
}
