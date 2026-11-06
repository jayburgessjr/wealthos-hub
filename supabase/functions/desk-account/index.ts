// Read-only account view for the terminal: broker account, positions, desk state, quotes and the fixed risk limits.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { makeReadOnlyBroker } from "../_shared/desk/broker/readonly.ts";
import { resolveMode } from "../_shared/desk/broker/factory.ts";
import { DbPaperStore } from "../_shared/desk/pipeline/paper-store.ts";
import { PolygonMarket } from "../_shared/desk/pipeline/market.ts";
import { RISK_LIMITS } from "../_shared/desk/risk/limits.ts";
import { getEnv, json, optionsResponse, requireOwner } from "../_shared/desk-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  const ctx = await requireOwner(req);
  if (ctx instanceof Response) return ctx;

  try {
    const mode = resolveMode({ TRADING_MODE: getEnv("TRADING_MODE"), LIVE_TRADING_ENABLED: getEnv("LIVE_TRADING_ENABLED") });
    const alpaca = getEnv("ALPACA_KEY_ID") && getEnv("ALPACA_SECRET") ? { keyId: getEnv("ALPACA_KEY_ID"), secret: getEnv("ALPACA_SECRET") } : undefined;
    const broker = makeReadOnlyBroker(mode, { paperStore: new DbPaperStore(ctx.admin, Number(getEnv("PAPER_STARTING_EQUITY")) || 100_000), alpaca, paperVenue: getEnv("PAPER_VENUE") === "alpaca" ? "alpaca" : "internal" });
    const [account, positions, state, pending, open, watch] = await Promise.all([
      broker.getAccount(),
      broker.getPositions(),
      ctx.user.from("desk_state").select("halted, halted_reason, halted_at, high_water_mark, day_start_equity, last_equity").eq("id", true).maybeSingle(),
      ctx.user.from("desk_proposed_orders").select("desk_instruments(symbol)").eq("status", "pending").limit(50),
      ctx.user.from("desk_positions").select("desk_instruments(symbol)").eq("status", "open").limit(50),
      ctx.user.from("desk_instruments").select("symbol").eq("on_watchlist", true).limit(50),
    ]);

    const symbols = new Set<string>(positions.map((p) => p.symbol));
    for (const r of [...(pending.data ?? []), ...(open.data ?? [])]) {
      const s = (r as { desk_instruments?: { symbol?: string } | null }).desk_instruments?.symbol;
      if (s) symbols.add(s);
    }
    for (const r of watch.data ?? []) symbols.add(String((r as { symbol: string }).symbol));

    const market = new PolygonMarket(getEnv("POLYGON_KEY"));
    const quotes: Record<string, number> = {};
    await Promise.all([...symbols].slice(0, 40).map(async (s) => {
      try { const last = (await market.bars(s, 3)).at(-1); if (last) quotes[s] = last.close; } catch { /* a missing quote leaves the symbol out; the UI fails closed */ }
    }));

    return json(req, { ok: true, mode, broker: broker.name, account, positions, state: state.data ?? null, quotes, limits: RISK_LIMITS });
  } catch (e) {
    console.error("desk-account failed", (e as Error).message);
    return json(req, { ok: false, error: "Account data is unavailable right now." }, 502);
  }
});
