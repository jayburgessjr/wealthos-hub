// Cron: mark positions, roll the day, ratchet the high-water mark, trip the kill switch, propose (never place) exits.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { makeReadOnlyBroker } from "../_shared/desk/broker/readonly.ts";
import { resolveMode } from "../_shared/desk/broker/factory.ts";
import { markPositions } from "../_shared/desk/pipeline/mark.ts";
import { DbPaperStore } from "../_shared/desk/pipeline/paper-store.ts";
import { PolygonMarket } from "../_shared/desk/pipeline/market.ts";
import { SupabaseRepo } from "../_shared/desk/pipeline/supabase-repo.ts";
import { adminClient, getEnv, json, optionsResponse, requireCron } from "../_shared/desk-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  const gate = requireCron(req);
  if (gate !== true) return gate;
  try {
    const admin = adminClient();
    const repo = new SupabaseRepo(admin);
    const mode = resolveMode({ TRADING_MODE: getEnv("TRADING_MODE"), LIVE_TRADING_ENABLED: getEnv("LIVE_TRADING_ENABLED") });
    const alpaca = getEnv("ALPACA_KEY_ID") && getEnv("ALPACA_SECRET") ? { keyId: getEnv("ALPACA_KEY_ID"), secret: getEnv("ALPACA_SECRET") } : undefined;
    const broker = makeReadOnlyBroker(mode, { paperStore: new DbPaperStore(admin, Number(getEnv("PAPER_STARTING_EQUITY")) || 100_000), alpaca, paperVenue: getEnv("PAPER_VENUE") === "alpaca" ? "alpaca" : "internal" });
    const market = new PolygonMarket(getEnv("POLYGON_KEY"));

    const account = await broker.getAccount();
    const open = await repo.listOpenPositions();
    const quotes: Record<string, number> = {};
    for (const s of new Set(open.map((p) => p.symbol))) {
      try { const last = (await market.bars(s, 3)).at(-1); if (last) quotes[s] = last.close; } catch { /* skip this symbol */ }
    }
    const result = await markPositions({ repo, equity: account.equity, quotes, now: new Date() });
    return json(req, { ok: true, ...result });
  } catch (e) {
    console.error("desk-mark-positions failed", (e as Error).message);
    return json(req, { ok: false, error: "Mark job failed." }, 500);
  }
});
