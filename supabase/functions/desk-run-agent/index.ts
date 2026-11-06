// Runs one named agent: a scanner, or research ("research" for one signal_id, "research-new" for today's unresearched signals).
// Agents get an AgentRepo (no order, approval or position methods) and no broker. Cron secret or the owner's session.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { runResearch, runScanner, SCANNER_NAMES, type MarketData } from "../_shared/desk/pipeline/agents.ts";
import { OpenAiLlm } from "../_shared/desk/pipeline/llm.ts";
import { PolygonMarket } from "../_shared/desk/pipeline/market.ts";
import { asAgentRepo } from "../_shared/desk/pipeline/repo.ts";
import { SupabaseRepo } from "../_shared/desk/pipeline/supabase-repo.ts";
import { etDate } from "../_shared/desk/pipeline/time.ts";
import type { ScannerAgent } from "../_shared/desk/scanners.ts";
import { adminClient, getEnv, json, optionsResponse, readJson, requireCron, requireOwner } from "../_shared/desk-auth.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse(req);
  if (req.method !== "POST") return json(req, { ok: false, error: "Method not allowed" }, 405);

  let trigger: "cron" | "manual" = "cron";
  if (req.headers.get("x-cron-secret")) {
    const gate = requireCron(req);
    if (gate !== true) return gate;
  } else {
    const ctx = await requireOwner(req);
    if (ctx instanceof Response) return ctx;
    trigger = "manual";
  }

  const body = await readJson<{ agent?: unknown; signal_id?: unknown }>(req);
  const agent = typeof body?.agent === "string" ? body.agent : "";
  const today = etDate(new Date());
  const repo = new SupabaseRepo(adminClient());
  const agentRepo = asAgentRepo(repo); // agents never see order, approval or position methods
  const market: MarketData = new PolygonMarket(getEnv("POLYGON_KEY"), { secUserAgent: getEnv("SEC_USER_AGENT") || undefined });

  try {
    if ((SCANNER_NAMES as string[]).includes(agent)) {
      const r = await runScanner(agent as ScannerAgent, { repo: agentRepo, market, today, trigger });
      return json(req, { ok: true, run_id: r.runId, skipped: r.skipped, signals: r.signals, theses: 0, proposals: 0 });
    }

    if (agent === "research" || agent === "research-new") {
      const key = getEnv("OPENAI_API_KEY");
      if (!key) return json(req, { ok: false, error: "OPENAI_API_KEY is not configured." }, 503);
      const llm = new OpenAiLlm(key, { model: getEnv("DESK_MODEL") || undefined });
      const state = await repo.getState();
      const equity = state.lastEquity > 0 ? state.lastEquity : Number(getEnv("PAPER_STARTING_EQUITY")) || 100_000;

      let ids: string[] = [];
      if (agent === "research") {
        if (typeof body?.signal_id !== "string" || !UUID.test(body.signal_id)) return json(req, { ok: false, error: "signal_id required" }, 400);
        ids = [body.signal_id];
      } else {
        const [signals, theses] = await Promise.all([repo.listSignals(), repo.listTheses()]);
        const done = new Set(theses.flatMap((t) => t.signalIds));
        ids = signals.filter((s) => etDate(new Date(s.createdAt)) === today && !done.has(s.id) && (s.direction !== "neutral" || s.strength >= 0.5)).sort((a, b) => b.strength - a.strength).slice(0, 5).map((s) => s.id);
      }

      let theses = 0, proposals = 0;
      for (const id of ids) {
        const r = await runResearch(id, { repo: agentRepo, market, llm, equity, today, trigger });
        if (r.thesisId) theses++;
        if (r.proposalId) proposals++;
      }
      return json(req, { ok: true, run_id: null, signals: 0, theses, proposals });
    }

    return json(req, { ok: false, error: `Unknown agent. Use one of: ${[...SCANNER_NAMES, "research", "research-new"].join(", ")}` }, 400);
  } catch (e) {
    console.error("desk-run-agent failed", agent, (e as Error).message);
    return json(req, { ok: false, error: "Agent run failed." }, 500);
  }
});
