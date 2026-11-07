// Cron: settle orders stuck in submitting / submitted / partially_filled. Read-only toward the broker (getOrder by client
// order id); it never submits or cancels. Positions are recorded once per order and a proposal becomes 'executed' only on a real fill.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { makeReadOnlyBroker } from "../_shared/desk/broker/readonly.ts";
import { resolveMode } from "../_shared/desk/mode.ts";
import { DbPaperStore } from "../_shared/desk/pipeline/paper-store.ts";
import { reconcileOrders } from "../_shared/desk/pipeline/reconcile.ts";
import { SupabaseRepo } from "../_shared/desk/pipeline/supabase-repo.ts";
import { adminClient, getEnv, json, optionsResponse, requireCron } from "../_shared/desk-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  const gate = requireCron(req);
  if (gate !== true) return gate;
  try {
    const admin = adminClient();
    const mode = resolveMode({ TRADING_MODE: getEnv("TRADING_MODE"), LIVE_TRADING_ENABLED: getEnv("LIVE_TRADING_ENABLED") });
    const alpaca = getEnv("ALPACA_KEY_ID") && getEnv("ALPACA_SECRET") ? { keyId: getEnv("ALPACA_KEY_ID"), secret: getEnv("ALPACA_SECRET") } : undefined;
    const broker = makeReadOnlyBroker(mode, { paperStore: new DbPaperStore(admin, Number(getEnv("PAPER_STARTING_EQUITY")) || 100_000), alpaca, paperVenue: getEnv("PAPER_VENUE") === "alpaca" ? "alpaca" : "internal" });
    const result = await reconcileOrders({ repo: new SupabaseRepo(admin), broker, now: new Date() });
    return json(req, { ok: true, ...result });
  } catch (e) {
    console.error("desk-reconcile-orders failed", (e as Error).message);
    return json(req, { ok: false, error: "Reconcile job failed." }, 500);
  }
});
