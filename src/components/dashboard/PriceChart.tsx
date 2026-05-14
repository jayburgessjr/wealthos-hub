import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries, IChartApi, ISeriesApi } from "lightweight-charts";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface PriceChartProps {
  ticker?: string;
}

export default function PriceChart({ ticker = "SPY" }: PriceChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<"Histogram"> | null>(null);
  
  const { theme } = useTheme();
  const [timeframe, setTimeframe] = useState("1M");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const isDark = theme === "dark";

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: isDark ? "#7A8BA3" : "#64748B",
        fontFamily: "JetBrains Mono",
      },
      grid: {
        vertLines: { color: isDark ? "#1C253520" : "#E2E8F0" },
        horzLines: { color: isDark ? "#1C253520" : "#E2E8F0" },
      },
      width: containerRef.current.clientWidth,
      height: 340,
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: isDark ? "#1C2535" : "#E2E8F0" },
      timeScale: { borderColor: isDark ? "#1C2535" : "#E2E8F0" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00E5A0",
      downColor: "#FF4D6A",
      borderUpColor: "#00E5A0",
      borderDownColor: "#FF4D6A",
      wickUpColor: "#00E5A080",
      wickDownColor: "#FF4D6A80",
    });

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    chartRef.current = chart;
    candleSeriesRef.current = candleSeries;
    volumeSeriesRef.current = volumeSeries;

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, [theme]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        
        const { data, error } = await supabase.functions.invoke("get-price-data", {
          body: { ticker, timeframe },
        });

        if (error) {
          console.error("Supabase function error:", error);
          throw error;
        }
        
        if (data?.candles && candleSeriesRef.current && volumeSeriesRef.current) {
          candleSeriesRef.current.setData(data.candles);
          volumeSeriesRef.current.setData(
            data.candles.map((d: any) => ({
              time: d.time,
              value: d.volume,
              color: d.close >= d.open ? "#00E5A030" : "#FF4D6A30",
            }))
          );
          chartRef.current?.timeScale().fitContent();
        }
      } catch (err) {
        console.error("Error fetching price data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [ticker, timeframe]);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-foreground">{ticker}</span>
          <span className="font-mono text-xs text-muted-foreground uppercase">{timeframe} Chart</span>
        </div>
        <div className="flex gap-1">
          {["1D", "5D", "1M", "3M", "1Y"].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`rounded px-2 py-1 font-mono text-xs transition-fast ${
                tf === timeframe ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div className="relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/50 backdrop-blur-[1px]">
             <Skeleton className="h-[340px] w-full" />
          </div>
        )}
        <div ref={containerRef} />
      </div>
    </div>
  );
}
