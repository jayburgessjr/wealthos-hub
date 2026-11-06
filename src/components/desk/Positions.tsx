import { useMemo } from "react";
import { useAccount, useInstruments, useOpenPositions } from "@/lib/desk/hooks";
import { price, pnlClass, qtyText, signedMoney, toNum } from "@/lib/desk/format";
import { NUM, Panel, PanelState } from "./Panel";
import { cn } from "@/lib/utils";

const LINEAR = new Set(["stock", "crypto"]);

export function Positions() {
  const positions = useOpenPositions();
  const instruments = useInstruments();
  const account = useAccount();

  const { rows, total } = useMemo(() => {
    const sym = new Map((instruments.data ?? []).map((i) => [i.id, i.symbol]));
    let sum = 0;
    let any = false;
    const out = (positions.data ?? []).map((p) => {
      const symbol = sym.get(p.instrument_id) ?? "?";
      const mark = p.mark_price !== null ? toNum(p.mark_price) : (account.data?.quotes?.[symbol] ?? NaN);
      // Option marks are premium per share for multi-leg structures; no P&L is shown for them rather than guessing.
      const pnl = LINEAR.has(p.structure) && Number.isFinite(mark) ? (mark - toNum(p.avg_price)) * toNum(p.qty) : NaN;
      if (Number.isFinite(pnl)) {
        sum += pnl;
        any = true;
      }
      return { p, symbol, mark, pnl };
    });
    return { rows: out, total: any ? sum : NaN };
  }, [positions.data, instruments.data, account.data]);

  return (
    <Panel
      title="Positions"
      aside={<span className={cn(NUM, "text-xs", pnlClass(total))}>{Number.isFinite(total) ? signedMoney(total) : ""}</span>}
    >
      <PanelState
        isLoading={positions.isLoading || instruments.isLoading}
        error={(positions.error ?? instruments.error) as Error | null}
        onRetry={() => {
          positions.refetch();
          instruments.refetch();
        }}
        isEmpty={rows.length === 0}
        empty="Open positions appear here after you approve an order and it fills."
      >
        <table className="w-full text-left">
          <thead className="text-[10px] uppercase text-white/60">
            <tr>
              <th scope="col" className="px-3 py-1 font-medium">Symbol</th>
              <th scope="col" className="px-2 py-1 font-medium">Type</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Qty</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Avg</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Mark</th>
              <th scope="col" className="px-2 py-1 text-right font-medium">Stop</th>
              <th scope="col" className="px-3 py-1 text-right font-medium">P&amp;L</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, symbol, mark, pnl }) => (
              <tr key={p.id} className="border-t border-white/10">
                <td className={cn(NUM, "px-3 py-1 font-semibold text-white")}>{symbol}</td>
                <td className="px-2 py-1 text-white/70">{p.structure.replace(/_/g, " ")}</td>
                <td className={cn(NUM, "px-2 py-1 text-right text-white/80")}>{qtyText(p.qty)}</td>
                <td className={cn(NUM, "px-2 py-1 text-right text-white/80")}>{price(p.avg_price)}</td>
                <td className={cn(NUM, "px-2 py-1 text-right text-white/80")}>{Number.isFinite(mark) ? price(mark) : "n/a"}</td>
                <td className={cn(NUM, "px-2 py-1 text-right text-white/80")}>{price(p.stop_price)}</td>
                <td className={cn(NUM, "px-3 py-1 text-right", pnlClass(pnl))}>{Number.isFinite(pnl) ? signedMoney(pnl) : "n/a"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </PanelState>
    </Panel>
  );
}
