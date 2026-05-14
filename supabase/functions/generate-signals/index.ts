import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Score weights
const WEIGHTS = {
  technical: 0.30,
  sentiment: 0.25,
  options_flow: 0.25,
  macro: 0.20,
};

// ─── PRICE DATA (Polygon) ───
async function getPriceData(ticker: string, apiKey: string) {
  try {
    const to = new Date().toISOString().split("T")[0];
    const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?apiKey=${apiKey}`;
    const res = await fetch(url);

    if (!res.ok) {
      console.error(`Polygon error for ${ticker}: ${res.status} ${res.statusText}`);
      return [];
    }

    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error(`Fetch error for ${ticker}:`, err);
    return [];
  }
}

// ─── TECHNICAL SCORE (RSI + Momentum + Volume) ───
function calcTechnicalScore(candles: any[]): number {
  if (candles.length < 20) return 50;

  const closes = candles.map((c) => c.c);

  // RSI (14)
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < 15; i++) {
    const diff = closes[closes.length - i] - closes[closes.length - i - 1];
    diff > 0 ? gains.push(diff) : losses.push(Math.abs(diff));
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
  const rs = avgGain / (avgLoss || 0.001);
  const rsi = 100 - 100 / (1 + rs);

  // Momentum (10-day)
  const momentum = (closes[closes.length - 1] / closes[closes.length - 11] - 1) * 100;

  // Volume trend
  const volumes = candles.map((c) => c.v);
  const recentVol = volumes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const avgVol = volumes.slice(-20).reduce((a, b) => a + b, 0) / 20;
  const volRatio = recentVol / avgVol;

  let score = 50;
  if (rsi < 30) score += 25;
  else if (rsi < 45) score += 12;
  else if (rsi > 70) score -= 20;

  if (momentum > 3) score += 15;
  else if (momentum > 1) score += 8;
  else if (momentum < -3) score -= 15;

  if (volRatio > 2) score += 10;

  return Math.max(0, Math.min(100, score));
}

// ─── PRICE LEVELS (entry, stop, target derived from candles) ───
function calcPriceLevels(
  candles: any[],
  action: string
): { entry_price: number | null; stop_price: number | null; target_price: number | null } {
  if (!candles.length || action === "exit" || action === "strong_exit") {
    return { entry_price: null, stop_price: null, target_price: null };
  }

  const entry = Math.round(candles[candles.length - 1].c * 100) / 100;

  // Stop: lowest low of last 10 candles with 0.5% buffer below
  const lookback = Math.min(10, candles.length);
  const swingLow = Math.min(...candles.slice(-lookback).map((c: any) => c.l));
  const stop = Math.round(swingLow * 0.995 * 100) / 100;

  // Target: 2:1 R/R for strong_buy, 1.5:1 for everything else
  const riskPoints = entry - stop;
  const rrRatio = action === "strong_buy" ? 2.0 : 1.5;
  const target = Math.round((entry + riskPoints * rrRatio) * 100) / 100;

  return { entry_price: entry, stop_price: stop, target_price: target };
}

// ─── NEWS FETCH (Polygon) ───
async function fetchRecentNews(ticker: string, apiKey: string) {
  try {
    const res = await fetch(
      `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=5&apiKey=${apiKey}`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch {
    return [];
  }
}

// ─── SENTIMENT SCORE (OpenAI) ───
async function calcSentimentScore(
  ticker: string,
  polygonKey: string,
  openaiKey: string
): Promise<{ score: number; summary: string }> {
  const news = await fetchRecentNews(ticker, polygonKey);
  if (!news.length) return { score: 50, summary: "" };

  const headlines = news.slice(0, 5).map((n: any) => n.title).join("\n");

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: `Rate the sentiment for ${ticker} based on these headlines. Return ONLY a JSON object: {"score": 0-100, "bull_pct": 0-100, "summary": "one sentence"}\n\nHeadlines:\n${headlines}`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      console.error(`OpenAI error for ${ticker}: ${response.status}`);
      return { score: 50, summary: "" };
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);
    return {
      score: Math.max(0, Math.min(100, result.score)),
      summary: result.summary || "",
    };
  } catch (err) {
    console.error(`Sentiment score exception for ${ticker}:`, err);
    return { score: 50, summary: "" };
  }
}

// ─── REASONING BULLETS ───
function buildReasoning(
  candles: any[],
  techScore: number,
  sentimentSummary: string,
  macroComposite: number,
  action: string
): string[] {
  const reasons: string[] = [];
  if (!candles.length) return reasons;

  const closes = candles.map((c: any) => c.c);

  // RSI
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = 1; i < 15; i++) {
    const diff = closes[closes.length - i] - closes[closes.length - i - 1];
    diff > 0 ? gains.push(diff) : losses.push(Math.abs(diff));
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / 14;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / 14;
  const rsi = Math.round(100 - 100 / (1 + avgGain / (avgLoss || 0.001)));

  // Momentum
  const momentum10 = candles.length >= 11
    ? ((closes[closes.length - 1] / closes[closes.length - 11] - 1) * 100)
    : 0;

  // Volume
  const volumes = candles.map((c: any) => c.v);
  const recentVol = volumes.slice(-5).reduce((a: number, b: number) => a + b, 0) / 5;
  const avgVol = volumes.slice(-20).reduce((a: number, b: number) => a + b, 0) / 20;
  const volRatio = Math.round((recentVol / avgVol) * 10) / 10;

  // RSI reason
  if (rsi < 30) reasons.push(`RSI ${rsi} — oversold, historical mean-reversion zone`);
  else if (rsi < 45) reasons.push(`RSI ${rsi} — cooling from overbought, momentum building`);
  else if (rsi > 70) reasons.push(`RSI ${rsi} — overbought, pullback risk elevated`);
  else reasons.push(`RSI ${rsi} — neutral, watching for directional break`);

  // Momentum reason
  if (momentum10 > 3) reasons.push(`10-day momentum +${momentum10.toFixed(1)}% — strong trend continuation`);
  else if (momentum10 > 1) reasons.push(`10-day momentum +${momentum10.toFixed(1)}% — mild upside bias`);
  else if (momentum10 < -3) reasons.push(`10-day momentum ${momentum10.toFixed(1)}% — downtrend in force`);
  else reasons.push(`10-day momentum flat (${momentum10.toFixed(1)}%) — no clear directional edge`);

  // Volume reason
  if (volRatio > 2) reasons.push(`Volume ${volRatio}× average — institutional participation spike`);
  else if (volRatio > 1.3) reasons.push(`Volume ${volRatio}× average — above-normal buying interest`);
  else reasons.push(`Volume ${volRatio}× average — in line with recent activity`);

  // Sentiment reason (from OpenAI summary)
  if (sentimentSummary) reasons.push(`News: ${sentimentSummary}`);

  // Macro reason
  if (macroComposite > 65) reasons.push(`Macro bullish (${macroComposite}/100) — regime tailwind for longs`);
  else if (macroComposite < 40) reasons.push(`Macro bearish (${macroComposite}/100) — headwind, size conservatively`);
  else reasons.push(`Macro neutral (${macroComposite}/100) — no strong regime bias`);

  return reasons;
}

// ─── MACRO SCORES (FRED + Polygon) ───
async function calcYieldCurveScore(fredKey: string | undefined): Promise<{ score: number; value: number; status: string }> {
  if (!fredKey) return { score: 60, value: 0.2, status: 'Normal (Key Missing)' };
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&limit=1&sort_order=desc&api_key=${fredKey}&file_type=json`
    );
    if (!res.ok) return { score: 60, value: 0.2, status: 'Normal (FRED Error)' };
    const data = await res.json();
    const latest = parseFloat(data.observations?.[0]?.value);
    if (isNaN(latest)) return { score: 60, value: 0.2, status: 'Normal' };

    let status = 'Normal';
    if (latest < 0) status = 'Inverted';
    else if (latest < 0.2) status = 'Flat';

    let score = 60;
    if (latest > 1) score = 75;
    else if (latest > 0) score = 60;
    else if (latest > -0.5) score = 40;
    else score = 25;

    return { score, value: latest, status };
  } catch {
    return { score: 60, value: 0.2, status: 'Normal' };
  }
}

async function calcVixProxy(polygonKey: string): Promise<{ score: number; value: number; label: string }> {
  try {
    const res = await fetch(`https://api.polygon.io/v2/aggs/ticker/I:VIX/prev?adjusted=true&apiKey=${polygonKey}`);
    if (!res.ok) {
      console.warn("VIX Index fetch failed (likely subscription level). Falling back to SPY volatility proxy.");
      return { score: 70, value: 15, label: 'Low Risk' };
    }
    const data = await res.json();
    const vix = data.results?.[0]?.c || 15;

    let label = 'Low Risk';
    if (vix > 30) label = 'Extreme Fear';
    else if (vix > 20) label = 'Elevated Risk';
    else if (vix > 15) label = 'Moderate';

    let score = 80;
    if (vix > 35) score = 20;
    else if (vix > 25) score = 40;
    else if (vix > 18) score = 60;

    return { score, value: vix, label };
  } catch {
    return { score: 70, value: 15, label: 'Low Risk' };
  }
}

async function getMacroData(fredKey: string | undefined, polygonKey: string) {
  console.log("Fetching Macro Data...");
  const yieldCurve = await calcYieldCurveScore(fredKey);
  const vix = await calcVixProxy(polygonKey);

  const spyData = await getPriceData('SPY', polygonKey);
  const spyMomentum = spyData.length >= 20
    ? (spyData[spyData.length - 1].c / spyData[spyData.length - 20].c - 1) * 100
    : 0;

  const sectorScore = 50 + spyMomentum * 5;
  const fedScore = 60;

  const composite = Math.round(
    yieldCurve.score * 0.4 +
    vix.score * 0.3 +
    sectorScore * 0.2 +
    fedScore * 0.1
  );

  return {
    composite,
    yieldCurve,
    vix,
    sector: { score: Math.round(sectorScore), value: Number(spyMomentum.toFixed(2)), label: spyMomentum > 0 ? 'Bullish' : 'Bearish' },
    fed: { score: fedScore, value: '0-25bps', label: 'Neutral' },
    updatedAt: new Date().toISOString()
  };
}

// ─── MAIN HANDLER ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { tickers, mode } = body;

    const POLYGON_KEY = Deno.env.get("POLYGON_KEY");
    const FRED_KEY = Deno.env.get("FRED_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!POLYGON_KEY) throw new Error("POLYGON_KEY not configured in Supabase secrets");

    const macroData = await getMacroData(FRED_KEY, POLYGON_KEY);

    if (mode === 'macro') {
      return new Response(JSON.stringify({ macro: macroData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tickers?.length) {
      return new Response(JSON.stringify({ error: "No tickers provided", macro: macroData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured in Supabase secrets");

    console.log(`Generating signals for: ${tickers.join(", ")}`);

    const results = await Promise.all(
      tickers.map(async (ticker: string) => {
        try {
          const candles = await getPriceData(ticker, POLYGON_KEY);
          if (!candles.length) {
            return { ticker, signal_score: 50, action: "hold", error: "No price data returned from Polygon" };
          }

          const techScore = calcTechnicalScore(candles);
          const sentiment = await calcSentimentScore(ticker, POLYGON_KEY, OPENAI_API_KEY);

          const composite = Math.round(
            techScore * WEIGHTS.technical +
            sentiment.score * WEIGHTS.sentiment +
            macroData.composite * WEIGHTS.macro
          );

          const action =
            composite >= 75 ? "strong_buy" :
            composite >= 60 ? "buy" :
            composite >= 45 ? "hold" :
            composite >= 30 ? "watch" : "exit";

          const priceLevels = calcPriceLevels(candles, action);
          const reasoning = buildReasoning(candles, techScore, sentiment.summary, macroData.composite, action);

          return {
            ticker,
            asset_class: "equity",
            signal_score: composite,
            action,
            technical_score: techScore,
            sentiment_score: sentiment.score,
            macro_score: macroData.composite,
            ...priceLevels,
            reasoning,
            generated_at: new Date().toISOString(),
          };
        } catch (err) {
          console.error(`Error generating signal for ${ticker}:`, err);
          return { ticker, signal_score: 50, action: "hold", error: String(err) };
        }
      })
    );

    return new Response(JSON.stringify({ signals: results, macro: macroData }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("CRITICAL generate-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown critical error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
