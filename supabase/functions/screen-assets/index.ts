import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScreenerFilters {
  min_price?: number;
  max_price?: number;
  min_volume?: number;
  min_change_pct?: number;
  max_change_pct?: number;
  min_market_cap?: number;
}

interface PolygonBar {
  T: string;  // ticker
  c: number;  // close
  o: number;  // open
  h: number;  // high
  l: number;  // low
  v: number;  // volume
  vw: number; // vwap
  n?: number; // number of transactions
}

interface ScreenerResult {
  ticker: string;
  price: number;
  open: number;
  change: number;
  change_pct: number;
  volume: number;
  vwap: number;
  high: number;
  low: number;
}

function getLastTradingDay(): string {
  const now = new Date();
  // Use UTC date minus one day; roll back over weekends
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() - 1);

  // If Sunday (0), go back 2 more days to Friday
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() - 2);
  // If Saturday (6), go back 1 more day to Friday
  else if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);

  return date.toISOString().split("T")[0];
}

function isStandardTicker(ticker: string): boolean {
  // Skip tickers with dots (like BRK.A) and those longer than 5 chars
  return !ticker.includes(".") && ticker.length <= 5 && /^[A-Z]+$/.test(ticker);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const POLYGON_KEY = Deno.env.get("POLYGON_KEY");
    if (!POLYGON_KEY) {
      return new Response(
        JSON.stringify({ error: "POLYGON_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const filters: ScreenerFilters = body.filters ?? {};
    const limit: number = body.limit ?? 50;

    const date = getLastTradingDay();
    const url = `https://api.polygon.io/v2/aggs/grouped/locale/us/market/stocks/${date}?adjusted=true&apiKey=${POLYGON_KEY}`;

    const polygonRes = await fetch(url);

    if (!polygonRes.ok) {
      console.error(`Polygon error: ${polygonRes.status} ${polygonRes.statusText}`);
      return new Response(
        JSON.stringify({ results: [], message: `Polygon API error: ${polygonRes.status}` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const polygonData = await polygonRes.json();

    if (!polygonData.results || polygonData.results.length === 0) {
      return new Response(
        JSON.stringify({
          results: [],
          message: "No market data available for this date (weekend or holiday).",
          date,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const bars: PolygonBar[] = polygonData.results;

    // Filter and map
    const screened: ScreenerResult[] = [];

    for (const bar of bars) {
      const { T: ticker, c: close, o: open, h: high, l: low, v: volume, vw: vwap } = bar;

      // Skip malformed records
      if (!ticker || !close || !open || !volume) continue;

      // Skip penny stocks (< $1)
      if (close < 1) continue;

      // Skip non-standard tickers
      if (!isStandardTicker(ticker)) continue;

      const change = close - open;
      const change_pct = (change / open) * 100;

      // Apply filters
      if (filters.min_price !== undefined && close < filters.min_price) continue;
      if (filters.max_price !== undefined && close > filters.max_price) continue;
      if (filters.min_volume !== undefined && volume < filters.min_volume) continue;
      if (filters.min_change_pct !== undefined && change_pct < filters.min_change_pct) continue;
      if (filters.max_change_pct !== undefined && change_pct > filters.max_change_pct) continue;

      screened.push({
        ticker,
        price: close,
        open,
        change,
        change_pct,
        volume,
        vwap: vwap ?? close,
        high,
        low,
      });
    }

    // Sort by volume descending
    screened.sort((a, b) => b.volume - a.volume);

    const topResults = screened.slice(0, limit);

    return new Response(
      JSON.stringify({ results: topResults, date, total_matched: screened.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("screen-assets error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
