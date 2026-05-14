import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  source: string;
  source_provider: string; // which API provided it
  url: string;
  published_at: string;
  tickers: string[];
  sentiment: "bullish" | "bearish" | "neutral";
  sentiment_score: number;
  category: string;
  image_url?: string;
}

// ─── Sentiment scoring (simple keyword approach when no AI available) ──────────
function scoreSentiment(text: string): { sentiment: "bullish" | "bearish" | "neutral"; score: number } {
  const bullish = ["beat", "record", "rally", "surge", "strong", "growth", "profit", "upgrade", "buy", "raises", "exceeds", "outperform", "bullish", "gains", "rises", "jumps", "soars", "breakthrough", "positive"];
  const bearish = ["miss", "decline", "fall", "drop", "loss", "cut", "downgrade", "sell", "warning", "recession", "inflation", "risk", "concern", "weak", "slump", "tumble", "crash", "bearish", "disappoints", "below"];
  const lower = text.toLowerCase();
  let score = 0;
  bullish.forEach(w => { if (lower.includes(w)) score += 0.15; });
  bearish.forEach(w => { if (lower.includes(w)) score -= 0.15; });
  score = Math.max(-1, Math.min(1, score));
  return {
    sentiment: score > 0.1 ? "bullish" : score < -0.1 ? "bearish" : "neutral",
    score: Math.round(score * 100) / 100,
  };
}

function dedupeByHeadline(items: NewsItem[]): NewsItem[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.headline.toLowerCase().substring(0, 60);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ─── SOURCE 1: Polygon.io News ────────────────────────────────────────────────
async function fetchPolygonNews(apiKey: string, tickers?: string[]): Promise<NewsItem[]> {
  try {
    const tickerParam = tickers?.length ? `&ticker=${tickers.slice(0, 5).join(",ticker=")}` : "";
    const url = `https://api.polygon.io/v2/reference/news?limit=50&order=desc${tickerParam}&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Polygon news ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.results || []).map((a: any) => {
      const { sentiment, score } = scoreSentiment(`${a.title} ${a.description || ""}`);
      return {
        id: `polygon_${a.id}`,
        headline: a.title,
        summary: a.description || "",
        source: a.publisher?.name || "Polygon",
        source_provider: "Polygon",
        url: a.article_url || "",
        published_at: a.published_utc,
        tickers: (a.tickers || []).slice(0, 5),
        sentiment,
        sentiment_score: score,
        category: (a.keywords?.[0] || "markets").toLowerCase(),
        image_url: a.image_url,
      } as NewsItem;
    });
  } catch (e) {
    console.error("Polygon news error:", e);
    return [];
  }
}

// ─── SOURCE 2: Finnhub News ───────────────────────────────────────────────────
async function fetchFinnhubNews(apiKey: string): Promise<NewsItem[]> {
  try {
    const url = `https://finnhub.io/api/v1/news?category=general&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`Finnhub news ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (Array.isArray(data) ? data : []).slice(0, 30).map((a: any) => {
      const { sentiment, score } = scoreSentiment(`${a.headline} ${a.summary || ""}`);
      return {
        id: `finnhub_${a.id}`,
        headline: a.headline,
        summary: a.summary || "",
        source: a.source,
        source_provider: "Finnhub",
        url: a.url || "",
        published_at: new Date(a.datetime * 1000).toISOString(),
        tickers: a.related ? a.related.split(",").slice(0, 5) : [],
        sentiment,
        sentiment_score: score,
        category: a.category || "general",
        image_url: a.image,
      } as NewsItem;
    });
  } catch (e) {
    console.error("Finnhub news error:", e);
    return [];
  }
}

// ─── SOURCE 3: NewsAPI.org ────────────────────────────────────────────────────
async function fetchNewsAPI(apiKey: string): Promise<NewsItem[]> {
  try {
    const url = `https://newsapi.org/v2/top-headlines?category=business&language=en&pageSize=30&apiKey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`NewsAPI ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.articles || []).map((a: any, i: number) => {
      const { sentiment, score } = scoreSentiment(`${a.title} ${a.description || ""}`);
      return {
        id: `newsapi_${i}_${Date.now()}`,
        headline: a.title || "",
        summary: a.description || "",
        source: a.source?.name || "NewsAPI",
        source_provider: "NewsAPI",
        url: a.url || "",
        published_at: a.publishedAt,
        tickers: [],
        sentiment,
        sentiment_score: score,
        category: "business",
        image_url: a.urlToImage,
      } as NewsItem;
    }).filter((a: NewsItem) => a.headline && a.headline !== "[Removed]");
  } catch (e) {
    console.error("NewsAPI error:", e);
    return [];
  }
}

// ─── SOURCE 4: Alpha Vantage News Sentiment ───────────────────────────────────
async function fetchAlphaVantageNews(apiKey: string, tickers?: string[]): Promise<NewsItem[]> {
  try {
    const tickerParam = tickers?.length ? `&tickers=${tickers.slice(0, 3).join(",")}` : "";
    const url = `https://www.alphavantage.co/query?function=NEWS_SENTIMENT${tickerParam}&limit=30&apikey=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`AlphaVantage news ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (!data.feed) return [];
    return data.feed.slice(0, 30).map((a: any, i: number) => {
      const overallScore = parseFloat(a.overall_sentiment_score) || 0;
      const sentiment = overallScore > 0.1 ? "bullish" : overallScore < -0.1 ? "bearish" : "neutral";
      return {
        id: `av_${i}_${a.time_published}`,
        headline: a.title,
        summary: a.summary || "",
        source: a.source,
        source_provider: "AlphaVantage",
        url: a.url || "",
        published_at: a.time_published
          ? `${a.time_published.substring(0,4)}-${a.time_published.substring(4,6)}-${a.time_published.substring(6,8)}T${a.time_published.substring(9,11)}:${a.time_published.substring(11,13)}:00Z`
          : new Date().toISOString(),
        tickers: (a.ticker_sentiment || []).map((t: any) => t.ticker).slice(0, 5),
        sentiment,
        sentiment_score: Math.round(overallScore * 100) / 100,
        category: a.topics?.[0]?.topic || "markets",
        image_url: a.banner_image,
      } as NewsItem;
    });
  } catch (e) {
    console.error("AlphaVantage news error:", e);
    return [];
  }
}

// ─── SOURCE 5: MarketAux ──────────────────────────────────────────────────────
async function fetchMarketAux(apiKey: string, tickers?: string[]): Promise<NewsItem[]> {
  try {
    const symbolsParam = tickers?.length ? `&symbols=${tickers.slice(0, 3).join(",")}` : "";
    const url = `https://api.marketaux.com/v1/news/all?language=en&filter_entities=true&limit=25${symbolsParam}&api_token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`MarketAux news ${res.status}`);
      return [];
    }
    const data = await res.json();
    return (data.data || []).map((a: any) => {
      const avgSentiment = a.entities?.length
        ? a.entities.reduce((sum: number, e: any) => sum + (e.sentiment_score || 0), 0) / a.entities.length
        : 0;
      const sentiment = avgSentiment > 0.1 ? "bullish" : avgSentiment < -0.1 ? "bearish" : "neutral";
      return {
        id: `marketaux_${a.uuid}`,
        headline: a.title,
        summary: a.description || "",
        source: a.source,
        source_provider: "MarketAux",
        url: a.url || "",
        published_at: a.published_at,
        tickers: (a.entities || []).map((e: any) => e.symbol).filter(Boolean).slice(0, 5),
        sentiment,
        sentiment_score: Math.round(avgSentiment * 100) / 100,
        category: (a.categories?.[0] || "markets").toLowerCase(),
        image_url: a.image_url,
      } as NewsItem;
    });
  } catch (e) {
    console.error("MarketAux news error:", e);
    return [];
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────
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
    const { tickers, limit = 60 } = body;

    const POLYGON_KEY       = Deno.env.get("POLYGON_KEY");
    const FINNHUB_KEY       = Deno.env.get("FINNHUB_KEY");
    const NEWSAPI_KEY       = Deno.env.get("NEWSAPI_KEY");
    const ALPHAVANTAGE_KEY  = Deno.env.get("ALPHAVANTAGE_KEY");
    const MARKETAUX_KEY     = Deno.env.get("MARKETAUX_KEY");

    // Track which sources are active
    const sources: string[] = [];
    const fetches: Promise<NewsItem[]>[] = [];

    if (POLYGON_KEY) { fetches.push(fetchPolygonNews(POLYGON_KEY, tickers)); sources.push("Polygon"); }
    if (FINNHUB_KEY) { fetches.push(fetchFinnhubNews(FINNHUB_KEY)); sources.push("Finnhub"); }
    if (NEWSAPI_KEY) { fetches.push(fetchNewsAPI(NEWSAPI_KEY)); sources.push("NewsAPI"); }
    if (ALPHAVANTAGE_KEY) { fetches.push(fetchAlphaVantageNews(ALPHAVANTAGE_KEY, tickers)); sources.push("AlphaVantage"); }
    if (MARKETAUX_KEY) { fetches.push(fetchMarketAux(MARKETAUX_KEY, tickers)); sources.push("MarketAux"); }

    if (fetches.length === 0) {
      return new Response(JSON.stringify({
        error: "No API keys configured. Add at least one: POLYGON_KEY, FINNHUB_KEY, NEWSAPI_KEY, ALPHAVANTAGE_KEY, or MARKETAUX_KEY",
        sources: [],
        articles: [],
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const results = await Promise.allSettled(fetches);
    const allArticles: NewsItem[] = [];
    results.forEach(r => { if (r.status === "fulfilled") allArticles.push(...r.value); });

    // Sort by date desc, dedupe, limit
    const sorted = dedupeByHeadline(
      allArticles.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    ).slice(0, limit);

    // Sentiment summary
    const bullishCount = sorted.filter(a => a.sentiment === "bullish").length;
    const bearishCount = sorted.filter(a => a.sentiment === "bearish").length;
    const neutralCount = sorted.filter(a => a.sentiment === "neutral").length;
    const avgScore = sorted.reduce((s, a) => s + a.sentiment_score, 0) / (sorted.length || 1);

    return new Response(JSON.stringify({
      articles: sorted,
      sources,
      sentiment_summary: {
        bullish: bullishCount,
        bearish: bearishCount,
        neutral: neutralCount,
        avg_score: Math.round(avgScore * 100) / 100,
        overall: avgScore > 0.05 ? "bullish" : avgScore < -0.05 ? "bearish" : "neutral",
      },
      fetched_at: new Date().toISOString(),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e) {
    console.error("get-financial-news error:", e);
    return new Response(JSON.stringify({ error: String(e), articles: [], sources: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
