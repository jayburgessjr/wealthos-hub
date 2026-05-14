import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
    const { ticker } = await req.json();
    if (!ticker) {
      return new Response(JSON.stringify({ error: "ticker is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const POLYGON_KEY = Deno.env.get("POLYGON_KEY");
    if (!POLYGON_KEY) {
      return new Response(JSON.stringify({ error: "POLYGON_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sym = ticker.toUpperCase().trim();

    // ─── Previous close quote ─────────────────────────────────────────────
    const [quoteRes, newsRes] = await Promise.all([
      fetch(
        `https://api.polygon.io/v2/aggs/ticker/${sym}/prev?adjusted=true&apiKey=${POLYGON_KEY}`
      ),
      fetch(
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
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
