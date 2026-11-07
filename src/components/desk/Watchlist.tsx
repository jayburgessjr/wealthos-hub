import { useMemo } from "react";
import { useAccount, useInstruments, useSignals } from "@/lib/desk/hooks";
import { price, toNum } from "@/lib/desk/format";
import { NUM, Panel, PanelState } from "./Panel";
import { cn } from "@/lib/utils";

export function Watchlist() {
  const signals = useSignals();
  const instruments = useInstruments();
  const account = useAccount();

  const rows = useMemo(() => {
    const sym = new Map((instruments.data ?? []).map((i) => [i.id, i.symbol]));
    const seen = new Map<string, { symbol: string; direction: string; strength: number; agent: string }>();
    for (const s of signals.data ?? []) {
      if (seen.has(s.instrument_id)) continue; // signals are newest first
      const symbol = sym.get(s.instrument_id);
      if (symbol) seen.set(s.instrument_id, { symbol, direction: s.direction, strength: toNum(s.strength), agent: s.agent_name });
    }
    return [...seen.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
  }, [signals.data, instruments.data]);

  const loading = signals.isLoading || instruments.isLoading;
  const error = (signals.error ?? instruments.error) as Error | null;

  return (
    <Panel title="Watchlist">
      <PanelState
        isLoading={loading}
        error={error}
        onRetry={() => {
          signals.refetch();
          instruments.refetch();
        }}
        isEmpty={rows.length === 0}
        empty="Symbols appear here once an agent publishes a signal for them."
      >
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-1 font-medium">Symbol</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Last</th>
              <th scope="col" className="px-2 py-1 font-medium">Bias</th>
              <th scope="col" className="px-3 py-1 text-right font-medium">Str.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const q = account.data?.quotes?.[r.symbol];
              return (
                <tr key={r.symbol} className="border-t border-border">
                  <td className={cn(NUM, "px-3 py-1 font-semibold text-foreground")}>{r.symbol}</td>
                  <td className={cn(NUM, "px-2 py-1 text-right text-foreground/80")}>{typeof q === "number" ? price(q) : "n/a"}</td>
                  <td className="px-2 py-1 capitalize text-foreground/80">{r.direction}</td>
                  <td className={cn(NUM, "px-3 py-1 text-right text-foreground/80")}>{(r.strength * 100).toFixed(0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </PanelState>
    </Panel>
  );
}
