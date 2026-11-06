// Cron or owner: score signals, theses and executed trades at 1, 5 and 20 trading days against SPY. Idempotent and immutable.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { PolygonMarket } from "../_shared/desk/pipeline/market.ts";
import { runScorecard } from "../_shared/desk/pipeline/scorejob.ts";
import { SupabaseRepo } from "../_shared/desk/pipeline/supabase-repo.ts";
import { adminClient, getEnv, json, optionsResponse, requireCron, requireOwner } from "../_shared/desk-auth.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);
  // Cron secret first; otherwise the owner's session.
  if (req.headers.get("x-cron-secret")) {
    const gate = requireCron(req);
    if (gate !== true) return gate;
  } else {
    const ctx = await requireOwner(req);
    if (ctx instanceof Response) return ctx;
  }
  try {
    const out = await runScorecard({ repo: new SupabaseRepo(adminClient()), market: new PolygonMarket(getEnv("POLYGON_KEY")), now: new Date() });
    return json(req, { ok: true, ...out });
  } catch (e) {
    console.error("desk-scorecard failed", (e as Error).message);
    return json(req, { ok: false, error: "Scorecard job failed." }, 500);
  }
});
