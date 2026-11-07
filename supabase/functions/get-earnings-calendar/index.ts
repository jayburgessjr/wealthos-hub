import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

import { realAuthDeps } from "../_shared/auth-deno.ts";
import { corsHeaders as sharedCors, errorResponse, fetchT, isResponse, preflight, readJsonBody, requireUser } from "../_shared/auth.ts";
import { BODY_CAP_BYTES, DATA_DAILY_CAP, consumeUsage, usageResponse } from "../_shared/limits.ts";
import { asObject, validateTickerList } from "../_shared/validate.ts";

serve(async (req) => {
  const deps = realAuthDeps();
  const env = deps.env;
  const corsHeaders = sharedCors(req, env);

  const pre = preflight(req, env);
  if (pre) return pre;
  const auth = await requireUser(req, deps);
  if (isResponse(auth)) return auth;
  const parsed = await readJsonBody(req, env, BODY_CAP_BYTES.default, { allowEmpty: true });
  if (!parsed.ok) return parsed.response;

  // Deduplicated, shape-checked, capped at 20 to stay within upstream rate limits.
  const tickers: string[] = validateTickerList(asObject(parsed.body).tickers, 20);

  if (!tickers.length) {
    return new Response(JSON.stringify({ earnings: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const gate = await consumeUsage(auth.client, "data", "get-earnings-calendar", DATA_DAILY_CAP);
  if (gate !== "ok") return usageResponse(req, env, gate);

  try {
    const POLYGON_KEY = env("POLYGON_KEY");
    if (!POLYGON_KEY) throw new Error("POLYGON_KEY not configured");

    const unique = tickers;

    // Fetch upcoming earnings for each ticker from Polygon
    // Endpoint: GET /vX/reference/financials?ticker=X&timeframe=quarterly&limit=1&sort=period_of_report_date
    const today = new Date().toISOString().split("T")[0];
    const threeMonths = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const results = await Promise.all(
      unique.map(async (ticker) => {
        try {
          // Use the earnings endpoint to get next report date
          const url = `https://api.polygon.io/vX/reference/financials?ticker=${ticker}&timeframe=quarterly&limit=1&apiKey=${POLYGON_KEY}`;
          const res = await fetchT(url);
          if (!res.ok) return null;
          const data = await res.json();

          const latest = data.results?.[0];
          if (!latest) return null;

          // Get ticker details for company name
          const detailRes = await fetchT(
            `https://api.polygon.io/v3/reference/tickers/${ticker}?apiKey=${POLYGON_KEY}`,
          );
          const detail = detailRes.ok ? await detailRes.json() : null;
          const company = detail?.results?.name ?? ticker;

          // Estimate next earnings date by adding ~90 days to last report
          const lastReport = latest.period_of_report_date ?? latest.filing_date;
          if (!lastReport) return null;
          const nextDate = new Date(lastReport);
          nextDate.setDate(nextDate.getDate() + 91);
          const nextDateStr = nextDate.toISOString().split("T")[0];

          // Only include if within the next 3 months
          if (nextDateStr < today || nextDateStr > threeMonths) return null;

          const epsEstimate =
            typeof latest.financials?.income_statement
              ?.diluted_earnings_per_share?.value === "number"
              ? latest.financials.income_statement.diluted_earnings_per_share
                  .value
              : null;

          const revenueEstimate =
            typeof latest.financials?.income_statement?.revenues?.value ===
            "number"
              ? latest.financials.income_statement.revenues.value /
                1_000_000_000
              : null;

          return {
            ticker,
            company,
            reportDate: nextDateStr,
            reportTime: "AMC",
            epsEstimate,
            revenueEstimate,
            importance: "medium" as const,
          };
        } catch {
          return null;
        }
      }),
    );

    const earnings = results.filter(Boolean);

    return new Response(JSON.stringify({ earnings }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return errorResponse(req, env, 500, e);
  }
});
