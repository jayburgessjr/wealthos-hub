import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface CongressionalTrade {
  politician: string;
  party: "D" | "R" | "I";
  chamber: "House" | "Senate";
  ticker: string;
  transaction_type: "buy" | "sell";
  amount_min: number;
  amount_max: number;
  trade_date: string;
  disclosure_date: string;
  description: string;
}

interface InsiderTrade {
  name: string;
  title: string;
  company: string;
  ticker: string;
  transaction_type: "purchase" | "sale" | "grant";
  shares: number;
  value: number;
  filing_date: string;
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const mockCongressionalTrades: CongressionalTrade[] = [
  { politician: "Nancy Pelosi", party: "D", chamber: "House", ticker: "NVDA", transaction_type: "buy", amount_min: 100000, amount_max: 250000, trade_date: "2026-05-01", disclosure_date: "2026-05-10", description: "Purchase" },
  { politician: "Dan Crenshaw", party: "R", chamber: "House", ticker: "XOM", transaction_type: "buy", amount_min: 50000, amount_max: 100000, trade_date: "2026-04-28", disclosure_date: "2026-05-09", description: "Purchase" },
  { politician: "Tommy Tuberville", party: "R", chamber: "Senate", ticker: "LMT", transaction_type: "buy", amount_min: 250000, amount_max: 500000, trade_date: "2026-04-25", disclosure_date: "2026-05-07", description: "Purchase" },
  { politician: "Nancy Pelosi", party: "D", chamber: "House", ticker: "MSFT", transaction_type: "sell", amount_min: 1000000, amount_max: 5000000, trade_date: "2026-04-22", disclosure_date: "2026-05-03", description: "Sale (Full)" },
  { politician: "Shelley Moore Capito", party: "R", chamber: "Senate", ticker: "JPM", transaction_type: "buy", amount_min: 15001, amount_max: 50000, trade_date: "2026-04-20", disclosure_date: "2026-05-01", description: "Purchase" },
  { politician: "Mark Warner", party: "D", chamber: "Senate", ticker: "GOOGL", transaction_type: "sell", amount_min: 50000, amount_max: 100000, trade_date: "2026-04-18", disclosure_date: "2026-04-29", description: "Sale (Partial)" },
  { politician: "Mike Gallagher", party: "R", chamber: "House", ticker: "TSM", transaction_type: "sell", amount_min: 15001, amount_max: 50000, trade_date: "2026-04-15", disclosure_date: "2026-04-26", description: "Sale (Full)" },
  { politician: "Ro Khanna", party: "D", chamber: "House", ticker: "AAPL", transaction_type: "buy", amount_min: 1001, amount_max: 15000, trade_date: "2026-04-12", disclosure_date: "2026-04-23", description: "Purchase" },
  { politician: "Josh Gottheimer", party: "D", chamber: "House", ticker: "AMZN", transaction_type: "buy", amount_min: 50000, amount_max: 100000, trade_date: "2026-04-10", disclosure_date: "2026-04-21", description: "Purchase" },
  { politician: "Bill Hagerty", party: "R", chamber: "Senate", ticker: "BAC", transaction_type: "buy", amount_min: 100000, amount_max: 250000, trade_date: "2026-04-08", disclosure_date: "2026-04-19", description: "Purchase" },
  { politician: "Susie Lee", party: "D", chamber: "House", ticker: "MGM", transaction_type: "sell", amount_min: 15001, amount_max: 50000, trade_date: "2026-04-05", disclosure_date: "2026-04-16", description: "Sale (Full)" },
  { politician: "Kevin Hern", party: "R", chamber: "House", ticker: "CVX", transaction_type: "buy", amount_min: 250000, amount_max: 500000, trade_date: "2026-04-03", disclosure_date: "2026-04-14", description: "Purchase" },
  { politician: "Kyrsten Sinema", party: "I", chamber: "Senate", ticker: "PFE", transaction_type: "buy", amount_min: 1001, amount_max: 15000, trade_date: "2026-04-01", disclosure_date: "2026-04-12", description: "Purchase" },
  { politician: "Patrick McHenry", party: "R", chamber: "House", ticker: "V", transaction_type: "sell", amount_min: 500000, amount_max: 1000000, trade_date: "2026-03-28", disclosure_date: "2026-04-08", description: "Sale (Partial)" },
  { politician: "Alexandria Ocasio-Cortez", party: "D", chamber: "House", ticker: "TSLA", transaction_type: "sell", amount_min: 1001, amount_max: 15000, trade_date: "2026-03-25", disclosure_date: "2026-04-05", description: "Sale (Full)" },
  { politician: "Marco Rubio", party: "R", chamber: "Senate", ticker: "RTX", transaction_type: "buy", amount_min: 100000, amount_max: 250000, trade_date: "2026-03-22", disclosure_date: "2026-04-02", description: "Purchase" },
  { politician: "Debbie Wasserman Schultz", party: "D", chamber: "House", ticker: "NFLX", transaction_type: "buy", amount_min: 15001, amount_max: 50000, trade_date: "2026-03-20", disclosure_date: "2026-03-31", description: "Purchase" },
  { politician: "Ted Cruz", party: "R", chamber: "Senate", ticker: "META", transaction_type: "buy", amount_min: 250000, amount_max: 500000, trade_date: "2026-03-18", disclosure_date: "2026-03-29", description: "Purchase" },
];

const mockInsiderTrades: InsiderTrade[] = [
  { name: "Jensen Huang", title: "CEO", company: "NVIDIA Corp", ticker: "NVDA", transaction_type: "sale", shares: 120000, value: 18500000, filing_date: "2026-05-10" },
  { name: "Elon Musk", title: "CEO", company: "Tesla Inc.", ticker: "TSLA", transaction_type: "sale", shares: 500000, value: 84750000, filing_date: "2026-05-08" },
  { name: "Tim Cook", title: "CEO", company: "Apple Inc.", ticker: "AAPL", transaction_type: "sale", shares: 511000, value: 102200000, filing_date: "2026-05-07" },
  { name: "Satya Nadella", title: "CEO", company: "Microsoft Corp", ticker: "MSFT", transaction_type: "sale", shares: 50000, value: 21500000, filing_date: "2026-05-06" },
  { name: "Mark Zuckerberg", title: "Chairman & CEO", company: "Meta Platforms", ticker: "META", transaction_type: "sale", shares: 200000, value: 122800000, filing_date: "2026-05-05" },
  { name: "Andy Jassy", title: "CEO", company: "Amazon.com Inc.", ticker: "AMZN", transaction_type: "sale", shares: 35000, value: 6475000, filing_date: "2026-05-04" },
  { name: "Lisa Su", title: "President & CEO", company: "Advanced Micro Devices", ticker: "AMD", transaction_type: "sale", shares: 75000, value: 10875000, filing_date: "2026-05-03" },
  { name: "Sundar Pichai", title: "CEO", company: "Alphabet Inc.", ticker: "GOOGL", transaction_type: "sale", shares: 22000, value: 3916000, filing_date: "2026-05-02" },
  { name: "Jamie Dimon", title: "Chairman & CEO", company: "JPMorgan Chase", ticker: "JPM", transaction_type: "purchase", shares: 10000, value: 2270000, filing_date: "2026-05-01" },
  { name: "Warren Buffett", title: "Chairman & CEO", company: "Berkshire Hathaway", ticker: "BRK.B", transaction_type: "purchase", shares: 500000, value: 175500000, filing_date: "2026-04-30" },
  { name: "Cristiano Amon", title: "President & CEO", company: "Qualcomm Inc.", ticker: "QCOM", transaction_type: "grant", shares: 150000, value: 21450000, filing_date: "2026-04-29" },
  { name: "Hock Tan", title: "President & CEO", company: "Broadcom Inc.", ticker: "AVGO", transaction_type: "sale", shares: 30000, value: 56700000, filing_date: "2026-04-28" },
  { name: "Brian Niccol", title: "Chairman & CEO", company: "Starbucks Corp", ticker: "SBUX", transaction_type: "grant", shares: 200000, value: 18200000, filing_date: "2026-04-27" },
  { name: "Pat Gelsinger", title: "CEO", company: "Intel Corp", ticker: "INTC", transaction_type: "purchase", shares: 100000, value: 2450000, filing_date: "2026-04-26" },
  { name: "Arvind Krishna", title: "Chairman & CEO", company: "IBM", ticker: "IBM", transaction_type: "sale", shares: 40000, value: 8440000, filing_date: "2026-04-25" },
  { name: "Chuck Robbins", title: "Chair & CEO", company: "Cisco Systems", ticker: "CSCO", transaction_type: "sale", shares: 60000, value: 3564000, filing_date: "2026-04-24" },
  { name: "Shantanu Narayen", title: "Chairman & CEO", company: "Adobe Inc.", ticker: "ADBE", transaction_type: "sale", shares: 20000, value: 8600000, filing_date: "2026-04-23" },
  { name: "Bob Iger", title: "CEO", company: "Walt Disney Co.", ticker: "DIS", transaction_type: "grant", shares: 250000, value: 27750000, filing_date: "2026-04-22" },
];

// ── Quiver Quant congressional fetch ──────────────────────────────────────────

async function fetchCongressionalLive(limit: number): Promise<{ trades: CongressionalTrade[]; source: "live" | "mock" }> {
  const QUIVER_KEY = Deno.env.get("QUIVER_KEY");

  if (!QUIVER_KEY) {
    return { trades: mockCongressionalTrades.slice(0, limit), source: "mock" };
  }

  try {
    const res = await fetch("https://api.quiverquant.com/beta/live/congresstrading", {
      headers: { Authorization: `Token ${QUIVER_KEY}` },
    });

    if (!res.ok) {
      return { trades: mockCongressionalTrades.slice(0, limit), source: "mock" };
    }

    const json = await res.json();
    const rows = Array.isArray(json) ? json : [];

    if (rows.length === 0) {
      return { trades: mockCongressionalTrades.slice(0, limit), source: "mock" };
    }

    const trades: CongressionalTrade[] = rows.slice(0, limit).map((r: any) => ({
      politician: r.Representative ?? r.Name ?? "Unknown",
      party: (r.Party ?? "").startsWith("D") ? "D" : (r.Party ?? "").startsWith("R") ? "R" : "I",
      chamber: (r.Chamber ?? "House") as "House" | "Senate",
      ticker: r.Ticker ?? "",
      transaction_type: (r.Transaction ?? "").toLowerCase().includes("purchase") ? "buy" : "sell",
      amount_min: r.Range_Min ?? r.MinAmount ?? 0,
      amount_max: r.Range_Max ?? r.MaxAmount ?? 0,
      trade_date: r.TransactionDate ?? r.Date ?? "",
      disclosure_date: r.DisclosureDate ?? r.Filed ?? "",
      description: r.Transaction ?? "",
    }));

    return { trades, source: "live" };
  } catch {
    return { trades: mockCongressionalTrades.slice(0, limit), source: "mock" };
  }
}

// ── Polygon insider fetch ─────────────────────────────────────────────────────

async function fetchInsiderLive(limit: number): Promise<{ trades: InsiderTrade[]; source: "live" | "mock" }> {
  const POLYGON_KEY = Deno.env.get("POLYGON_KEY");

  if (!POLYGON_KEY) {
    return { trades: mockInsiderTrades.slice(0, limit), source: "mock" };
  }

  try {
    const url = `https://api.polygon.io/vX/reference/insider-transactions?limit=${limit}&apiKey=${POLYGON_KEY}`;
    const res = await fetch(url);

    if (!res.ok) {
      return { trades: mockInsiderTrades.slice(0, limit), source: "mock" };
    }

    const json = await res.json();
    const rows: any[] = json?.results ?? [];

    if (rows.length === 0) {
      return { trades: mockInsiderTrades.slice(0, limit), source: "mock" };
    }

    const txTypeMap: Record<string, InsiderTrade["transaction_type"]> = {
      A: "grant",
      D: "sale",
      P: "purchase",
      S: "sale",
      F: "sale",
      G: "grant",
    };

    const trades: InsiderTrade[] = rows.map((r: any) => {
      const rawType = (r.transaction_type ?? r.type ?? "").toUpperCase();
      const txType: InsiderTrade["transaction_type"] = txTypeMap[rawType] ?? "sale";
      const shares = Math.abs(r.shares ?? r.transaction_shares ?? 0);
      const value = Math.abs(r.value ?? r.transaction_value ?? shares * (r.exercise_price ?? r.price ?? 0));
      return {
        name: r.name ?? r.reporting_owner_name ?? "Unknown",
        title: r.title ?? r.reporting_owner_relationship ?? "",
        company: r.company_name ?? r.issuer_name ?? "",
        ticker: r.ticker ?? r.issuer_ticker ?? "",
        transaction_type: txType,
        shares,
        value,
        filing_date: r.filing_date ?? r.date_filed ?? "",
      };
    });

    return { trades, source: "live" };
  } catch {
    return { trades: mockInsiderTrades.slice(0, limit), source: "mock" };
  }
}

// ── Handler ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const type: "congressional" | "insider" = body.type ?? "congressional";
    const limit: number = Math.min(Number(body.limit ?? 50), 100);

    let result: { trades: CongressionalTrade[] | InsiderTrade[]; source: "live" | "mock" };

    if (type === "congressional") {
      result = await fetchCongressionalLive(limit);
    } else {
      result = await fetchInsiderLive(limit);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
