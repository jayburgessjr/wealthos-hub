import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const POLYGON_KEY = Deno.env.get("POLYGON_KEY");
    if (!POLYGON_KEY) throw new Error("POLYGON_KEY not configured");

    const body = await req.json().catch(() => ({}));
    const tickers: string[] = body.tickers ?? [];

    if (!tickers.length) {
      return new Response(JSON.stringify({ earnings: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate and limit to 20 tickers to stay within rate limits
    const unique = [...new Set(tickers)].slice(0, 20);

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
          const res = await fetch(url);
          if (!res.ok) return null;
          const data = await res.json();

          const latest = data.results?.[0];
          if (!latest) return null;

          // Get ticker details for company name
          const detailRes = await fetch(
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
    console.error("get-earnings-calendar error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
        earnings: [],
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
