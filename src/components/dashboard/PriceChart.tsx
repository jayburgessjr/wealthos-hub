import { useEffect, useRef } from "react";
import { createChart, ColorType, CandlestickSeries, HistogramSeries } from "lightweight-charts";
import { candlestickData } from "@/data/mockData";

export default function PriceChart() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#7A8BA3",
        fontFamily: "JetBrains Mono",
      },
      grid: {
        vertLines: { color: "#1C253520" },
        horzLines: { color: "#1C253520" },
      },
      width: containerRef.current.clientWidth,
      height: 340,
      crosshair: { mode: 0 },
      rightPriceScale: { borderColor: "#1C2535" },
      timeScale: { borderColor: "#1C2535" },
    });

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#00E5A0",
      downColor: "#FF4D6A",
      borderUpColor: "#00E5A0",
      borderDownColor: "#FF4D6A",
      wickUpColor: "#00E5A080",
      wickDownColor: "#FF4D6A80",
    });

    candleSeries.setData(candlestickData as any);

    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "",
    });

    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });

    volumeSeries.setData(
      candlestickData.map((d) => ({
        time: d.time,
        value: d.volume,
        color: d.close >= d.open ? "#00E5A030" : "#FF4D6A30",
      })) as any
    );

    // Signal markers via cast
    (candleSeries as any).setMarkers?.([
      { time: candlestickData[10]?.time, position: "belowBar", color: "#00E5A0", shape: "circle", text: "B" },
      { time: candlestickData[25]?.time, position: "aboveBar", color: "#FF4D6A", shape: "circle", text: "S" },
      { time: candlestickData[38]?.time, position: "belowBar", color: "#3D8EFF", shape: "circle", text: "B" },
    ]);

    chart.timeScale().fitContent();

    const handleResize = () => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth });
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.remove();
    };
  }, []);

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm font-bold text-foreground">NVDA</span>
          <span className="font-mono text-xs text-muted-foreground">NVIDIA Corp</span>
        </div>
        <div className="flex gap-1">
          {["1D", "5D", "1M", "3M", "1Y"].map((tf) => (
            <button
              key={tf}
              className={`rounded px-2 py-1 font-mono text-xs transition-fast ${
                tf === "3M" ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/50"
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
