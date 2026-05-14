import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Forex via Frankfurter (free, no key) ──────────────────────────────────────
async function fetchForex() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?base=USD");
    const json = await res.json();
    const pairs = ["EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "CNY", "HKD", "NOK", "SEK", "NZD", "SGD", "MXN", "BRL", "INR"];

    // Fetch previous day for change calculation
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    const prevRes = await fetch(`https://api.frankfurter.app/${yesterday}?base=USD`);
    const prevJson = await prevRes.json();

    return pairs
      .filter(p => json.rates[p])
      .map(currency => {
        const rate = json.rates[currency];
        const prevRate = prevJson.rates?.[currency] ?? rate;
        const change = ((rate - prevRate) / prevRate) * 100;
        // For USD/XXX display: how many USD per 1 unit of foreign currency
        const usdPerUnit = 1 / rate;
        const prevUsdPerUnit = 1 / prevRate;
        const changeVsUsd = ((usdPerUnit - prevUsdPerUnit) / prevUsdPerUnit) * 100;
        return {
          pair: `${currency}/USD`,
          base: currency,
          quote: "USD",
          rate: parseFloat(usdPerUnit.toFixed(5)),
          rawRate: parseFloat(rate.toFixed(5)),
          change: parseFloat(changeVsUsd.toFixed(4)),
          changePct: parseFloat(changeVsUsd.toFixed(4)),
        };
      });
  } catch (e) {
    console.error("Forex fetch error:", e);
    return [];
  }
}

// ── Commodities via Polygon ───────────────────────────────────────────────────
async function fetchCommodities(polygonKey: string) {
  const commodities = [
    { ticker: "C:XAUUSD", name: "Gold",         unit: "oz",  category: "metals" },
    { ticker: "C:XAGUSD", name: "Silver",       unit: "oz",  category: "metals" },
    { ticker: "C:XPTUSD", name: "Platinum",     unit: "oz",  category: "metals" },
    { ticker: "C:XPDUSD", name: "Palladium",    unit: "oz",  category: "metals" },
    { ticker: "USO",      name: "Crude Oil",    unit: "ETF", category: "energy" },
    { ticker: "UNG",      name: "Natural Gas",  unit: "ETF", category: "energy" },
    { ticker: "WEAT",     name: "Wheat",        unit: "ETF", category: "agriculture" },
    { ticker: "CORN",     name: "Corn",         unit: "ETF", category: "agriculture" },
    { ticker: "SOYB",     name: "Soybeans",     unit: "ETF", category: "agriculture" },
    { ticker: "CPER",     name: "Copper",       unit: "ETF", category: "metals" },
    { ticker: "DBA",      name: "Agriculture",  unit: "ETF", category: "agriculture" },
  ];

  const results = await Promise.allSettled(
    commodities.map(async (c) => {
      try {
        const url = `https://api.polygon.io/v2/aggs/ticker/${c.ticker}/prev?adjusted=true&apiKey=${polygonKey}`;
        const res = await fetch(url);
        const json = await res.json();
        const result = json.results?.[0];
        if (!result) return null;
        const changePct = ((result.c - result.o) / result.o) * 100;
        return {
          ...c,
          price: parseFloat(result.c.toFixed(2)),
          open: parseFloat(result.o.toFixed(2)),
          high: parseFloat(result.h.toFixed(2)),
          low: parseFloat(result.l.toFixed(2)),
          volume: result.v,
          changePct: parseFloat(changePct.toFixed(2)),
          change: parseFloat((result.c - result.o).toFixed(2)),
        };
      } catch {
        return null;
      }
    })
  );

  return results
    .filter(r => r.status === "fulfilled" && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<any>).value);
}

// ── Bonds via FRED ────────────────────────────────────────────────────────────
async function fetchBonds(fredKey: string | undefined) {
  const series = [
    { id: "DGS1MO",  label: "1-Month",  maturity: 1/12 },
    { id: "DGS3MO",  label: "3-Month",  maturity: 3/12 },
    { id: "DGS6MO",  label: "6-Month",  maturity: 6/12 },
    { id: "DGS1",    label: "1-Year",   maturity: 1 },
    { id: "DGS2",    label: "2-Year",   maturity: 2 },
    { id: "DGS5",    label: "5-Year",   maturity: 5 },
    { id: "DGS10",   label: "10-Year",  maturity: 10 },
    { id: "DGS30",   label: "30-Year",  maturity: 30 },
    { id: "FEDFUNDS", label: "Fed Funds", maturity: 0 },
  ];

  if (!fredKey) {
    // Return mock data if no FRED key
    return {
      yields: [
        { id: "DGS1MO",  label: "1-Month",  maturity: 1/12, yield: 5.30, prevYield: 5.28, change: 0.02 },
        { id: "DGS3MO",  label: "3-Month",  maturity: 3/12, yield: 5.25, prevYield: 5.22, change: 0.03 },
        { id: "DGS6MO",  label: "6-Month",  maturity: 6/12, yield: 5.10, prevYield: 5.08, change: 0.02 },
        { id: "DGS1",    label: "1-Year",   maturity: 1,    yield: 4.95, prevYield: 4.93, change: 0.02 },
        { id: "DGS2",    label: "2-Year",   maturity: 2,    yield: 4.60, prevYield: 4.58, change: 0.02 },
        { id: "DGS5",    label: "5-Year",   maturity: 5,    yield: 4.25, prevYield: 4.22, change: 0.03 },
        { id: "DGS10",   label: "10-Year",  maturity: 10,   yield: 4.30, prevYield: 4.27, change: 0.03 },
        { id: "DGS30",   label: "30-Year",  maturity: 30,   yield: 4.45, prevYield: 4.42, change: 0.03 },
        { id: "FEDFUNDS", label: "Fed Funds", maturity: 0,  yield: 5.33, prevYield: 5.33, change: 0.00 },
      ],
      spread10y2y: -0.30,
      inverted: true,
    };
  }

  const yieldData = await Promise.allSettled(
    series.map(async (s) => {
      try {
        const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${s.id}&api_key=${fredKey}&sort_order=desc&limit=2&file_type=json`;
        const res = await fetch(url);
        const json = await res.json();
        const obs = json.observations?.filter((o: any) => o.value !== ".") ?? [];
        const latest = obs[0];
        const prev = obs[1];
        if (!latest) return null;
        const yld = parseFloat(latest.value);
        const prevYld = prev ? parseFloat(prev.value) : yld;
        return {
          ...s,
          yield: yld,
          prevYield: prevYld,
          change: parseFloat((yld - prevYld).toFixed(3)),
        };
      } catch {
        return null;
      }
    })
  );

  const yields = yieldData
    .filter(r => r.status === "fulfilled" && r.value !== null)
    .map(r => (r as PromiseFulfilledResult<any>).value);

  const y10 = yields.find(y => y.id === "DGS10")?.yield ?? 0;
  const y2 = yields.find(y => y.id === "DGS2")?.yield ?? 0;
  const spread10y2y = parseFloat((y10 - y2).toFixed(3));

  return {
    yields,
    spread10y2y,
    inverted: spread10y2y < 0,
  };
}

// ── Handler ───────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const POLYGON_KEY = Deno.env.get("POLYGON_KEY");
    const FRED_KEY = Deno.env.get("FRED_KEY");

    const body = await req.json().catch(() => ({}));
    const type = body.type ?? "all";

    const [forex, commodities, bonds] = await Promise.all([
      (type === "all" || type === "forex") ? fetchForex() : Promise.resolve([]),
      (type === "all" || type === "commodities") && POLYGON_KEY ? fetchCommodities(POLYGON_KEY) : Promise.resolve([]),
      (type === "all" || type === "bonds") ? fetchBonds(FRED_KEY) : Promise.resolve({ yields: [], spread10y2y: 0, inverted: false }),
    ]);

    return new Response(
      JSON.stringify({ forex, commodities, bonds, updatedAt: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
