// Market data adapters: Polygon (bars, IPOs) and SEC EDGAR (current 8-K feed). Fetch is injected; timeouts and one retry on 429/5xx.
import type { FilingEntry, IpoRecord, OhlcBar } from "../scanners.ts";
import { SYMBOL_MAP, type MarketData } from "./agents.ts";

const INVERSE_SYMBOL_MAP = Object.fromEntries(Object.entries(SYMBOL_MAP).map(([k, v]) => [v, k]));

async function getJson(f: typeof fetch, url: string, init: RequestInit = {}, sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))): Promise<unknown> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await f(url, { ...init, signal: AbortSignal.timeout(30_000) });
    if (res.status === 429 || res.status >= 500) {
      if (attempt === 0) { await sleep(1500); continue; }
      throw new Error(`upstream ${res.status}`);
    }
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    return res.json();
  }
  throw new Error("unreachable");
}

export class PolygonMarket implements MarketData {
  constructor(private key: string, private opts: { fetchImpl?: typeof fetch; secUserAgent?: string; now?: () => Date } = {}) {}
  private get f() {
    return this.opts.fetchImpl ?? fetch;
  }

  async bars(symbol: string, days: number): Promise<OhlcBar[]> {
    const ticker = INVERSE_SYMBOL_MAP[symbol] ?? symbol;
    const now = (this.opts.now ?? (() => new Date()))();
    const to = now.toISOString().slice(0, 10);
    const from = new Date(now.getTime() - Math.ceil(days * 1.7 + 5) * 86_400_000).toISOString().slice(0, 10);
    const url = `https://api.polygon.io/v2/aggs/ticker/${encodeURIComponent(ticker)}/range/1/day/${from}/${to}?adjusted=true&sort=asc&limit=500&apiKey=${this.key}`;
    const j = (await getJson(this.f, url)) as { results?: { t: number; o: number; h: number; l: number; c: number; v?: number }[] };
    const bars = (j.results ?? []).map((r) => ({ date: new Date(r.t).toISOString().slice(0, 10), open: r.o, high: r.h, low: r.l, close: r.c, volume: r.v }));
    return bars.slice(-days);
  }

  async ipos(): Promise<IpoRecord[]> {
    const out: IpoRecord[] = [];
    for (const status of ["pending", "new"]) {
      const j = (await getJson(this.f, `https://api.polygon.io/vx/reference/ipos?ipo_status=${status}&limit=50&apiKey=${this.key}`)) as { results?: IpoRecord[] };
      out.push(...(j.results ?? []));
    }
    return out;
  }

  async filings(): Promise<FilingEntry[]> {
    const headers = { "User-Agent": this.opts.secUserAgent ?? "WealthOS-Desk internal research", Accept: "application/atom+xml, application/json" };
    const tickers = (await getJson(this.f, "https://www.sec.gov/files/company_tickers.json", { headers })) as Record<string, { cik_str: number; ticker: string }>;
    const byCik = new Map<number, string>(Object.values(tickers).map((t) => [Number(t.cik_str), t.ticker]));
    const res = await this.f("https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K&company=&dateb=&owner=include&start=0&count=100&output=atom", { headers, signal: AbortSignal.timeout(30_000) });
    if (!res.ok) throw new Error(`EDGAR ${res.status}`);
    const xml = await res.text();
    const out: FilingEntry[] = [];
    for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
      const e = m[1];
      const title = /<title[^>]*>([\s\S]*?)<\/title>/.exec(e)?.[1] ?? "";
      const t = /^(\S+) - (.*?) \((\d{10})\)/.exec(title.trim());
      const href = /<link[^>]*href="([^"]+)"/.exec(e)?.[1];
      if (!t || !href) continue;
      const items = [...(/<summary[^>]*>([\s\S]*?)<\/summary>/.exec(e)?.[1] ?? "").matchAll(/Item\s+(\d\.\d{2})/g)].map((x) => x[1]);
      out.push({ form: t[1], company: t[2], ticker: byCik.get(Number(t[3])), filedAt: /<updated>([^<]+)<\/updated>/.exec(e)?.[1] ?? "", url: href.replace(/^http:/, "https:"), items });
    }
    return out;
  }
}
