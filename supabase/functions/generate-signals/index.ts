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
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const res = await fetch(
    `https://api.polygon.io/v2/aggs/ticker/${ticker}/range/1/day/${from}/${to}?apiKey=${apiKey}`
  );
  const data = await res.json();
  return data.results || [];
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

// ─── NEWS FETCH (Polygon) ───
async function fetchRecentNews(ticker: string, apiKey: string) {
  const res = await fetch(
    `https://api.polygon.io/v2/reference/news?ticker=${ticker}&limit=5&apiKey=${apiKey}`
  );
  const data = await res.json();
  return data.results || [];
}

// ─── SENTIMENT SCORE (OpenAI) ───
async function calcSentimentScore(ticker: string, polygonKey: string, openaiKey: string): Promise<number> {
  const news = await fetchRecentNews(ticker, polygonKey);
  if (!news.length) return 50;

  const headlines = news.slice(0, 5).map((n: any) => n.title).join("\n");

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
    console.error("Sentiment AI error:", response.status);
    return 50;
  }

  const data = await response.json();
  try {
    const result = JSON.parse(data.choices[0].message.content);
    return Math.max(0, Math.min(100, result.score));
  } catch {
    return 50;
  }
}

// ─── MACRO SCORES (FRED) ───
async function calcYieldCurveScore(fredKey: string | undefined): Promise<{ score: number; value: number; status: string }> {
  if (!fredKey) return { score: 60, value: 0.2, status: 'Normal' };
  try {
    const res = await fetch(
      `https://api.stlouisfed.org/fred/series/observations?series_id=T10Y2Y&limit=5&sort_order=desc&api_key=${fredKey}&file_type=json`
    );
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
    const data = await res.json();
    const vix = data.results?.[0]?.c || 15;
    
    let label = 'Low Risk';
    if (vix > 30) label = 'Extreme Fear';
    else if (vix > 20) label = 'Elevated Risk';
    else if (vix > 15) label = 'Moderate';

    let score = 80; // High score = bullish/low vix
    if (vix > 35) score = 20;
    else if (vix > 25) score = 40;
    else if (vix > 18) score = 60;

    return { score, value: vix, label };
  } catch {
    return { score: 70, value: 15, label: 'Low Risk' };
  }
}

async function getMacroData(fredKey: string | undefined, polygonKey: string) {
  const yieldCurve = await calcYieldCurveScore(fredKey);
  const vix = await calcVixProxy(polygonKey);
  
  // Sector Momentum (Simplified: SPY vs Fixed threshold)
  const spyData = await getPriceData('SPY', polygonKey);
  const spyMomentum = spyData.length >= 20 
    ? (spyData[spyData.length-1].c / spyData[spyData.length-20].c - 1) * 100 
    : 0;
  
  const sectorScore = 50 + spyMomentum * 5;
  const fedScore = 60; // Placeholder

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

// ─── OPTIONS FLOW (Unusual Whales) ───
async function getOptionsFlow(ticker: string, apiKey: string) {
  const res = await fetch(
    `https://api.unusualwhales.com/api/stock/${ticker}/options-contracts?limit=50`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  const data = await res.json();
  return data.data || [];
}

function scoreOptionsFlow(contracts: any[]): number {
  if (!contracts.length) return 50;
  let bullishPremium = 0;
  let bearishPremium = 0;
  let unusualCount = 0;
  let totalPremium = 0;

  contracts.forEach((c: any) => {
    const premium = parseFloat(c.total_premium) || 0;
    const isCall = c.type === "call" || c.put_call === "C";
    const isBull = isCall ? (c.sentiment === "bullish" || c.ask_side_pct > 60) : c.sentiment === "bearish";
    totalPremium += premium;
    if (isBull) bullishPremium += premium;
    else bearishPremium += premium;
    if (c.volume_oi_ratio > 10 || c.is_unusual) unusualCount++;
  });

  const bullRatio = bullishPremium / (totalPremium || 1);
  let score = bullRatio * 100;
  if (unusualCount >= 3) score += 15;
  else if (unusualCount >= 1) score += 8;
  if (totalPremium > 5_000_000) score += 10;
  else if (totalPremium > 1_000_000) score += 5;
  return Math.max(0, Math.min(100, Math.round(score)));
}

async function calcFlowScore(ticker: string, uwKey: string | undefined): Promise<number> {
  if (!uwKey) return 50;
  try {
    const contracts = await getOptionsFlow(ticker, uwKey);
    return scoreOptionsFlow(contracts);
  } catch (err) {
    console.error(`Options flow error for ${ticker}:`, err);
    return 50;
  }
}

// ─── ENTRY/TARGET/STOP PRICES ───
function calcPrices(candles: any[], action: string) {
  if (!candles.length) return { entry: null, target: null, stop: null };
  const current = candles[candles.length - 1].c;
  const atr = calcATR(candles);

  if (action === "exit" || action === "strong_exit") {
    return { entry: null, target: null, stop: null };
  }

  return {
    entry: +current.toFixed(2),
    target: +(current + atr * 3).toFixed(2),
    stop: +(current - atr * 1.5).toFixed(2),
  };
}

function calcATR(candles: any[], period = 14): number {
  if (candles.length < period + 1) return candles[candles.length - 1]?.c * 0.02 || 1;
  const trs: number[] = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const high = candles[i].h;
    const low = candles[i].l;
    const prevClose = candles[i - 1].c;
    trs.push(Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose)));
  }
  return trs.reduce((a, b) => a + b, 0) / trs.length;
}

// ─── MAIN HANDLER ───
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { tickers, mode } = await req.json();

    const POLYGON_KEY = Deno.env.get("POLYGON_KEY");
    const FRED_KEY = Deno.env.get("FRED_KEY");
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    const UW_KEY = Deno.env.get("UNUSUAL_WHALES_KEY");

    if (!POLYGON_KEY) throw new Error("POLYGON_KEY not configured");

    const macroData = await getMacroData(FRED_KEY, POLYGON_KEY);

    if (mode === 'macro') {
      return new Response(JSON.stringify({ macro: macroData }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!tickers?.length) throw new Error("No tickers provided");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const results = await Promise.all(
      tickers.map(async (ticker: string) => {
        try {
          const candles = await getPriceData(ticker, POLYGON_KEY);
          const techScore = calcTechnicalScore(candles);
          const sentScore = await calcSentimentScore(ticker, POLYGON_KEY, OPENAI_API_KEY);
          const flowScore = await calcFlowScore(ticker, UW_KEY);

          const composite = Math.round(
            techScore * WEIGHTS.technical +
            sentScore * WEIGHTS.sentiment +
            flowScore * WEIGHTS.options_flow +
            macroData.composite * WEIGHTS.macro
          );

          const action =
            composite >= 75 ? "strong_buy" :
            composite >= 60 ? "buy" :
            composite >= 45 ? "hold" :
            composite >= 30 ? "watch" : "exit";

          const prices = calcPrices(candles, action);

          return {
            ticker,
            signal_score: composite,
            action,
            entry_price: prices.entry,
            target_price: prices.target,
            stop_price: prices.stop,
            technical_score: techScore,
            sentiment_score: sentScore,
            options_flow_score: flowScore,
            macro_score: macroData.composite,
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
    console.error("generate-signals error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
