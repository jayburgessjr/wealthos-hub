import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  IChartApi,
  ISeriesApi,
  LineStyle,
} from "lightweight-charts";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Search, Bell, Star, TrendingUp, TrendingDown, ChevronDown } from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Candle {
  time: number | string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

type Timeframe = "1D" | "5D" | "1M" | "3M" | "6M" | "1Y";
type OverlayIndicator = "SMA20" | "SMA50" | "EMA9" | "BB";
type SubPane = "RSI" | "MACD";

// ─── Indicator math ──────────────────────────────────────────────────────────

function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period) return result;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = ema;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

function calcBB(
  closes: number[],
  period: number,
  stdDevMult: number
): { upper: number | null; middle: number | null; lower: number | null }[] {
  return closes.map((_, i) => {
    if (i < period - 1) return { upper: null, middle: null, lower: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    return {
      upper: mean + stdDevMult * sd,
      middle: mean,
      lower: mean - stdDevMult * sd,
    };
  });
}

function calcRSI(closes: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length <= period) return result;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? Math.abs(diff) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return result;
}

function calcMACD(
  closes: number[],
  fast: number,
  slow: number,
  signalPeriod: number
): { macd: number | null; signal: number | null; histogram: number | null }[] {
  const result: { macd: number | null; signal: number | null; histogram: number | null }[] =
    new Array(closes.length).fill({ macd: null, signal: null, histogram: null });

  const emaFast = calcEMA(closes, fast);
  const emaSlow = calcEMA(closes, slow);

  const macdLine: (number | null)[] = closes.map((_, i) => {
    if (emaFast[i] === null || emaSlow[i] === null) return null;
    return (emaFast[i] as number) - (emaSlow[i] as number);
  });

  const macdValues = macdLine.filter((v) => v !== null) as number[];
  const firstMacdIdx = macdLine.findIndex((v) => v !== null);

  if (macdValues.length < signalPeriod) return result;

  const k = 2 / (signalPeriod + 1);
  let signalEma = macdValues.slice(0, signalPeriod).reduce((a, b) => a + b, 0) / signalPeriod;

  let sigIdx = firstMacdIdx + signalPeriod - 1;
  result[sigIdx] = {
    macd: macdLine[sigIdx],
    signal: signalEma,
    histogram: (macdLine[sigIdx] as number) - signalEma,
  };

  for (let i = sigIdx + 1; i < closes.length; i++) {
    if (macdLine[i] === null) continue;
    signalEma = (macdLine[i] as number) * k + signalEma * (1 - k);
    result[i] = {
      macd: macdLine[i],
      signal: signalEma,
      histogram: (macdLine[i] as number) - signalEma,
    };
  }

  return result;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1) + "B";
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(1) + "K";
  return v.toFixed(0);
}

function formatPrice(v: number): string {
  return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const CHART_COLORS = {
  bg: "transparent",
  text: "#7A8BA3",
  grid: "#1C253520",
  border: "#1C2535",
  up: "#00E5A0",
  down: "#FF4D6A",
  sma20: "#60a5fa",
  sma50: "#f59e0b",
  ema9: "#a78bfa",
  bb: "#64748b",
};

const TIMEFRAMES: Timeframe[] = ["1D", "5D", "1M", "3M", "6M", "1Y"];

const OVERLAY_INDICATORS: { key: OverlayIndicator; label: string; color: string }[] = [
  { key: "SMA20", label: "SMA 20", color: CHART_COLORS.sma20 },
  { key: "SMA50", label: "SMA 50", color: CHART_COLORS.sma50 },
  { key: "EMA9", label: "EMA 9", color: CHART_COLORS.ema9 },
  { key: "BB", label: "BB", color: CHART_COLORS.bb },
];

// ─── Chart Page ──────────────────────────────────────────────────────────────

export default function Chart() {
  const navigate = useNavigate();

  // State
  const [ticker, setTicker] = useState("SPY");
  const [inputValue, setInputValue] = useState("SPY");
  const [timeframe, setTimeframe] = useState<Timeframe>("1M");
  const [activeIndicators, setActiveIndicators] = useState<Set<OverlayIndicator>>(
    new Set(["SMA20", "SMA50"])
  );
  const [subPane, setSubPane] = useState<SubPane>("RSI");

  // Chart DOM refs
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const subContainerRef = useRef<HTMLDivElement>(null);

  // Chart instance refs
  const mainChartRef = useRef<IChartApi | null>(null);
  const subChartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // Overlay series refs
  const sma20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const sma50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema9Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const bbUpperRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbMiddleRef = useRef<ISeriesApi<"Line"> | null>(null);
  const bbLowerRef = useRef<ISeriesApi<"Line"> | null>(null);

  // Sub-pane series refs
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOBRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiOSRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdLineRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdSignalRef = useRef<ISeriesApi<"Line"> | null>(null);
  const macdHistRef = useRef<ISeriesApi<"Histogram"> | null>(null);

  // ─── Data fetching ──────────────────────────────────────────────────────────

  const { data: candles = [], isLoading, isError } = useQuery<Candle[]>({
    queryKey: ["chart", ticker, timeframe],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("get-price-data", {
        body: { ticker, timeframe },
      });
      if (error) throw error;
      return data?.candles ?? [];
    },
    onError: () => {
      toast.error(`Failed to load price data for ${ticker}`);
    },
    retry: 1,
    staleTime: 60_000,
  } as any);

  // ─── Computed indicators ─────────────────────────────────────────────────────

  const indicators = useMemo(() => {
    if (candles.length === 0) return null;
    const closes = candles.map((c) => c.close);
    return {
      sma20: calcSMA(closes, 20),
      sma50: calcSMA(closes, 50),
      ema9: calcEMA(closes, 9),
      bb: calcBB(closes, 20, 2),
      rsi: calcRSI(closes, 14),
      macd: calcMACD(closes, 12, 26, 9),
    };
  }, [candles]);

  // ─── Stats bar ───────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (candles.length < 2) return null;
    const last = candles[candles.length - 1];
    const prev = candles[candles.length - 2];
    const chg = last.close - prev.close;
    const chgPct = (chg / prev.close) * 100;
    const highs = candles.map((c) => c.high);
    const lows = candles.map((c) => c.low);
    return {
      price: last.close,
      chg,
      chgPct,
      volume: last.volume,
      high52: Math.max(...highs),
      low52: Math.min(...lows),
    };
  }, [candles]);

  // ─── Initialize charts ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!mainContainerRef.current || !subContainerRef.current) return;

    const mainChart = createChart(mainContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.bg },
        textColor: CHART_COLORS.text,
        fontFamily: "JetBrains Mono, monospace",
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      width: mainContainerRef.current.clientWidth,
      height: 380,
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: CHART_COLORS.border },
      timeScale: {
        borderColor: CHART_COLORS.border,
        visible: false,
      },
    });

    const subChart = createChart(subContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: CHART_COLORS.bg },
        textColor: CHART_COLORS.text,
        fontFamily: "JetBrains Mono, monospace",
      },
      grid: {
        vertLines: { color: CHART_COLORS.grid },
        horzLines: { color: CHART_COLORS.grid },
      },
      width: subContainerRef.current.clientWidth,
      height: 160,
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: CHART_COLORS.border },
      timeScale: { borderColor: CHART_COLORS.border },
    });

    // Sync time scales
    mainChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) subChart.timeScale().setVisibleLogicalRange(range);
    });
    subChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (range) mainChart.timeScale().setVisibleLogicalRange(range);
    });

    // Candle series
    const candleSeries = mainChart.addSeries(CandlestickSeries, {
      upColor: CHART_COLORS.up,
      downColor: CHART_COLORS.down,
      borderUpColor: CHART_COLORS.up,
      borderDownColor: CHART_COLORS.down,
      wickUpColor: CHART_COLORS.up + "80",
      wickDownColor: CHART_COLORS.down + "80",
    });

    // Volume series
    const volumeSeries = mainChart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0.85, bottom: 0 } });

    // Overlay line series
    const sma20 = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.sma20,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    const sma50 = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.sma50,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    const ema9 = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.ema9,
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    const bbUpper = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.bb,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    const bbMiddle = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.bb,
      lineWidth: 1,
      lineStyle: LineStyle.Dotted,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    const bbLower = mainChart.addSeries(LineSeries, {
      color: CHART_COLORS.bb,
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });

    // Sub-pane series — RSI
    const rsiSeries = subChart.addSeries(LineSeries, {
      color: "#a78bfa",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: true,
    });
    const rsiOB = subChart.addSeries(LineSeries, {
      color: "#FF4D6A50",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });
    const rsiOS = subChart.addSeries(LineSeries, {
      color: "#00E5A050",
      lineWidth: 1,
      lineStyle: LineStyle.Dashed,
      priceLineVisible: false,
      lastValueVisible: false,
    });

    // Sub-pane series — MACD
    const macdLine = subChart.addSeries(LineSeries, {
      color: "#60a5fa",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    const macdSignal = subChart.addSeries(LineSeries, {
      color: "#f59e0b",
      lineWidth: 1,
      priceLineVisible: false,
      lastValueVisible: false,
      visible: false,
    });
    const macdHist = subChart.addSeries(HistogramSeries, {
      priceFormat: { type: "price", precision: 4, minMove: 0.0001 },
      priceScaleId: "macd-hist",
      visible: false,
    });

    mainChartRef.current = mainChart;
    subChartRef.current = subChart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;
    sma20Ref.current = sma20;
    sma50Ref.current = sma50;
    ema9Ref.current = ema9;
    bbUpperRef.current = bbUpper;
    bbMiddleRef.current = bbMiddle;
    bbLowerRef.current = bbLower;
    rsiSeriesRef.current = rsiSeries;
    rsiOBRef.current = rsiOB;
    rsiOSRef.current = rsiOS;
    macdLineRef.current = macdLine;
    macdSignalRef.current = macdSignal;
    macdHistRef.current = macdHist;

    const handleResize = () => {
      if (mainContainerRef.current)
        mainChart.applyOptions({ width: mainContainerRef.current.clientWidth });
      if (subContainerRef.current)
        subChart.applyOptions({ width: subContainerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      mainChart.remove();
      subChart.remove();
    };
  }, []);

  // ─── Update chart data when candles change ───────────────────────────────────

  useEffect(() => {
    if (
      candles.length === 0 ||
      !candleSeriesRef.current ||
      !volumeSeriesRef.current ||
      !indicators
    )
      return;

    candleSeriesRef.current.setData(candles as any);
    volumeSeriesRef.current.setData(
      candles.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? CHART_COLORS.up + "30" : CHART_COLORS.down + "30",
      })) as any
    );

    // SMA20
    if (sma20Ref.current) {
      sma20Ref.current.setData(
        candles
          .map((c, i) => ({ time: c.time, value: indicators.sma20[i] }))
          .filter((p) => p.value !== null) as any
      );
    }
    // SMA50
    if (sma50Ref.current) {
      sma50Ref.current.setData(
        candles
          .map((c, i) => ({ time: c.time, value: indicators.sma50[i] }))
          .filter((p) => p.value !== null) as any
      );
    }
    // EMA9
    if (ema9Ref.current) {
      ema9Ref.current.setData(
        candles
          .map((c, i) => ({ time: c.time, value: indicators.ema9[i] }))
          .filter((p) => p.value !== null) as any
      );
    }
    // Bollinger Bands
    if (bbUpperRef.current && bbMiddleRef.current && bbLowerRef.current) {
      const bbUpper = candles
        .map((c, i) => ({ time: c.time, value: indicators.bb[i].upper }))
        .filter((p) => p.value !== null) as any;
      const bbMiddle = candles
        .map((c, i) => ({ time: c.time, value: indicators.bb[i].middle }))
        .filter((p) => p.value !== null) as any;
      const bbLower = candles
        .map((c, i) => ({ time: c.time, value: indicators.bb[i].lower }))
        .filter((p) => p.value !== null) as any;
      bbUpperRef.current.setData(bbUpper);
      bbMiddleRef.current.setData(bbMiddle);
      bbLowerRef.current.setData(bbLower);
    }

    // RSI
    if (rsiSeriesRef.current && rsiOBRef.current && rsiOSRef.current) {
      rsiSeriesRef.current.setData(
        candles
          .map((c, i) => ({ time: c.time, value: indicators.rsi[i] }))
          .filter((p) => p.value !== null) as any
      );
      const times = candles.map((c) => c.time);
      rsiOBRef.current.setData(times.map((t) => ({ time: t, value: 70 })) as any);
      rsiOSRef.current.setData(times.map((t) => ({ time: t, value: 30 })) as any);
    }

    // MACD
    if (macdLineRef.current && macdSignalRef.current && macdHistRef.current) {
      const macdLineData = candles
        .map((c, i) => ({ time: c.time, value: indicators.macd[i]?.macd }))
        .filter((p) => p.value !== null) as any;
      const macdSignalData = candles
        .map((c, i) => ({ time: c.time, value: indicators.macd[i]?.signal }))
        .filter((p) => p.value !== null) as any;
      const macdHistData = candles
        .map((c, i) => {
          const h = indicators.macd[i]?.histogram;
          if (h === null || h === undefined) return null;
          return {
            time: c.time,
            value: h,
            color: h >= 0 ? CHART_COLORS.up + "99" : CHART_COLORS.down + "99",
          };
        })
        .filter(Boolean) as any;

      macdLineRef.current.setData(macdLineData);
      macdSignalRef.current.setData(macdSignalData);
      macdHistRef.current.setData(macdHistData);
    }

    mainChartRef.current?.timeScale().fitContent();
    subChartRef.current?.timeScale().fitContent();
  }, [candles, indicators]);

  // ─── Toggle overlay indicators visibility ────────────────────────────────────

  useEffect(() => {
    if (!sma20Ref.current) return;
    sma20Ref.current.applyOptions({ visible: activeIndicators.has("SMA20") });
    sma50Ref.current?.applyOptions({ visible: activeIndicators.has("SMA50") });
    ema9Ref.current?.applyOptions({ visible: activeIndicators.has("EMA9") });
    const bbVisible = activeIndicators.has("BB");
    bbUpperRef.current?.applyOptions({ visible: bbVisible });
    bbMiddleRef.current?.applyOptions({ visible: bbVisible });
    bbLowerRef.current?.applyOptions({ visible: bbVisible });
  }, [activeIndicators]);

  // ─── Toggle sub-pane ─────────────────────────────────────────────────────────

  useEffect(() => {
    const showRsi = subPane === "RSI";
    rsiSeriesRef.current?.applyOptions({ visible: showRsi });
    rsiOBRef.current?.applyOptions({ visible: showRsi });
    rsiOSRef.current?.applyOptions({ visible: showRsi });
    macdLineRef.current?.applyOptions({ visible: !showRsi });
    macdSignalRef.current?.applyOptions({ visible: !showRsi });
    macdHistRef.current?.applyOptions({ visible: !showRsi });
  }, [subPane]);

  // ─── Handlers ─────────────────────────────────────────────────────────────────

  const handleSearch = useCallback(() => {
    const symbol = inputValue.trim().toUpperCase();
    if (symbol && symbol !== ticker) {
      setTicker(symbol);
    }
  }, [inputValue, ticker]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleSearch();
    },
    [handleSearch]
  );

  const toggleIndicator = useCallback((key: OverlayIndicator) => {
    setActiveIndicators((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleCreateAlert = useCallback(() => {
    navigate("/alerts");
  }, [navigate]);

  const handleAddToWatchlist = useCallback(() => {
    toast.success(`${ticker} added to watchlist`);
  }, [ticker]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  const isPositive = (stats?.chg ?? 0) >= 0;

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-4">

        {/* ── Top Control Bar ── */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Symbol search */}
          <div className="relative flex items-center">
            <Search className="absolute left-3 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value.toUpperCase())}
              onKeyDown={handleKeyDown}
              placeholder="Ticker…"
              className="h-8 w-32 pl-8 font-mono text-xs uppercase"
            />
            <Button
              size="sm"
              variant="ghost"
              className="ml-1 h-8 px-2 font-mono text-xs"
              onClick={handleSearch}
            >
              Go
            </Button>
          </div>

          {/* Ticker label */}
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-sm font-bold text-foreground">{ticker}</span>
            <Badge variant="outline" className="text-xs">
              {timeframe}
            </Badge>
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Timeframe buttons */}
          <div className="flex gap-1">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  tf === timeframe
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          <Separator orientation="vertical" className="h-5" />

          {/* Overlay indicator toggles */}
          <div className="flex flex-wrap gap-1">
            {OVERLAY_INDICATORS.map(({ key, label, color }) => (
              <button
                key={key}
                onClick={() => toggleIndicator(key)}
                className={`flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-sm transition-colors ${
                  activeIndicators.has(key)
                    ? "border-transparent bg-accent text-foreground"
                    : "border-border text-muted-foreground hover:border-accent"
                }`}
              >
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                {label}
              </button>
            ))}
          </div>

          {/* Action buttons */}
          <div className="ml-auto flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 font-mono text-xs"
              onClick={handleCreateAlert}
            >
              <Bell className="h-3.5 w-3.5" />
              Create Alert
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 font-mono text-xs"
              onClick={handleAddToWatchlist}
            >
              <Star className="h-3.5 w-3.5" />
              Add to Watchlist
            </Button>
          </div>
        </div>

        {/* ── Stats Bar ── */}
        <div className="bg-card border border-border rounded-lg px-4 py-2.5">
          {isLoading || !stats ? (
            <div className="flex gap-6">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-20" />
              ))}
            </div>
          ) : (
            <motion.div
              key={ticker + timeframe}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className="flex flex-wrap items-center gap-x-6 gap-y-1"
            >
              {/* Price */}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Price
                </span>
                <span className="font-mono text-base font-bold text-foreground">
                  ${formatPrice(stats.price)}
                </span>
              </div>

              {/* Change */}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Change
                </span>
                <span
                  className={`flex items-center gap-1 font-mono text-sm font-semibold ${
                    isPositive ? "text-bullish" : "text-bearish"
                  }`}
                >
                  {isPositive ? (
                    <TrendingUp className="h-3.5 w-3.5" />
                  ) : (
                    <TrendingDown className="h-3.5 w-3.5" />
                  )}
                  {isPositive ? "+" : ""}
                  {formatPrice(stats.chg)} ({isPositive ? "+" : ""}
                  {stats.chgPct.toFixed(2)}%)
                </span>
              </div>

              <Separator orientation="vertical" className="h-8 hidden sm:block" />

              {/* Volume */}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Volume
                </span>
                <span className="font-mono text-sm text-foreground">
                  {formatVolume(stats.volume)}
                </span>
              </div>

              {/* 52W High */}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Period High
                </span>
                <span className="font-mono text-sm text-bullish">
                  ${formatPrice(stats.high52)}
                </span>
              </div>

              {/* 52W Low */}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Period Low
                </span>
                <span className="font-mono text-sm text-bearish">
                  ${formatPrice(stats.low52)}
                </span>
              </div>

              {/* Candles count */}
              <div className="flex flex-col">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Bars
                </span>
                <span className="font-mono text-sm text-muted-foreground">{candles.length}</span>
              </div>
            </motion.div>
          )}
        </div>

        {/* ── Main Chart ── */}
        <div className="bg-card border border-border rounded-lg p-4 relative">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex flex-col gap-3 items-center justify-center bg-card/80 backdrop-blur-[1px] rounded-lg">
              <Skeleton className="h-[380px] w-full" />
            </div>
          )}
          {isError && !isLoading && (
            <div className="flex h-[380px] items-center justify-center text-muted-foreground font-mono text-sm">
              Failed to load chart data for{" "}
              <span className="ml-1 text-foreground font-bold">{ticker}</span>
            </div>
          )}
          <div ref={mainContainerRef} />
        </div>

        {/* ── Sub-Pane ── */}
        <div className="bg-card border border-border rounded-lg p-4 relative">
          {/* Sub-pane toggle */}
          <div className="mb-2 flex items-center gap-2">
            {(["RSI", "MACD"] as SubPane[]).map((pane) => (
              <button
                key={pane}
                onClick={() => setSubPane(pane)}
                className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                  pane === subPane
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                {pane === "RSI" ? "RSI (14)" : "MACD (12,26,9)"}
              </button>
            ))}
            <AnimatePresence mode="wait">
              <motion.span
                key={subPane}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-2 text-xs text-muted-foreground"
              >
                {subPane === "RSI"
                  ? "Overbought >70 · Oversold <30"
                  : "Blue = MACD · Amber = Signal · Bars = Histogram"}
              </motion.span>
            </AnimatePresence>
          </div>

          {isLoading && (
            <div className="absolute inset-x-4 bottom-4 z-10 bg-card/80 backdrop-blur-[1px] rounded">
              <Skeleton className="h-[160px] w-full" />
            </div>
          )}
          <div ref={subContainerRef} />
        </div>
      </div>
    </DashboardLayout>
  );
}
