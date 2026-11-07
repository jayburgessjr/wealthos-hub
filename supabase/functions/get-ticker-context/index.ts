import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { realAuthDeps } from "../_shared/auth-deno.ts";
import { corsHeaders as sharedCors, errorResponse, fetchT, isResponse, preflight, readJsonBody, requireUser } from "../_shared/auth.ts";
import { BODY_CAP_BYTES, DATA_DAILY_CAP, consumeUsage, usageResponse } from "../_shared/limits.ts";
import { asObject, cleanTicker } from "../_shared/validate.ts";

serve(async (req) => {
  const deps = realAuthDeps();
  const env = deps.env;
  const corsHeaders = sharedCors(req, env);

  const pre = preflight(req, env);
  if (pre) return pre;
  const auth = await requireUser(req, deps);
  if (isResponse(auth)) return auth;
  const parsed = await readJsonBody(req, env, BODY_CAP_BYTES.default);
  if (!parsed.ok) return parsed.response;

  const sym = cleanTicker(asObject(parsed.body).ticker);
  if (!sym) return errorResponse(req, env, 400, "invalid ticker");

  const gate = await consumeUsage(auth.client, "data", "get-ticker-context", DATA_DAILY_CAP);
  if (gate !== "ok") return usageResponse(req, env, gate);

  try {
    const POLYGON_KEY = env("POLYGON_KEY");
    if (!POLYGON_KEY) {
      return errorResponse(req, env, 500, "POLYGON_KEY not configured");
    }

    // ─── Previous close quote ─────────────────────────────────────────────
    const [quoteRes, newsRes] = await Promise.all([
      fetchT(
        `https://api.polygon.io/v2/aggs/ticker/${sym}/prev?adjusted=true&apiKey=${POLYGON_KEY}`
      ),
      fetchT(
        `https://api.polygon.io/v2/reference/news?ticker=${sym}&limit=5&sort=desc&apiKey=${POLYGON_KEY}`
      ),
    ]);

    let quote = null;
    if (quoteRes.ok) {
      const quoteData = await quoteRes.json();
      const r = quoteData.results?.[0];
      if (r) {
        const change_pct = r.o > 0 ? ((r.c - r.o) / r.o) * 100 : 0;
        quote = {
          price: r.c,
          open: r.o,
          high: r.h,
          low: r.l,
          close: r.c,
          volume: r.v,
          change_pct: Math.round(change_pct * 100) / 100,
        };
      }
    }

    let news: { title: string; published_utc: string; description: string; source: string; url: string }[] = [];
    if (newsRes.ok) {
      const newsData = await newsRes.json();
      news = (newsData.results || []).slice(0, 5).map((n: any) => ({
        title: n.title,
        published_utc: n.published_utc,
        description: n.description || "",
        source: n.publisher?.name || "",
        url: n.article_url || "",
      }));
    }

    return new Response(JSON.stringify({ quote, news }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("get-ticker-context error:", e);
    return errorResponse(req, env, 500, e);
  }
});
