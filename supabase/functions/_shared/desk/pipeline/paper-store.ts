// DB-backed ledger for the internal paper broker (Deno only). Reads filled paper orders from desk_orders;
// the approve flow writes fills there, so no append is needed here.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import type { LedgerFill, PaperLedger, PaperStore } from "../broker/paper.ts";

const OPTION = new Set(["long_call", "long_put", "debit_spread", "credit_spread", "iron_condor", "iron_butterfly"]);

export class DbPaperStore implements PaperStore {
  constructor(private admin: SupabaseClient, private startingCash: number) {}

  async load(): Promise<PaperLedger> {
    const { data, error } = await this.admin
      .from("desk_orders")
      .select("client_order_id, broker_order_id, structure, side, filled_qty, avg_fill_price, desk_instruments(symbol)")
      .eq("mode", "paper").eq("broker", "paper").in("status", ["filled", "partially_filled"]).gt("filled_qty", 0)
      .order("created_at", { ascending: true }).limit(5000);
    if (error) throw new Error(`paper ledger: ${error.message}`);
    const fills: LedgerFill[] = (data ?? []).map((raw) => {
      const r = raw as Record<string, unknown>;
      const symbol = String((r.desk_instruments as Record<string, unknown> | null)?.symbol ?? "?");
      const option = OPTION.has(String(r.structure));
      return {
        clientOrderId: String(r.client_order_id), brokerOrderId: String(r.broker_order_id ?? ""), symbol, side: r.side as "buy" | "sell",
        qty: Number(r.filled_qty), price: Number(r.avg_fill_price), multiplier: option ? 100 : 1, key: option ? `${symbol}#${r.client_order_id}` : symbol,
      };
    });

    const marks: Record<string, number> = {};
    const pos = await this.admin.from("desk_positions").select("mark_price, structure, desk_instruments(symbol)").eq("status", "open").eq("mode", "paper").not("mark_price", "is", null);
    for (const raw of pos.data ?? []) {
      const r = raw as Record<string, unknown>;
      if (!OPTION.has(String(r.structure))) marks[String((r.desk_instruments as Record<string, unknown> | null)?.symbol)] = Number(r.mark_price);
    }
    return { startingCash: this.startingCash, fills, marks };
  }
}
