// The ONLY function that can place an order. Order of operations is in _shared/desk/pipeline/approve.ts.
// The client sends an id, a decision and (live only) a confirmation phrase. Everything else is read server side.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { makeBroker, resolveMode } from "../_shared/desk/broker/factory.ts";
import { DbPaperStore } from "../_shared/desk/pipeline/paper-store.ts";
import { approveOrder } from "../_shared/desk/pipeline/approve.ts";
import { PolygonMarket } from "../_shared/desk/pipeline/market.ts";
import { SupabaseRepo } from "../_shared/desk/pipeline/supabase-repo.ts";
import { getEnv, json, optionsResponse, readJson, requireOwner } from "../_shared/desk-auth.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);

  const ctx = await requireOwner(req);
  if (ctx instanceof Response) return ctx;

  const body = await readJson<{ proposed_order_id?: unknown; decision?: unknown; live_confirmation?: unknown }>(req);
  if (!body || typeof body.proposed_order_id !== "string" || !UUID.test(body.proposed_order_id) || (body.decision !== "approved" && body.decision !== "rejected")) {
    return json(req, { ok: false, error: "Expected { proposed_order_id, decision: 'approved' | 'rejected' }" }, 400);
  }
  const liveConfirmation = typeof body.live_confirmation === "string" ? body.live_confirmation.slice(0, 120) : undefined;

  try {
    const mode = resolveMode({ TRADING_MODE: getEnv("TRADING_MODE"), LIVE_TRADING_ENABLED: getEnv("LIVE_TRADING_ENABLED") });
    const market = new PolygonMarket(getEnv("POLYGON_KEY"));
    // Phase 0 prices from the latest daily close. Live trading must switch to a real-time quote before LIVE_TRADING_ENABLED is ever set.
    const quote = async (symbol: string) => (await market.bars(symbol, 3)).at(-1)?.close ?? null;
    const alpaca = getEnv("ALPACA_KEY_ID") && getEnv("ALPACA_SECRET") ? { keyId: getEnv("ALPACA_KEY_ID"), secret: getEnv("ALPACA_SECRET") } : undefined;
    const broker = makeBroker(mode, {
      paperStore: new DbPaperStore(ctx.admin, Number(getEnv("PAPER_STARTING_EQUITY")) || 100_000),
      quote,
      alpaca,
      paperVenue: getEnv("PAPER_VENUE") === "alpaca" ? "alpaca" : "internal",
      alpacaExecutionEnabled: getEnv("ALPACA_EXECUTION_ENABLED") === "true",
    });

    const result = await approveOrder(
      { repo: new SupabaseRepo(ctx.admin, ctx.user), broker, mode, ownerId: ctx.userId, now: () => new Date(), quote },
      { proposedOrderId: body.proposed_order_id, decision: body.decision, liveConfirmation },
    );
    return json(req, result, result.ok || result.decision === "blocked" ? 200 : 502);
  } catch (e) {
    console.error("desk-approve-order failed", (e as Error).message);
    return json(req, { ok: false, decision: "blocked", error: "Approval failed. Nothing was placed unless an order id is shown." }, 500);
  }
});
