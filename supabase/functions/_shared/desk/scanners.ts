// Scanner detectors. Pure functions over bars/records -> SignalDraft[]. No I/O, no broker, no order types.
// Fetching lives in the edge functions; every draft must carry at least one source link.

import type { AssetClass } from "./types.ts";

export interface OhlcBar {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export type ScannerAgent =
  | "scan-gaps-drawdowns"
  | "scan-ipos"
  | "scan-sec-filings"
  | "scan-sector-momentum"
  | "scan-crypto-volatility"
  | "scan-commodity-trends";

export interface SignalDraft {
  agent: ScannerAgent;
  symbol: string;
  assetClass: AssetClass;
  direction: "long" | "short" | "watch";
  title: string;
  summary: string;
  /** 0..1 */
  strength: number;
  refPrice: number | null;
  sources: { label: string; url: string }[];
  /** Stable key so re-runs on the same day do not duplicate. */
  dedupeKey: string;
}

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const chartUrl = (symbol: string) => `https://www.tradingview.com/symbols/${encodeURIComponent(symbol.replace("X:", "").replace("/", ""))}/`;

// ---- unusual gaps and drawdowns ------------------------------------------------------------
export function detectGapsAndDrawdowns(symbol: string, bars: OhlcBar[], opts = { gap: 0.05, drawdown: 0.15 }): SignalDraft[] {
  const out: SignalDraft[] = [];
  if (bars.length < 21) return out;
  const last = bars[bars.length - 1];
  const prev = bars[bars.length - 2];

  const gap = last.open / prev.close - 1;
  if (Math.abs(gap) >= opts.gap) {
    out.push({
      agent: "scan-gaps-drawdowns", symbol, assetClass: "equity",
      direction: gap < 0 ? "long" : "watch", // a gap down is a mean-reversion candidate; a gap up is only watched
      title: `${symbol} gapped ${gap < 0 ? "down" : "up"} ${pct(Math.abs(gap))}`,
      summary: `Opened ${last.open.toFixed(2)} against a prior close of ${prev.close.toFixed(2)} on ${last.date}.`,
      strength: clamp01(Math.abs(gap) / 0.15), refPrice: last.close,
      sources: [{ label: "Chart", url: chartUrl(symbol) }],
      dedupeKey: `gap:${symbol}:${last.date}`,
    });
  }

  const window = bars.slice(-21, -1);
  const high = Math.max(...window.map((b) => b.high));
  const dd = last.close / high - 1;
  if (dd <= -opts.drawdown) {
    out.push({
      agent: "scan-gaps-drawdowns", symbol, assetClass: "equity", direction: "watch",
      title: `${symbol} is ${pct(Math.abs(dd))} below its 20-day high`,
      summary: `Close ${last.close.toFixed(2)} against a 20-day high of ${high.toFixed(2)}.`,
      strength: clamp01(Math.abs(dd) / 0.4), refPrice: last.close,
      sources: [{ label: "Chart", url: chartUrl(symbol) }],
      dedupeKey: `dd:${symbol}:${last.date}`,
    });
  }
  return out;
}

// ---- IPOs (Polygon /vx/reference/ipos shape) -----------------------------------------------
export interface IpoRecord {
  ticker?: string;
  issuer_name?: string;
  ipo_status?: string; // pending | new | rumor | history ...
  listing_date?: string;
  final_issue_price?: number;
  lowest_offer_price?: number;
  highest_offer_price?: number;
}

export function detectIpos(records: IpoRecord[], today: string): SignalDraft[] {
  return records
    .filter((r) => r.ticker && (r.ipo_status === "pending" || r.ipo_status === "new"))
    .map((r) => {
      const symbol = r.ticker as string;
      const price = r.final_issue_price ?? r.highest_offer_price ?? null;
      return {
        agent: "scan-ipos" as const, symbol, assetClass: "equity" as const, direction: "watch" as const,
        title: `${r.issuer_name ?? symbol} IPO ${r.ipo_status === "new" ? "priced" : "pending"}${r.listing_date ? ` for ${r.listing_date}` : ""}`,
        summary: `Status ${r.ipo_status}. ${price ? `Price reference ${price}.` : "No price range published yet."}`,
        strength: r.ipo_status === "new" ? 0.6 : 0.4, refPrice: price,
        sources: [{ label: "Polygon IPO calendar", url: `https://polygon.io/docs/stocks/get_vx_reference_ipos` }, { label: "SEC EDGAR search", url: `https://www.sec.gov/edgar/search/#/q=${encodeURIComponent(r.issuer_name ?? symbol)}` }],
        dedupeKey: `ipo:${symbol}:${r.ipo_status}:${r.listing_date ?? today}`,
      };
    });
}

// ---- SEC filings (EDGAR current-events atom entries) ---------------------------------------
export interface FilingEntry {
  form: string; // 8-K, 4, S-1, 13D ...
  company: string;
  ticker?: string;
  filedAt: string;
  url: string;
  items?: string[]; // 8-K item numbers when parsed
}

const MATERIAL_8K_ITEMS = new Set(["1.01", "1.02", "2.01", "2.02", "2.05", "2.06", "3.01", "4.02", "5.02", "8.01"]);

export function detectSecFilings(entries: FilingEntry[], watch: Set<string>): SignalDraft[] {
  const out: SignalDraft[] = [];
  for (const e of entries) {
    const symbol = (e.ticker ?? "").toUpperCase();
    if (!symbol || !watch.has(symbol)) continue;
    const material = e.form === "8-K" ? (e.items ?? []).some((i) => MATERIAL_8K_ITEMS.has(i)) : ["S-1", "SC 13D", "SC 13D/A", "13D"].includes(e.form);
    if (!material) continue;
    out.push({
      agent: "scan-sec-filings", symbol, assetClass: "equity", direction: "watch",
      title: `${symbol} filed ${e.form}${e.items?.length ? ` (items ${e.items.join(", ")})` : ""}`,
      summary: `${e.company} filed ${e.form} on ${e.filedAt}.`,
      strength: e.form === "8-K" ? 0.5 : 0.65, refPrice: null,
      sources: [{ label: `${e.form} on EDGAR`, url: e.url }],
      dedupeKey: `sec:${symbol}:${e.form}:${e.url}`,
    });
  }
  return out;
}

// ---- sector momentum (sector ETFs vs SPY over 20 trading days) -----------------------------
export function detectSectorMomentum(sectors: Record<string, OhlcBar[]>, spy: OhlcBar[], top = 2): SignalDraft[] {
  const ret = (bars: OhlcBar[]) => (bars.length > 20 ? bars[bars.length - 1].close / bars[bars.length - 21].close - 1 : null);
  const base = ret(spy);
  if (base === null) return [];
  const ranked = Object.entries(sectors)
    .map(([symbol, bars]) => ({ symbol, bars, rel: (ret(bars) ?? NaN) - base }))
    .filter((r) => Number.isFinite(r.rel))
    .sort((a, b) => b.rel - a.rel);
  const leaders = ranked.slice(0, top).filter((r) => r.rel > 0);
  const laggards = ranked.slice(-top).filter((r) => r.rel < 0 && !leaders.includes(r));
  const mk = (r: (typeof ranked)[number], direction: "long" | "short"): SignalDraft => {
    const last = r.bars[r.bars.length - 1];
    return {
      agent: "scan-sector-momentum", symbol: r.symbol, assetClass: "etf", direction,
      title: `${r.symbol} ${direction === "long" ? "leads" : "lags"} SPY by ${pct(Math.abs(r.rel))} over 20 days`,
      summary: `Relative 20-day return ${pct(r.rel)} versus SPY as of ${last.date}.`,
      strength: clamp01(Math.abs(r.rel) / 0.1), refPrice: last.close,
      sources: [{ label: "Chart", url: chartUrl(r.symbol) }],
      dedupeKey: `sector:${r.symbol}:${last.date}`,
    };
  };
  return [...leaders.map((r) => mk(r, "long")), ...laggards.map((r) => mk(r, "short"))];
}

// ---- crypto volatility (recent realised vol vs its own history) ----------------------------
function realisedVol(closes: number[]): number {
  const r = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const m = r.reduce((a, b) => a + b, 0) / r.length;
  return Math.sqrt(r.reduce((a, b) => a + (b - m) ** 2, 0) / Math.max(1, r.length - 1));
}

export function detectCryptoVolatility(symbol: string, bars: OhlcBar[], ratio = 1.8): SignalDraft[] {
  if (bars.length < 40) return [];
  const closes = bars.map((b) => b.close);
  const recent = realisedVol(closes.slice(-8));
  const base = realisedVol(closes.slice(-38, -8));
  if (!(base > 0) || recent / base < ratio) return [];
  const last = bars[bars.length - 1];
  return [{
    agent: "scan-crypto-volatility", symbol, assetClass: "crypto", direction: "watch",
    title: `${symbol} volatility is ${(recent / base).toFixed(1)}x its 30-day norm`,
    summary: `7-day realised daily vol ${pct(recent)} against a 30-day baseline of ${pct(base)} as of ${last.date}.`,
    strength: clamp01((recent / base - 1) / 3), refPrice: last.close,
    sources: [{ label: "Chart", url: chartUrl(symbol) }],
    dedupeKey: `vol:${symbol}:${last.date}`,
  }];
}

// ---- commodity ETF trends (20/50 day averages) ---------------------------------------------
const sma = (closes: number[], n: number) => closes.slice(-n).reduce((a, b) => a + b, 0) / n;

export function detectCommodityTrend(symbol: string, bars: OhlcBar[]): SignalDraft[] {
  if (bars.length < 51) return [];
  const closes = bars.map((b) => b.close);
  const last = bars[bars.length - 1];
  const s20 = sma(closes, 20);
  const s50 = sma(closes, 50);
  const prev20 = sma(closes.slice(0, -1), 20);
  const prev50 = sma(closes.slice(0, -1), 50);
  const crossedUp = prev20 <= prev50 && s20 > s50;
  const crossedDown = prev20 >= prev50 && s20 < s50;
  if (!crossedUp && !crossedDown) return [];
  return [{
    agent: "scan-commodity-trends", symbol, assetClass: "etf", direction: crossedUp ? "long" : "short",
    title: `${symbol} 20-day average crossed ${crossedUp ? "above" : "below"} its 50-day`,
    summary: `20d ${s20.toFixed(2)} vs 50d ${s50.toFixed(2)}, close ${last.close.toFixed(2)} on ${last.date}.`,
    strength: clamp01(Math.abs(s20 / s50 - 1) / 0.03 + 0.3), refPrice: last.close,
    sources: [{ label: "Chart", url: chartUrl(symbol) }],
    dedupeKey: `trend:${symbol}:${last.date}`,
  }];
}

export const SECTOR_ETFS = ["XLK", "XLF", "XLE", "XLV", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE", "XLC"] as const;
export const COMMODITY_ETFS = ["GLD", "SLV", "USO", "UNG", "DBA", "CPER", "PDBC"] as const;
export const CRYPTO_PAIRS = ["X:BTCUSD", "X:ETHUSD", "X:SOLUSD"] as const;

/** Guard used before persisting: no source link, no signal. */
export function hasSource(s: SignalDraft): boolean {
  return s.sources.length > 0 && s.sources.every((x) => /^https:\/\//.test(x.url));
}
