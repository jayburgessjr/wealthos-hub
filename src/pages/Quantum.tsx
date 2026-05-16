import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Play, Loader2, ChevronDown, ChevronUp, AlertCircle,
  TrendingUp, TrendingDown, Shield, Zap, BarChart2, DollarSign,
  Plus, Trash2, RefreshCw
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { optimizePortfolio, type AssetInput, type QuantumResult } from "@/lib/quantumOptimizer";

// ── Default asset universe ─────────────────────────────────────────────────
const DEFAULT_ASSETS: (Omit<AssetInput, "price" | "changePct"> & { price: string; changePct: string })[] = [
  { symbol: "SPY",  price: "521.40",  changePct: "0.42",  assetClass: "equity"      },
  { symbol: "QQQ",  price: "445.20",  changePct: "0.61",  assetClass: "equity"      },
  { symbol: "BTC",  price: "68400",   changePct: "2.30",  assetClass: "crypto"      },
  { symbol: "ETH",  price: "3820",    changePct: "1.85",  assetClass: "crypto"      },
  { symbol: "GLD",  price: "225.10",  changePct: "-0.45", assetClass: "commodity"   },
  { symbol: "TLT",  price: "92.30",   changePct: "-0.21", assetClass: "bond"        },
  { symbol: "NVDA", price: "874.50",  changePct: "3.12",  assetClass: "equity"      },
  { symbol: "AAPL", price: "184.20",  changePct: "0.28",  assetClass: "equity"      },
];

const ASSET_CLASS_COLORS: Record<string, string> = {
  equity:      "#3D8EFF",
  crypto:      "#F59E0B",
  commodity:   "#FF6B35",
  bond:        "#8B5CF6",
  alternative: "#06B6D4",
};

// ── Simple donut chart ─────────────────────────────────────────────────────
function AllocationDonut({ slices }: { slices: { pct: number; color: string; label: string }[] }) {
  const R = 80; const CX = 100; const CY = 100; const stroke = 28;
  const circumference = 2 * Math.PI * R;
  let cumulativeAngle = -90;

  return (
    <svg viewBox="0 0 200 200" className="w-full max-w-[200px] mx-auto">
      {slices.map((s, i) => {
        const pct = Math.max(s.pct, 0.5);
        const dashArr = (pct / 100) * circumference;
        const dashOff = circumference - dashArr;
        const angle = cumulativeAngle;
        cumulativeAngle += (pct / 100) * 360;
        return (
          <circle
            key={i}
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${dashArr} ${dashOff}`}
            strokeDashoffset={-(angle / 360) * circumference}
            style={{ filter: `drop-shadow(0 0 4px ${s.color}50)` }}
          >
            <title>{s.label}: {s.pct.toFixed(1)}%</title>
          </circle>
        );
      })}
      <circle cx={CX} cy={CY} r={R - stroke / 2 - 2} fill="hsl(var(--background))" />
      <text x={CX} y={CY - 6} textAnchor="middle" fill="hsl(var(--foreground))" fontSize="11" fontWeight="bold" fontFamily="monospace">
        {slices.length}
      </text>
      <text x={CX} y={CY + 9} textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontFamily="monospace">
        ASSETS
      </text>
    </svg>
  );
}

// ── Metric card ────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className={`font-mono text-xl font-black mt-1 ${color ?? "text-foreground"}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Risk slider label ──────────────────────────────────────────────────────
function riskLabel(v: number): string {
  if (v <= 2) return "Ultra Conservative";
  if (v <= 4) return "Conservative";
  if (v <= 6) return "Balanced";
  if (v <= 8) return "Aggressive";
  return "Maximum Risk";
}

function riskColor(v: number): string {
  if (v <= 2) return "text-primary";
  if (v <= 4) return "text-bullish";
  if (v <= 6) return "text-watch";
  if (v <= 8) return "text-bearish";
  return "text-red-500";
}

// ─────────────────────────────────────────────────────────────────────────────
export default function Quantum() {
  const [capital, setCapital] = useState("100000");
  const [riskTolerance, setRiskTolerance] = useState(5);
  const [mcRuns, setMcRuns] = useState(2000);
  const [saIter, setSaIter] = useState(1000);
  const [assets, setAssets] = useState(DEFAULT_ASSETS);
  const [result, setResult] = useState<QuantumResult | null>(null);
  const [running, setRunning] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showAssetEditor, setShowAssetEditor] = useState(false);
  const [logLines, setLogLines] = useState<string[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  const addAsset = () => {
    setAssets(prev => [...prev, { symbol: "", price: "100", changePct: "0", assetClass: "equity" }]);
  };

  const removeAsset = (i: number) => {
    setAssets(prev => prev.filter((_, idx) => idx !== i));
  };

  const updateAsset = (i: number, field: string, value: string) => {
    setAssets(prev => prev.map((a, idx) => idx === i ? { ...a, [field]: value } : a));
  };

  const run = useCallback(async () => {
    const cap = parseFloat(capital.replace(/,/g, "")) || 100_000;
    const validAssets = assets
      .filter(a => a.symbol.trim())
      .map(a => ({
        symbol: a.symbol.trim().toUpperCase(),
        price: parseFloat(a.price) || 100,
        changePct: parseFloat(a.changePct) || 0,
        assetClass: a.assetClass,
      }));

    if (validAssets.length < 2) {
      alert("Add at least 2 assets to optimise.");
      return;
    }

    setRunning(true);
    setResult(null);
    setLogLines([]);

    // Animate log lines as if the engine is running
    const tempLog: string[] = [];
    const appendLog = (line: string) => {
      tempLog.push(line);
      setLogLines([...tempLog]);
      if (logRef.current) {
        logRef.current.scrollTop = logRef.current.scrollHeight;
      }
    };

    appendLog(`[QE] Quantum Decision Engine v2.1 initialising…`);
    await new Promise(r => setTimeout(r, 200));
    appendLog(`[QE] Assets: ${validAssets.map(a => a.symbol).join(", ")}`);
    await new Promise(r => setTimeout(r, 150));
    appendLog(`[QE] Capital: $${cap.toLocaleString()}  Risk: ${riskTolerance}/10`);
    await new Promise(r => setTimeout(r, 150));
    appendLog(`[MC] Seeding ${mcRuns} Monte Carlo paths (Box-Muller Gaussian)…`);
    await new Promise(r => setTimeout(r, 300));

    // Run the actual math (may take a moment for large runs)
    const res = await new Promise<QuantumResult>(resolve => {
      setTimeout(() => {
        resolve(optimizePortfolio(validAssets, cap, riskTolerance, mcRuns, saIter));
      }, 50);
    });

    for (const line of res.log.slice(2)) {
      appendLog(line);
      await new Promise(r => setTimeout(r, 80));
    }

    setResult(res);
    setRunning(false);
  }, [assets, capital, riskTolerance, mcRuns, saIter]);

  // Donut slices
  const donutSlices = result?.allocation.slice(0, 8).map(a => ({
    pct: a.percentage,
    color: ASSET_CLASS_COLORS[a.assetClass] ?? "#94a3b8",
    label: a.symbol,
  })) ?? [];

  return (
    <DashboardLayout>
      <SubscriptionGate>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Cpu size={12} className="text-muted-foreground" />
              <span className="text-xs uppercase tracking-widest text-muted-foreground">Portfolio Optimisation</span>
            </div>
            <h2 className="font-display text-3xl font-black tracking-tight">Quantum Decision Engine</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Monte Carlo simulation · Simulated Annealing · VaR / CVaR · Sharpe optimisation
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-1.5">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">QE v2.1</span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* ── Left panel: inputs ── */}
          <div className="space-y-4 xl:col-span-1">

            {/* Capital */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                <DollarSign size={14} /> Portfolio Parameters
              </h3>

              <div>
                <label className="text-xs uppercase tracking-widest text-muted-foreground">Capital ($)</label>
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-border bg-background px-4 py-3">
                  <span className="font-mono text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={capital}
                    onChange={e => setCapital(e.target.value)}
                    className="flex-1 bg-transparent font-mono text-sm text-foreground outline-none"
                    min="1000"
                    step="1000"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">Risk Tolerance</label>
                  <span className={`font-mono text-xs font-black ${riskColor(riskTolerance)}`}>
                    {riskTolerance}/10 — {riskLabel(riskTolerance)}
                  </span>
                </div>
                <input
                  type="range" min={1} max={10} step={1}
                  value={riskTolerance}
                  onChange={e => setRiskTolerance(Number(e.target.value))}
                  className="mt-2 w-full accent-current"
                  style={{ accentColor: riskTolerance <= 4 ? "#00cc73" : riskTolerance <= 6 ? "#F59E0B" : "#ef4444" }}
                />
                <div className="mt-1 flex justify-between text-xs text-muted-foreground/50">
                  <span>Min Risk</span><span>Balanced</span><span>Max Risk</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">MC Paths</label>
                  <select
                    value={mcRuns}
                    onChange={e => setMcRuns(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none"
                  >
                    {[500, 1000, 2000, 5000].map(v => <option key={v} value={v}>{v.toLocaleString()}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs uppercase tracking-widest text-muted-foreground">SA Iterations</label>
                  <select
                    value={saIter}
                    onChange={e => setSaIter(Number(e.target.value))}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 font-mono text-xs text-foreground outline-none"
                  >
                    {[500, 1000, 2000, 5000].map(v => <option key={v} value={v}>{v.toLocaleString()}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={run}
                disabled={running}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-mono text-sm font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {running ? (
                  <><Loader2 size={15} className="animate-spin" /> Running Engine…</>
                ) : (
                  <><Play size={15} /> Run Optimisation</>
                )}
              </button>
            </div>

            {/* Asset editor */}
            <div className="rounded-2xl border border-border bg-card">
              <button
                onClick={() => setShowAssetEditor(v => !v)}
                className="flex w-full items-center justify-between p-5"
              >
                <span className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                  <BarChart2 size={14} /> Asset Universe ({assets.length})
                </span>
                {showAssetEditor ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
              </button>

              <AnimatePresence>
                {showAssetEditor && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden border-t border-border"
                  >
                    <div className="space-y-2 p-4">
                      {assets.map((asset, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            value={asset.symbol}
                            onChange={e => updateAsset(i, "symbol", e.target.value.toUpperCase())}
                            placeholder="SYM"
                            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                          />
                          <input
                            value={asset.price}
                            onChange={e => updateAsset(i, "price", e.target.value)}
                            placeholder="Price"
                            className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                          />
                          <input
                            value={asset.changePct}
                            onChange={e => updateAsset(i, "changePct", e.target.value)}
                            placeholder="%chg"
                            className="w-16 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                          />
                          <select
                            value={asset.assetClass}
                            onChange={e => updateAsset(i, "assetClass", e.target.value)}
                            className="flex-1 rounded-lg border border-border bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none"
                          >
                            {["equity", "crypto", "commodity", "bond", "alternative"].map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                          <button onClick={() => removeAsset(i)} className="text-muted-foreground hover:text-bearish">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={addAsset}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Plus size={12} /> Add Asset
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* ── Right panel: results ── */}
          <div className="space-y-4 xl:col-span-2">

            {/* Engine log */}
            {logLines.length > 0 && (
              <div className="rounded-2xl border border-border bg-card">
                <button
                  onClick={() => setShowLog(v => !v)}
                  className="flex w-full items-center justify-between p-4"
                >
                  <span className="flex items-center gap-2 font-mono text-xs font-bold text-muted-foreground uppercase tracking-widest">
                    <Cpu size={12} /> Engine Log ({logLines.length} lines)
                  </span>
                  {showLog ? <ChevronUp size={13} className="text-muted-foreground" /> : <ChevronDown size={13} className="text-muted-foreground" />}
                </button>
                <AnimatePresence>
                  {showLog && (
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: "auto" }}
                      exit={{ height: 0 }}
                      className="overflow-hidden border-t border-border"
                    >
                      <div
                        ref={logRef}
                        className="max-h-48 overflow-y-auto p-4 space-y-0.5"
                      >
                        {logLines.map((line, i) => (
                          <p key={i} className={`text-xs ${
                            line.startsWith("[QE]") ? "text-primary" :
                            line.startsWith("[MC]") ? "text-watch" :
                            line.startsWith("[SA]") ? "text-bullish" :
                            line.startsWith("[RM]") ? "text-purple-400" :
                            "text-muted-foreground"
                          }`}>{line}</p>
                        ))}
                        {running && (
                          <p className="text-xs text-muted-foreground animate-pulse">…</p>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {/* Placeholder */}
            {!result && !running && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border py-24 text-center">
                <Cpu size={40} className="text-muted-foreground/20" />
                <div>
                  <p className="font-display text-sm font-bold text-foreground">Quantum Engine Ready</p>
                  <p className="mt-1 text-xs text-muted-foreground">Configure parameters and press Run to optimise your portfolio</p>
                </div>
                <button onClick={run} className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-5 py-2.5 font-mono text-xs font-bold text-primary hover:brightness-110">
                  <Play size={12} /> Run with defaults
                </button>
              </div>
            )}

            {/* Results */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Key metrics */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <MetricCard
                      label="Expected Return"
                      value={`${result.expectedReturn >= 0 ? "+" : ""}${result.expectedReturn.toFixed(2)}%`}
                      sub="Annualised"
                      color={result.expectedReturn >= 0 ? "text-bullish" : "text-bearish"}
                    />
                    <MetricCard
                      label="Sharpe Ratio"
                      value={result.sharpeRatio.toFixed(3)}
                      sub={result.sharpeRatio > 1 ? "Excellent" : result.sharpeRatio > 0.5 ? "Good" : "Below benchmark"}
                      color={result.sharpeRatio > 1 ? "text-bullish" : result.sharpeRatio > 0.5 ? "text-watch" : "text-bearish"}
                    />
                    <MetricCard
                      label="VaR 95%"
                      value={`${result.var95.toFixed(2)}%`}
                      sub="1-year max loss (95% CI)"
                      color="text-bearish"
                    />
                    <MetricCard
                      label="CVaR 95%"
                      value={`${result.cvar95.toFixed(2)}%`}
                      sub="Expected tail loss"
                      color="text-red-400"
                    />
                    <MetricCard
                      label="Max Drawdown Est."
                      value={`${result.maxDrawdownEst.toFixed(2)}%`}
                      sub="2× annual vol proxy"
                      color="text-bearish"
                    />
                    <MetricCard
                      label="MC Runs"
                      value={result.monteCarloRuns.toLocaleString()}
                      sub={`+ ${result.iterations.toLocaleString()} SA iterations`}
                      color="text-primary"
                    />
                  </div>

                  {/* Agent summary */}
                  <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Zap size={13} className="text-primary" />
                      <span className="text-xs uppercase tracking-widest text-primary font-bold">Agent Summary</span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed">{result.agentSummary}</p>
                  </div>

                  {/* Allocation */}
                  <div className="rounded-2xl border border-border bg-card p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-sm font-bold text-foreground flex items-center gap-2">
                        <Shield size={14} /> Optimal Allocation
                      </h3>
                      <button
                        onClick={run}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <RefreshCw size={10} /> Re-run
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      {/* Donut */}
                      <AllocationDonut slices={donutSlices} />

                      {/* Legend */}
                      <div className="space-y-1.5">
                        {result.allocation.map((slice, i) => {
                          const color = ASSET_CLASS_COLORS[slice.assetClass] ?? "#94a3b8";
                          return (
                            <motion.div
                              key={slice.symbol}
                              initial={{ opacity: 0, x: 8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-center gap-3"
                            >
                              <div className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="font-mono text-xs font-bold text-foreground w-14 shrink-0">{slice.symbol}</span>
                              <div className="flex-1">
                                <div className="h-1 overflow-hidden rounded-full bg-border/40">
                                  <div
                                    className="h-full rounded-full"
                                    style={{ width: `${slice.percentage}%`, backgroundColor: color, boxShadow: `0 0 4px ${color}50` }}
                                  />
                                </div>
                              </div>
                              <span className="font-mono text-xs font-black w-12 text-right" style={{ color }}>
                                {slice.percentage.toFixed(1)}%
                              </span>
                              <span className="text-xs text-muted-foreground w-20 text-right">
                                ${slice.dollarAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Per-asset detail table */}
                  <div className="overflow-x-auto rounded-2xl border border-border bg-card">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="border-b border-border">
                          {["Asset", "Class", "Weight", "$ Amount", "24h Chg", "Reasoning"].map(h => (
                            <th key={h} className="px-4 py-3 text-xs uppercase tracking-widest text-muted-foreground">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.allocation.map((slice, i) => {
                          const asset = assets.find(a => a.symbol === slice.symbol);
                          const chg = parseFloat(asset?.changePct ?? "0");
                          const color = ASSET_CLASS_COLORS[slice.assetClass] ?? "#94a3b8";
                          return (
                            <motion.tr
                              key={slice.symbol}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.04 }}
                              className="border-b border-border/40 transition-colors hover:bg-accent/20"
                            >
                              <td className="px-4 py-3 font-mono text-sm font-black text-foreground">{slice.symbol}</td>
                              <td className="px-4 py-3">
                                <span className="rounded-full px-2 py-0.5 text-xs font-bold capitalize"
                                  style={{ color, background: `${color}18` }}>{slice.assetClass}</span>
                              </td>
                              <td className="px-4 py-3 font-mono text-sm font-black" style={{ color }}>
                                {slice.percentage.toFixed(2)}%
                              </td>
                              <td className="px-4 py-3 font-mono text-sm text-foreground">
                                ${slice.dollarAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </td>
                              <td className="px-4 py-3">
                                <span className={`flex items-center gap-1 font-mono text-sm font-bold ${chg >= 0 ? "text-bullish" : "text-bearish"}`}>
                                  {chg >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                  {chg >= 0 ? "+" : ""}{chg.toFixed(2)}%
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-muted-foreground max-w-xs">{slice.reasoning}</td>
                            </motion.tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Disclaimer */}
                  <div className="flex items-start gap-3 rounded-xl border border-border bg-accent/20 p-4">
                    <AlertCircle size={13} className="mt-0.5 shrink-0 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Quantum engine uses Monte Carlo simulation and Simulated Annealing — classical algorithms, not real quantum computing.
                      Volatility is inferred from 24h price change. Feed in real historical return data for production-grade results.
                      This is not financial advice.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
