import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Trophy, Calculator, AlertCircle, ChevronRight, TrendingUp } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";

// ── Strategy Brief ─────────────────────────────────────────────────────────────
function StrategyBrief() {
  return (
    <div className="rounded-xl border border-bullish/40 bg-card px-4 py-3 space-y-3" style={{ borderLeftWidth: "4px", borderLeftColor: "hsl(var(--bullish))" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-bullish/40 bg-bullish/10 px-3 py-1">
            <TrendingUp size={12} className="text-bullish" />
            <span className="font-mono text-xs font-black uppercase tracking-wider text-bullish">3 POSITIVE EV BETS TODAY</span>
          </div>
          <p className="text-xs text-muted-foreground leading-snug max-w-xl">
            Kelly Criterion analysis found 3 bets with positive expected value. Never bet more than 2% of bankroll per game. Treat like any other speculative position.
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

// ── Top EV Bets ───────────────────────────────────────────────────────────────
// Positive EV: our true probability estimate exceeds the sportsbook implied probability
const TOP_EV_BETS = [
  { matchup: "OKC Thunder vs Boston Celtics", pick: "OKC Thunder ML", odds: "+105", impliedProb: "48.8%", trueProb: "54%",  edge: "+5.2%",  ev: "+$5.72" },
  { matchup: "KC Chiefs vs Baltimore Ravens",  pick: "Ravens ML",     odds: "+122", impliedProb: "45.0%", trueProb: "51%",  edge: "+6.0%",  ev: "+$7.32" },
  { matchup: "Djokovic vs Alcaraz",            pick: "Djokovic ML",   odds: "+120", impliedProb: "45.5%", trueProb: "50%",  edge: "+4.5%",  ev: "+$4.55" },
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface SportsEvent {
  id: string;
  sport: "NFL" | "NBA" | "MLB" | "Soccer" | "Tennis";
  homeTeam: string;
  awayTeam: string;
  commenceTime: string;
  moneylineHome: number;   // American odds
  moneylineAway: number;
  spreadHome: number;      // e.g. -3.5
  spreadOdds: number;      // odds for the spread (typically -110)
  total: number;           // over/under line
  totalOdds: number;       // typically -110
}

// ── Mock data ──────────────────────────────────────────────────────────────────
const EVENTS: SportsEvent[] = [
  // NFL
  { id: "nfl-1", sport: "NFL",    homeTeam: "Kansas City Chiefs",     awayTeam: "Baltimore Ravens",    commenceTime: "Sun 4:25 PM ET", moneylineHome: -145, moneylineAway: +122, spreadHome: -3.0, spreadOdds: -110, total: 48.5, totalOdds: -110 },
  { id: "nfl-2", sport: "NFL",    homeTeam: "Philadelphia Eagles",    awayTeam: "Dallas Cowboys",      commenceTime: "Mon 8:15 PM ET", moneylineHome: -180, moneylineAway: +155, spreadHome: -4.5, spreadOdds: -108, total: 44.0, totalOdds: -112 },
  { id: "nfl-3", sport: "NFL",    homeTeam: "San Francisco 49ers",    awayTeam: "Seattle Seahawks",    commenceTime: "Sun 1:00 PM ET", moneylineHome: -200, moneylineAway: +168, spreadHome: -5.5, spreadOdds: -110, total: 41.5, totalOdds: -110 },
  // NBA
  { id: "nba-1", sport: "NBA",    homeTeam: "OKC Thunder",            awayTeam: "Boston Celtics",      commenceTime: "Tonight 7:30 PM ET", moneylineHome: +105, moneylineAway: -125, spreadHome: +1.5, spreadOdds: -110, total: 218.5, totalOdds: -110 },
  { id: "nba-2", sport: "NBA",    homeTeam: "Cleveland Cavaliers",    awayTeam: "Indiana Pacers",      commenceTime: "Tonight 8:00 PM ET", moneylineHome: -155, moneylineAway: +132, spreadHome: -3.5, spreadOdds: -115, total: 224.0, totalOdds: -105 },
  { id: "nba-3", sport: "NBA",    homeTeam: "Minnesota Timberwolves", awayTeam: "Phoenix Suns",        commenceTime: "Tonight 9:00 PM ET", moneylineHome: -225, moneylineAway: +185, spreadHome: -6.0, spreadOdds: -110, total: 211.5, totalOdds: -110 },
  // MLB
  { id: "mlb-1", sport: "MLB",    homeTeam: "New York Yankees",       awayTeam: "Houston Astros",      commenceTime: "Today 7:05 PM ET",   moneylineHome: -135, moneylineAway: +115, spreadHome: -1.5, spreadOdds: -130, total: 8.5,  totalOdds: -115 },
  { id: "mlb-2", sport: "MLB",    homeTeam: "Los Angeles Dodgers",    awayTeam: "Atlanta Braves",      commenceTime: "Today 10:10 PM ET",  moneylineHome: -165, moneylineAway: +140, spreadHome: -1.5, spreadOdds: -145, total: 9.0,  totalOdds: -110 },
  // Soccer
  { id: "soc-1", sport: "Soccer", homeTeam: "Manchester City",        awayTeam: "Arsenal",             commenceTime: "Sat 7:30 AM ET",     moneylineHome: -110, moneylineAway: +310, spreadHome: -0.5, spreadOdds: -155, total: 2.5,  totalOdds: -115 },
  { id: "soc-2", sport: "Soccer", homeTeam: "Real Madrid",            awayTeam: "Barcelona",           commenceTime: "Sat 3:00 PM ET",     moneylineHome: -130, moneylineAway: +370, spreadHome: -0.5, spreadOdds: -180, total: 2.5,  totalOdds: -120 },
  // Tennis
  { id: "ten-1", sport: "Tennis", homeTeam: "Novak Djokovic",         awayTeam: "Carlos Alcaraz",      commenceTime: "Fri 2:00 PM ET",     moneylineHome: +120, moneylineAway: -145, spreadHome: 0,    spreadOdds: 0,    total: 0,    totalOdds: 0    },
  { id: "ten-2", sport: "Tennis", homeTeam: "Jannik Sinner",          awayTeam: "Alexander Zverev",    commenceTime: "Fri 4:30 PM ET",     moneylineHome: -175, moneylineAway: +148, spreadHome: 0,    spreadOdds: 0,    total: 0,    totalOdds: 0    },
];

const SPORTS = ["NFL", "NBA", "MLB", "Soccer", "Tennis"] as const;
type Sport = typeof SPORTS[number];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtOdds(n: number): string {
  if (n === 0) return "—";
  return n > 0 ? `+${n}` : String(n);
}

/** Convert American odds to implied probability */
function impliedProb(odds: number): number {
  if (odds === 0) return 0;
  if (odds > 0) return 100 / (odds + 100);
  return Math.abs(odds) / (Math.abs(odds) + 100);
}

/** Convert American odds to decimal odds */
function toDecimal(odds: number): number {
  if (odds === 0) return 0;
  if (odds > 0) return odds / 100 + 1;
  return 100 / Math.abs(odds) + 1;
}

/** Kelly Criterion stake */
function kelly(prob: number, decimalOdds: number, fraction: number): number {
  const b = decimalOdds - 1;
  const q = 1 - prob;
  const k = (b * prob - q) / b;
  return Math.max(0, k * fraction);
}

export default function SportsTrading() {
  const [sport, setSport] = useState<Sport | "All">("All");

  // EV calculator state
  const [inputOdds, setInputOdds]     = useState("-110");
  const [inputProb, setInputProb]     = useState("52.4");
  const [betSize, setBetSize]         = useState("100");

  const displayed = sport === "All" ? EVENTS : EVENTS.filter(e => e.sport === sport);

  const evCalc = useMemo(() => {
    const odds = parseInt(inputOdds) || 0;
    const trueProb = parseFloat(inputProb) / 100 || 0;
    if (odds === 0 || trueProb <= 0) return null;

    const dec = toDecimal(odds);
    const imp = impliedProb(odds);
    const edge = trueProb - imp;
    const ev = trueProb * (dec - 1) - (1 - trueProb);
    const bet = parseFloat(betSize) || 100;
    const expectedProfit = bet * ev;
    const kellyPct = kelly(trueProb, dec, 0.5) * 100;

    return { imp: imp * 100, edge: edge * 100, ev: ev * 100, expectedProfit, kellyPct, dec };
  }, [inputOdds, inputProb, betSize]);

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <div className="space-y-6">

        {/* Header */}
        <div>
          <div className="mb-1 flex items-center gap-2">
            <Trophy size={12} className="text-muted-foreground" />
            <span className="text-xs uppercase tracking-widest text-muted-foreground">Sports Betting Markets</span>
          </div>
          <h2 className="font-display text-3xl font-black tracking-tight">Sports Trading</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Moneylines · Spreads · Totals — EV calculator for finding edge
          </p>
        </div>

        {/* Strategy Brief */}
        <StrategyBrief />

        {/* Top EV Bets */}
        <div>
          <h3 className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Top Positive EV Bets</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {TOP_EV_BETS.map((bet, i) => (
              <motion.div key={bet.pick} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className="rounded-xl border border-bullish/30 bg-bullish/5 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded-full bg-bullish/10 px-2 py-0.5 font-mono text-xs font-bold text-bullish">EV+</span>
                  <span className="font-mono text-xs font-bold text-bullish">{bet.ev}</span>
                </div>
                <p className="font-semibold text-sm text-foreground">{bet.pick}</p>
                <p className="text-xs text-muted-foreground">{bet.matchup}</p>
                <div className="mt-3 grid grid-cols-3 gap-1">
                  {[
                    { label: "Odds",        value: bet.odds },
                    { label: "Book Implied", value: bet.impliedProb },
                    { label: "Edge",        value: bet.edge },
                  ].map(col => (
                    <div key={col.label}>
                      <p className="text-xs text-muted-foreground">{col.label}</p>
                      <p className="font-mono text-xs font-black text-foreground">{col.value}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bankroll Rules */}
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-watch/30 bg-watch/5 px-4 py-3">
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-watch">Bankroll Rules</span>
          {[
            "Max 2% per bet",
            "Max 10% total exposure",
            "Never chase losses",
          ].map(rule => (
            <div key={rule} className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-watch" />
              <span className="font-mono text-xs text-muted-foreground">{rule}</span>
            </div>
          ))}
        </div>

        {/* API Notice */}
        <div className="flex items-center gap-3 rounded-xl border border-watch/30 bg-watch/5 px-4 py-3 text-sm text-watch">
          <AlertCircle size={14} className="shrink-0" />
          <span>Connect <span className="font-mono font-bold">ODDS_API_KEY</span> for live lines — displaying mock data</span>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">

          {/* Left: Events table */}
          <div className="xl:col-span-2 space-y-4">
            {/* Sport filter tabs */}
            <div className="flex flex-wrap gap-1">
              {(["All", ...SPORTS] as const).map(s => (
                <button key={s} onClick={() => setSport(s as typeof sport)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wider transition-all ${
                    sport === s
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:text-foreground"
                  }`}>
                  {s}
                </button>
              ))}
            </div>

            {/* Events table */}
            <div className="overflow-x-auto rounded-2xl border border-border bg-card">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Sport", "Matchup", "Time", "Moneyline", "Spread", "Total (O/U)"].map(h => (
                      <th key={h} className="px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((e, i) => (
                    <motion.tr key={e.id}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                      className="border-b border-border/40 transition-colors hover:bg-accent/20">
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-mono text-xs font-bold text-primary">{e.sport}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">{e.homeTeam}</p>
                          <p className="text-xs text-muted-foreground">vs {e.awayTeam}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">{e.commenceTime}</td>
                      <td className="px-4 py-3">
                        <div className="space-y-0.5">
                          <p className={`font-mono text-sm font-bold ${e.moneylineHome < 0 ? "text-bearish" : "text-bullish"}`}>
                            {fmtOdds(e.moneylineHome)} H
                          </p>
                          <p className={`font-mono text-xs font-bold ${e.moneylineAway > 0 ? "text-bullish" : "text-bearish"}`}>
                            {fmtOdds(e.moneylineAway)} A
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {e.spreadHome !== 0 ? (
                          <div className="space-y-0.5">
                            <p className="font-mono text-sm font-bold text-foreground">
                              {e.spreadHome > 0 ? "+" : ""}{e.spreadHome}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">{fmtOdds(e.spreadOdds)}</p>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {e.total > 0 ? (
                          <div className="space-y-0.5">
                            <p className="font-mono text-sm font-bold text-foreground">O/U {e.total}</p>
                            <p className="font-mono text-xs text-muted-foreground">{fmtOdds(e.totalOdds)}</p>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: EV Calculator */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-border bg-card p-6 space-y-4 h-fit">
            <div className="flex items-center gap-2">
              <Calculator size={14} className="text-primary" />
              <h3 className="font-mono text-sm font-bold uppercase tracking-wider text-foreground">EV Calculator</h3>
            </div>
            <p className="text-xs text-muted-foreground">Enter American odds and your estimated true probability to calculate edge and expected value.</p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">American Odds</label>
                <input
                  type="number" value={inputOdds} onChange={e => setInputOdds(e.target.value)}
                  placeholder="-110"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">True Probability (%)</label>
                <input
                  type="number" value={inputProb} onChange={e => setInputProb(e.target.value)}
                  placeholder="52.4"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block font-mono text-xs font-bold uppercase tracking-wider text-muted-foreground">Bet Size ($)</label>
                <input
                  type="number" value={betSize} onChange={e => setBetSize(e.target.value)}
                  placeholder="100"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:border-primary focus:outline-none" />
              </div>
            </div>

            {evCalc && (
              <div className="space-y-2 rounded-xl border border-border bg-background p-4">
                {[
                  { label: "Implied Prob",    value: `${evCalc.imp.toFixed(1)}%`,   color: "text-foreground" },
                  { label: "Your Edge",       value: `${evCalc.edge >= 0 ? "+" : ""}${evCalc.edge.toFixed(1)}%`, color: evCalc.edge >= 0 ? "text-bullish" : "text-bearish" },
                  { label: "EV per $100",     value: `${evCalc.ev >= 0 ? "+" : ""}$${(evCalc.ev).toFixed(2)}`,   color: evCalc.ev >= 0 ? "text-bullish" : "text-bearish" },
                  { label: "Expected Profit", value: `${evCalc.expectedProfit >= 0 ? "+" : ""}$${evCalc.expectedProfit.toFixed(2)}`, color: evCalc.expectedProfit >= 0 ? "text-bullish" : "text-bearish" },
                  { label: "Half-Kelly %",    value: `${evCalc.kellyPct.toFixed(1)}%`, color: "text-primary" },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between">
                    <span className="font-mono text-xs text-muted-foreground">{row.label}</span>
                    <span className={`font-mono text-sm font-black ${row.color}`}>{row.value}</span>
                  </div>
                ))}

                <div className="mt-3 rounded-lg border border-border pt-3">
                  <div className={`text-center py-2 rounded-lg font-mono text-xs font-bold uppercase tracking-wider ${
                    evCalc.edge > 0 ? "bg-bullish/10 text-bullish" : "bg-bearish/10 text-bearish"
                  }`}>
                    {evCalc.edge > 0 ? "✓ Positive EV — Bet has edge" : "✗ Negative EV — No edge found"}
                  </div>
                </div>
              </div>
            )}
          </motion.div>

        </div>

      </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
