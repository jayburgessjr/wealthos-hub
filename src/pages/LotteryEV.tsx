import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Ticket, Calculator, Info, TrendingUp, TrendingDown, Plus, Minus, ChevronRight } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";

// ── Strategy Brief ─────────────────────────────────────────────────────────────
function StrategyBrief() {
  return (
    <div className="rounded-xl border border-bearish/40 bg-card px-4 py-3 space-y-3" style={{ borderLeftWidth: "4px", borderLeftColor: "hsl(var(--bearish))" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-bearish/40 bg-bearish/10 px-3 py-1">
            <TrendingDown size={12} className="text-bearish" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-bearish">NEGATIVE EV</span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-xl">
            All lotteries currently negative EV. Powerball needs $1.2B+ jackpot to reach break-even EV. Use parlay calculator to find positive EV sports bets instead.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link to="/position-sizer" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            Position Sizer <ChevronRight size={11} />
          </Link>
          <Link to="/alerts" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            Set Alert <ChevronRight size={11} />
          </Link>
          <Link to="/decisions" className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1.5 font-mono text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            Decision Hub <ChevronRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────
interface Lottery {
  name: string;
  logo: string;
  jackpot: number;
  ticketPrice: number;
  oddsJackpot: number;
  oddsMillion: number;          // odds of winning $1M (second prize tier)
  taxRate: number;
  lumpSumPct: number;
  nextDraw: string;
  color: string;
}

interface ParlayLeg {
  id: number;
  odds: string;
  prob: string;
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const LOTTERIES: Lottery[] = [
  {
    name: "Powerball",
    logo: "🔴",
    jackpot: 500_000_000,
    ticketPrice: 2,
    oddsJackpot: 292_201_338,
    oddsMillion: 11_688_054,
    taxRate: 0.37,
    lumpSumPct: 0.60,
    nextDraw: "Saturday",
    color: "#FF4D6A",
  },
  {
    name: "Mega Millions",
    logo: "🟡",
    jackpot: 340_000_000,
    ticketPrice: 2,
    oddsJackpot: 302_575_350,
    oddsMillion: 12_607_306,
    taxRate: 0.37,
    lumpSumPct: 0.60,
    nextDraw: "Tuesday & Friday",
    color: "#F59E0B",
  },
  {
    name: "EuroMillions",
    logo: "🇪🇺",
    jackpot: 65_000_000,
    ticketPrice: 2.50,
    oddsJackpot: 139_838_160,
    oddsMillion: 6_991_908,
    taxRate: 0.00,       // tax-free in many EU countries; varies
    lumpSumPct: 1.00,    // paid in full (no lump-sum discount)
    nextDraw: "Tuesday & Friday",
    color: "#3B82F6",
  },
];

function calcEV(lottery: Lottery, customJackpot?: number) {
  const jackpot = customJackpot ?? lottery.jackpot;
  const lumpSum  = jackpot * lottery.lumpSumPct;
  const afterTax = lumpSum * (1 - lottery.taxRate);
  const jackpotEV = afterTax / lottery.oddsJackpot;
  const milEV     = (1_000_000 * (1 - lottery.taxRate)) / lottery.oddsMillion;
  const totalEV   = jackpotEV + milEV;
  const netEV     = totalEV - lottery.ticketPrice;
  return { lumpSum, afterTax, jackpotEV, milEV, totalEV, netEV };
}

function fmtMoney(n: number, prefix = "$") {
  if (n >= 1_000_000_000) return `${prefix}${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000)     return `${prefix}${(n / 1_000_000).toFixed(0)}M`;
  if (n >= 1_000)         return `${prefix}${(n / 1_000).toFixed(0)}K`;
  return `${prefix}${Math.abs(n).toFixed(4)}`;
}

// ── Parlay EV helpers ──────────────────────────────────────────────────────────
function americanToDecimal(odds: number): number {
  if (odds > 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}
function americanToImplied(odds: number): number {
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

export default function LotteryEV() {
  // Jackpot calculator state
  const [lotteryIdx, setLotteryIdx]   = useState(0);
  const [customJackpot, setCustomJackpot] = useState("");
  const [taxRate, setTaxRate]         = useState("");
  const [lumpSumPct, setLumpSumPct]   = useState("");
  const [tickets, setTickets]         = useState("1");

  // Parlay calculator state
  const [parlayLegs, setParlayLegs]   = useState<ParlayLeg[]>([
    { id: 1, odds: "-110", prob: "52.4" },
    { id: 2, odds: "-110", prob: "52.4" },
  ]);
  const [parlayBet, setParlayBet]     = useState("100");

  const lottery = LOTTERIES[lotteryIdx];

  const ev = useMemo(() => {
    const overrides = { ...lottery };
    if (customJackpot) overrides.jackpot = parseFloat(customJackpot) * 1_000_000;
    if (taxRate)       overrides.taxRate = parseFloat(taxRate) / 100;
    if (lumpSumPct)    overrides.lumpSumPct = parseFloat(lumpSumPct) / 100;
    return calcEV(overrides);
  }, [lottery, customJackpot, taxRate, lumpSumPct]);

  const numTickets = parseInt(tickets) || 1;
  const totalCost  = numTickets * lottery.ticketPrice;
  const totalExpectedReturn = numTickets * ev.totalEV;
  const totalLoss  = totalCost - totalExpectedReturn;

  // Parlay calculations
  const parlayCalc = useMemo(() => {
    const validLegs = parlayLegs.filter(l => l.odds !== "" && l.prob !== "");
    if (validLegs.length < 2) return null;

    const decimalOdds = validLegs.map(l => americanToDecimal(parseFloat(l.odds) || -110));
    const impliedProbs = validLegs.map(l => americanToImplied(parseFloat(l.odds) || -110));
    const trueProbs    = validLegs.map(l => parseFloat(l.prob) / 100 || 0);

    const combinedDecimal  = decimalOdds.reduce((a, b) => a * b, 1);
    const combinedImplied  = impliedProbs.reduce((a, b) => a * b, 1);
    const combinedTrue     = trueProbs.reduce((a, b) => a * b, 1);

    const americanPayout = combinedDecimal >= 2
      ? (combinedDecimal - 1) * 100
      : -(100 / (combinedDecimal - 1));

    const ev = combinedTrue * (combinedDecimal - 1) - (1 - combinedTrue);
    const bet = parseFloat(parlayBet) || 100;
    const expectedProfit = bet * ev;

    return { combinedDecimal, combinedImplied: combinedImplied * 100, combinedTrue: combinedTrue * 100, americanPayout, ev: ev * 100, expectedProfit };
  }, [parlayLegs, parlayBet]);

  function addLeg() {
    const nextId = Math.max(...parlayLegs.map(l => l.id)) + 1;
    setParlayLegs(prev => [...prev, { id: nextId, odds: "-110", prob: "52.4" }]);
  }
  function removeLeg(id: number) {
    if (parlayLegs.length <= 2) return;
    setParlayLegs(prev => prev.filter(l => l.id !== id));
  }
  function updateLeg(id: number, field: "odds" | "prob", value: string) {
    setParlayLegs(prev => prev.map(l => l.id === id ? { ...l, [field]: value } : l));
  }

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <div className="space-y-6">

        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Ticket size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Expected Value Tools</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Lottery & Parlay EV</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Calculate expected value for lottery tickets and sports parlays
          </p>
        </div>

        {/* Strategy Brief */}
        <StrategyBrief />

        {/* ── Current lotteries table ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="overflow-hidden rounded-2xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-muted-foreground">Current Major Lotteries</h3>
          </div>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-border">
                {["Lottery", "Jackpot", "Next Draw", "Ticket", "EV per Ticket", "Recommendation"].map(h => (
                  <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {LOTTERIES.map((l, i) => {
                const evData = calcEV(l);
                const positive = evData.netEV >= 0;
                return (
                  <motion.tr key={l.name}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.06 }}
                    className="border-b border-border/40 transition-colors hover:bg-accent/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{l.logo}</span>
                        <div>
                          <p className="font-bold text-foreground">{l.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">1 in {(l.oddsJackpot / 1_000_000).toFixed(0)}M jackpot odds</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm font-black text-foreground">{fmtMoney(l.jackpot)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{l.nextDraw}</td>
                    <td className="px-4 py-3 font-mono text-sm text-foreground">${l.ticketPrice.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 font-mono text-sm font-bold ${positive ? "text-bullish" : "text-bearish"}`}>
                        {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                        {evData.netEV >= 0 ? "+" : ""}${evData.netEV.toFixed(4)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 font-mono text-xs font-bold uppercase ${
                        positive ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
                      }`}>
                        {positive ? "Play — EV+" : "Skip — EV–"}
                      </span>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

          {/* ── EV Calculator ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Calculator size={14} className="text-primary" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">Lottery EV Calculator</h3>
            </div>

            {/* Lottery selector */}
            <div className="flex gap-2">
              {LOTTERIES.map((l, i) => (
                <button key={l.name} onClick={() => { setLotteryIdx(i); setCustomJackpot(""); setTaxRate(""); setLumpSumPct(""); }}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-xs font-bold transition-all ${
                    lotteryIdx === i ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {l.logo} {l.name}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Jackpot ($M)</label>
                <input type="number" value={customJackpot} onChange={e => setCustomJackpot(e.target.value)}
                  placeholder={`${(lottery.jackpot / 1_000_000).toFixed(0)}`}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Tax Rate (%)</label>
                <input type="number" value={taxRate} onChange={e => setTaxRate(e.target.value)}
                  placeholder={`${(lottery.taxRate * 100).toFixed(0)}`}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Lump Sum (%)</label>
                <input type="number" value={lumpSumPct} onChange={e => setLumpSumPct(e.target.value)}
                  placeholder={`${(lottery.lumpSumPct * 100).toFixed(0)}`}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Tickets</label>
                <input type="number" value={tickets} onChange={e => setTickets(e.target.value)}
                  placeholder="1"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
            </div>

            {/* Results */}
            <div className="space-y-2 rounded-xl border border-border bg-background p-4">
              {[
                { label: "Jackpot (advertised)",  value: fmtMoney(customJackpot ? parseFloat(customJackpot) * 1_000_000 : lottery.jackpot), color: "text-foreground" },
                { label: "Lump Sum",              value: fmtMoney(ev.lumpSum),       color: "text-foreground" },
                { label: "After Tax",             value: fmtMoney(ev.afterTax),      color: "text-foreground" },
                { label: "EV from jackpot",       value: `$${ev.jackpotEV.toFixed(6)}`, color: "text-muted-foreground" },
                { label: "EV from $1M prize",     value: `$${ev.milEV.toFixed(6)}`,     color: "text-muted-foreground" },
                { label: "Total EV per ticket",   value: `$${ev.totalEV.toFixed(6)}`,   color: "text-foreground" },
                { label: `Net EV (vs $${lottery.ticketPrice} ticket)`, value: `${ev.netEV >= 0 ? "+" : ""}$${ev.netEV.toFixed(4)}`, color: ev.netEV >= 0 ? "text-bullish" : "text-bearish" },
                { label: "Total Cost",            value: `$${totalCost.toFixed(2)}`,   color: "text-foreground" },
                { label: "Expected Return",       value: `$${totalExpectedReturn.toFixed(4)}`, color: "text-foreground" },
                { label: "Expected Loss",         value: `–$${totalLoss.toFixed(2)}`,   color: "text-bearish" },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{row.label}</span>
                  <span className={`font-mono text-sm font-bold ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* ── Parlay EV Calculator ── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="rounded-2xl border border-border bg-card p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Calculator size={14} className="text-primary" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">Parlay EV Calculator</h3>
            </div>
            <p className="text-xs text-muted-foreground">Add parlay legs with American odds and your estimated true probabilities.</p>

            {/* Legs */}
            <div className="space-y-2">
              {parlayLegs.map((leg, i) => (
                <div key={leg.id} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center font-mono text-xs text-muted-foreground">{i + 1}</span>
                  <input type="number" value={leg.odds} onChange={e => updateLeg(leg.id, "odds", e.target.value)}
                    placeholder="Odds (e.g. -110)"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" />
                  <input type="number" value={leg.prob} onChange={e => updateLeg(leg.id, "prob", e.target.value)}
                    placeholder="True % (e.g. 52.4)"
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs text-foreground focus:border-primary focus:outline-none" />
                  <button onClick={() => removeLeg(leg.id)}
                    className="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:border-bearish hover:text-bearish">
                    <Minus size={12} />
                  </button>
                </div>
              ))}
              <button onClick={addLeg}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border py-2 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                <Plus size={12} /> Add Leg
              </button>
            </div>

            <div>
              <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Bet Size ($)</label>
              <input type="number" value={parlayBet} onChange={e => setParlayBet(e.target.value)}
                placeholder="100"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
            </div>

            {parlayCalc && (
              <div className="space-y-2 rounded-xl border border-border bg-background p-4">
                {[
                  { label: "Combined Decimal Odds", value: `${parlayCalc.combinedDecimal.toFixed(2)}x`,              color: "text-foreground" },
                  { label: "American Payout",        value: parlayCalc.americanPayout > 0 ? `+${parlayCalc.americanPayout.toFixed(0)}` : `${parlayCalc.americanPayout.toFixed(0)}`, color: "text-foreground" },
                  { label: "Sportsbook Implied Prob",value: `${parlayCalc.combinedImplied.toFixed(2)}%`,              color: "text-muted-foreground" },
                  { label: "Your Combined Prob",     value: `${parlayCalc.combinedTrue.toFixed(2)}%`,                 color: "text-foreground" },
                  { label: "EV per $100",            value: `${parlayCalc.ev >= 0 ? "+" : ""}$${parlayCalc.ev.toFixed(2)}`, color: parlayCalc.ev >= 0 ? "text-bullish" : "text-bearish" },
                  { label: "Expected Profit",        value: `${parlayCalc.expectedProfit >= 0 ? "+" : ""}$${parlayCalc.expectedProfit.toFixed(2)}`, color: parlayCalc.expectedProfit >= 0 ? "text-bullish" : "text-bearish" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{row.label}</span>
                    <span className={`font-mono text-sm font-bold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
                <div className={`mt-3 rounded-lg py-2 text-center font-mono text-xs font-bold uppercase tracking-wider ${
                  parlayCalc.ev >= 0 ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
                }`}>
                  {parlayCalc.ev >= 0 ? "✓ Positive EV Parlay" : "✗ Negative EV Parlay"}
                </div>
              </div>
            )}
          </motion.div>

        </div>

        {/* ── Educational section ── */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="rounded-2xl border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Info size={14} className="text-primary" />
            <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">How Lottery EV Works</h3>
          </div>
          <div className="grid grid-cols-1 gap-4 text-sm text-muted-foreground sm:grid-cols-3">
            <div className="space-y-2 rounded-xl border border-border p-4">
              <p className="font-bold text-foreground">1. Jackpot → Lump Sum</p>
              <p>The advertised jackpot is the annuity value. The cash option (lump sum) is typically ~60% of the advertised amount.</p>
              <p className="font-mono text-xs text-foreground">$500M × 60% = $300M lump sum</p>
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <p className="font-bold text-foreground">2. Tax Impact</p>
              <p>Federal income tax (37% top bracket) plus state taxes reduce your actual take-home. EV is always calculated on after-tax amounts.</p>
              <p className="font-mono text-xs text-foreground">$300M × (1 − 0.37) = $189M</p>
            </div>
            <div className="space-y-2 rounded-xl border border-border p-4">
              <p className="font-bold text-foreground">3. Expected Value</p>
              <p>EV = (after-tax jackpot ÷ odds). For most jackpots under ~$900M, EV per ticket is negative — the lottery always has the edge.</p>
              <p className="font-mono text-xs text-foreground">$189M ÷ 292M = $0.647 EV on $2 ticket</p>
            </div>
          </div>
        </motion.div>

      </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
