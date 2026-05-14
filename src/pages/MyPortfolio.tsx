import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  Layers, Plus, X, Trash2, Pencil, ChevronDown, ChevronUp,
  TrendingUp, Bitcoin, BarChart2, DollarSign, Home, Landmark,
  Package, Upload, ArrowRight, Wallet, Target, Brain,
  FileText, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";

// ─── Types ─────────────────────────────────────────────────────────────────

interface HoldingRow {
  id: string;
  user_id: string;
  asset_type: "stock" | "etf" | "option" | "crypto" | "commodity" | "kalshi" | "fixed_income" | "real_estate" | "cash" | "other";
  symbol?: string;
  name: string;
  account?: string;
  quantity: number;
  unit?: string;
  avg_cost?: number;
  total_cost?: number;
  current_price?: number;
  current_value?: number;
  option_type?: "call" | "put";
  strike_price?: number;
  expiry_date?: string;
  contracts?: number;
  kalshi_market?: string;
  kalshi_outcome?: string;
  coupon_rate?: number;
  maturity_date?: string;
  face_value?: number;
  property_address?: string;
  mortgage_balance?: number;
  monthly_income?: number;
  notes?: string;
  tags?: string[];
  is_active?: boolean;
  created_at?: string;
}

type AssetType = HoldingRow["asset_type"];

// ─── Constants ─────────────────────────────────────────────────────────────

const ASSET_TYPES: { type: AssetType; label: string; emoji: string; desc: string }[] = [
  { type: "stock",        label: "Stock / ETF",          emoji: "📈", desc: "Equities, index funds" },
  { type: "option",       label: "Options",               emoji: "🎯", desc: "Calls, puts, spreads" },
  { type: "crypto",       label: "Crypto",                emoji: "₿",  desc: "BTC, ETH, altcoins" },
  { type: "commodity",    label: "Commodity",             emoji: "🥇", desc: "Gold, silver, oil" },
  { type: "kalshi",       label: "Kalshi Contract",       emoji: "🗳️", desc: "Event contracts" },
  { type: "fixed_income", label: "Bond / Fixed Income",  emoji: "🏦", desc: "Treasuries, corporates" },
  { type: "real_estate",  label: "Real Estate",           emoji: "🏠", desc: "Properties, REITs" },
  { type: "cash",         label: "Cash / Money Market",  emoji: "💵", desc: "Savings, MMF, CDs" },
  { type: "other",        label: "Other",                 emoji: "📦", desc: "Alternative assets" },
];

const TAB_FILTERS: { label: string; value: AssetType | "all" }[] = [
  { label: "All",           value: "all" },
  { label: "Stocks & ETFs", value: "stock" },
  { label: "Options",       value: "option" },
  { label: "Crypto",        value: "crypto" },
  { label: "Commodities",   value: "commodity" },
  { label: "Kalshi",        value: "kalshi" },
  { label: "Bonds",         value: "fixed_income" },
  { label: "Real Estate",   value: "real_estate" },
  { label: "Cash",          value: "cash" },
];

const ASSET_COLORS: Record<AssetType, string> = {
  stock:        "#22c55e",
  etf:          "#16a34a",
  option:       "#f59e0b",
  crypto:       "#f97316",
  commodity:    "#eab308",
  kalshi:       "#8b5cf6",
  fixed_income: "#3b82f6",
  real_estate:  "#ec4899",
  cash:         "#6b7280",
  other:        "#94a3b8",
};

// ─── Helper Functions ───────────────────────────────────────────────────────

function getAssetIcon(type: AssetType) {
  const icons: Record<AssetType, React.ReactNode> = {
    stock:        <TrendingUp className="w-4 h-4 text-bullish" />,
    etf:          <BarChart2 className="w-4 h-4 text-bullish" />,
    option:       <Target className="w-4 h-4 text-watch" />,
    crypto:       <Bitcoin className="w-4 h-4 text-orange-400" />,
    commodity:    <Package className="w-4 h-4 text-yellow-400" />,
    kalshi:       <Brain className="w-4 h-4 text-purple-400" />,
    fixed_income: <Landmark className="w-4 h-4 text-blue-400" />,
    real_estate:  <Home className="w-4 h-4 text-pink-400" />,
    cash:         <DollarSign className="w-4 h-4 text-neutral" />,
    other:        <Package className="w-4 h-4 text-muted-foreground" />,
  };
  return icons[type] ?? <Package className="w-4 h-4 text-muted-foreground" />;
}

function getAssetEmoji(type: AssetType): string {
  return ASSET_TYPES.find(a => a.type === type)?.emoji ?? "📦";
}

function formatCurrency(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${n < 0 ? "-" : ""}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000)     return `${n < 0 ? "-" : ""}$${(abs / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

function calcPnL(h: HoldingRow): { dollars: number; pct: number } | null {
  const value = h.current_value ?? (h.current_price != null ? h.current_price * h.quantity : null);
  const cost  = h.total_cost   ?? (h.avg_cost    != null ? h.avg_cost    * h.quantity : null);
  if (value == null || cost == null || cost === 0) return null;
  const dollars = value - cost;
  const pct     = (dollars / cost) * 100;
  return { dollars, pct };
}

// ─── Empty Form Factory ─────────────────────────────────────────────────────

function emptyForm(type: AssetType | null): Partial<HoldingRow> {
  return { asset_type: type ?? undefined, quantity: 0, is_active: true };
}

// ─── Sub-components ────────────────────────────────────────────────────────

function StatCard({ label, value, sub, valueClass = "" }: {
  label: string; value: string; sub?: string; valueClass?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-mono font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function AllocationBar({ holdings }: { holdings: HoldingRow[] }) {
  const total = holdings.reduce((s, h) => s + (h.current_value ?? h.total_cost ?? 0), 0);
  if (total === 0) return null;

  const buckets: Record<string, number> = {};
  holdings.forEach(h => {
    const key = h.asset_type;
    buckets[key] = (buckets[key] ?? 0) + (h.current_value ?? h.total_cost ?? 0);
  });

  const segments = Object.entries(buckets)
    .map(([type, val]) => ({ type: type as AssetType, pct: (val / total) * 100, val }))
    .sort((a, b) => b.pct - a.pct);

  return (
    <div className="mt-3">
      <div className="flex h-3 w-full rounded-full overflow-hidden gap-px">
        {segments.map(s => (
          <div
            key={s.type}
            style={{ width: `${s.pct}%`, backgroundColor: ASSET_COLORS[s.type] }}
            title={`${getAssetEmoji(s.type)} ${s.type}: ${s.pct.toFixed(1)}%`}
            className="transition-all"
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
        {segments.map(s => (
          <div key={s.type} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: ASSET_COLORS[s.type] }} />
            <span className="capitalize">{s.type.replace("_", " ")}</span>
            <span className="font-mono">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Asset-specific form fields ─────────────────────────────────────────────

function StockForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Symbol *</label>
          <input className="form-input" placeholder="AAPL" value={form.symbol ?? ""} onChange={e => set("symbol", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Company Name *</label>
          <input className="form-input" placeholder="Apple Inc." value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Shares Owned *</label>
          <input className="form-input" type="number" min="0" placeholder="100" value={form.quantity || ""} onChange={e => set("quantity", parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Avg Cost / Share ($)</label>
          <input className="form-input" type="number" min="0" placeholder="150.00" value={form.avg_cost ?? ""} onChange={e => set("avg_cost", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Current Price ($)</label>
          <input className="form-input" type="number" min="0" placeholder="175.00" value={form.current_price ?? ""} onChange={e => set("current_price", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Account / Broker</label>
          <input className="form-input" placeholder="Schwab, Fidelity…" value={form.account ?? ""} onChange={e => set("account", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} placeholder="Optional notes…" value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function OptionForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Underlying Symbol *</label>
          <input className="form-input" placeholder="SPY" value={form.symbol ?? ""} onChange={e => set("symbol", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Name / Description *</label>
          <input className="form-input" placeholder="SPY 500C 01/16/26" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Type *</label>
          <div className="flex gap-2">
            {(["call", "put"] as const).map(t => (
              <button key={t} onClick={() => set("option_type", t)}
                className={`flex-1 py-2 rounded-lg border text-sm capitalize transition-colors ${form.option_type === t ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Strike Price ($)</label>
          <input className="form-input" type="number" min="0" placeholder="500" value={form.strike_price ?? ""} onChange={e => set("strike_price", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Expiry Date</label>
          <input className="form-input" type="date" value={form.expiry_date ?? ""} onChange={e => set("expiry_date", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Contracts *</label>
          <input className="form-input" type="number" min="0" placeholder="1" value={(form.contracts ?? form.quantity) || ""} onChange={e => { const v = parseInt(e.target.value) || 0; set("contracts", v); set("quantity", v); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Premium Paid / Contract ($)</label>
          <input className="form-input" type="number" min="0" placeholder="3.50" value={form.avg_cost ?? ""} onChange={e => set("avg_cost", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Account</label>
          <input className="form-input" placeholder="Tastytrade, TDA…" value={form.account ?? ""} onChange={e => set("account", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function CryptoForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Coin Symbol *</label>
          <input className="form-input" placeholder="BTC" value={form.symbol ?? ""} onChange={e => set("symbol", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Coin Name *</label>
          <input className="form-input" placeholder="Bitcoin" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Amount *</label>
          <input className="form-input" type="number" min="0" step="any" placeholder="0.5" value={form.quantity || ""} onChange={e => set("quantity", parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Avg Buy Price ($)</label>
          <input className="form-input" type="number" min="0" placeholder="45000" value={form.avg_cost ?? ""} onChange={e => set("avg_cost", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Current Price ($)</label>
          <input className="form-input" type="number" min="0" placeholder="67000" value={form.current_price ?? ""} onChange={e => set("current_price", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Exchange / Wallet</label>
          <input className="form-input" placeholder="Coinbase, Ledger…" value={form.account ?? ""} onChange={e => set("account", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function CommodityForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Name *</label>
          <input className="form-input" placeholder="Gold" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Symbol / Ticker</label>
          <input className="form-input" placeholder="GLD" value={form.symbol ?? ""} onChange={e => set("symbol", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Quantity *</label>
          <input className="form-input" type="number" min="0" step="any" placeholder="10" value={form.quantity || ""} onChange={e => set("quantity", parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
          <input className="form-input" placeholder="oz, barrels, bushels" value={form.unit ?? ""} onChange={e => set("unit", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Avg Cost / Unit ($)</label>
          <input className="form-input" type="number" min="0" placeholder="1900" value={form.avg_cost ?? ""} onChange={e => set("avg_cost", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Current Price / Unit ($)</label>
          <input className="form-input" type="number" min="0" placeholder="2300" value={form.current_price ?? ""} onChange={e => set("current_price", parseFloat(e.target.value) || undefined)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function KalshiForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Market Question *</label>
          <input className="form-input" placeholder="Will Fed cut rates in June?" value={form.kalshi_market ?? form.name ?? ""} onChange={e => { set("kalshi_market", e.target.value); set("name", e.target.value); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Outcome *</label>
          <div className="flex gap-2">
            {(["YES", "NO"] as const).map(o => (
              <button key={o} onClick={() => set("kalshi_outcome", o)}
                className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${form.kalshi_outcome === o ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Contracts *</label>
          <input className="form-input" type="number" min="0" placeholder="100" value={(form.contracts ?? form.quantity) || ""} onChange={e => { const v = parseInt(e.target.value) || 0; set("contracts", v); set("quantity", v); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Entry Price (¢/contract)</label>
          <input className="form-input" type="number" min="0" max="100" placeholder="62" value={form.avg_cost ?? ""} onChange={e => set("avg_cost", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Current Price (¢/contract)</label>
          <input className="form-input" type="number" min="0" max="100" placeholder="71" value={form.current_price ?? ""} onChange={e => set("current_price", parseFloat(e.target.value) || undefined)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function BondForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Issuer Name *</label>
          <input className="form-input" placeholder="US Treasury" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Symbol / CUSIP</label>
          <input className="form-input" placeholder="912828YV6" value={form.symbol ?? ""} onChange={e => set("symbol", e.target.value.toUpperCase())} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Face Value ($) *</label>
          <input className="form-input" type="number" min="0" placeholder="10000" value={form.face_value ?? ""} onChange={e => { const v = parseFloat(e.target.value) || undefined; set("face_value", v); set("quantity", v ?? 0); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Coupon Rate (%)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="4.25" value={form.coupon_rate ?? ""} onChange={e => set("coupon_rate", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Maturity Date</label>
          <input className="form-input" type="date" value={form.maturity_date ?? ""} onChange={e => set("maturity_date", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Purchase Price ($)</label>
          <input className="form-input" type="number" min="0" placeholder="9850" value={form.avg_cost ?? ""} onChange={e => set("avg_cost", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Account</label>
          <input className="form-input" placeholder="Fidelity, Schwab…" value={form.account ?? ""} onChange={e => set("account", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function RealEstateForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Property Name / Address *</label>
          <input className="form-input" placeholder="123 Main St, Austin TX" value={form.property_address ?? form.name ?? ""} onChange={e => { set("property_address", e.target.value); set("name", e.target.value); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Current Est. Value ($) *</label>
          <input className="form-input" type="number" min="0" placeholder="450000" value={(form.current_value ?? form.quantity) || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; set("current_value", v); set("quantity", v); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Mortgage Balance ($)</label>
          <input className="form-input" type="number" min="0" placeholder="280000" value={form.mortgage_balance ?? ""} onChange={e => set("mortgage_balance", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Monthly Rental Income ($)</label>
          <input className="form-input" type="number" min="0" placeholder="2200" value={form.monthly_income ?? ""} onChange={e => set("monthly_income", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Original Purchase Price ($)</label>
          <input className="form-input" type="number" min="0" placeholder="320000" value={form.avg_cost ?? ""} onChange={e => set("avg_cost", parseFloat(e.target.value) || undefined)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function CashForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Account Name *</label>
          <input className="form-input" placeholder="Fidelity Money Market" value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Balance ($) *</label>
          <input className="form-input" type="number" min="0" placeholder="25000" value={form.quantity || ""} onChange={e => { const v = parseFloat(e.target.value) || 0; set("quantity", v); set("current_value", v); }} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Yield / APY (%)</label>
          <input className="form-input" type="number" min="0" step="0.01" placeholder="5.25" value={form.coupon_rate ?? ""} onChange={e => set("coupon_rate", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Institution</label>
          <input className="form-input" placeholder="Fidelity, Vanguard…" value={form.account ?? ""} onChange={e => set("account", e.target.value)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function OtherForm({ form, set }: { form: Partial<HoldingRow>; set: (k: keyof HoldingRow, v: any) => void }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="text-xs text-muted-foreground mb-1 block">Asset Name *</label>
          <input className="form-input" placeholder="Angel Investment — Acme Inc." value={form.name ?? ""} onChange={e => set("name", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Quantity *</label>
          <input className="form-input" type="number" min="0" step="any" placeholder="1" value={form.quantity || ""} onChange={e => set("quantity", parseFloat(e.target.value) || 0)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Unit</label>
          <input className="form-input" placeholder="shares, units…" value={form.unit ?? ""} onChange={e => set("unit", e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Cost Basis ($)</label>
          <input className="form-input" type="number" min="0" placeholder="5000" value={form.total_cost ?? ""} onChange={e => set("total_cost", parseFloat(e.target.value) || undefined)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 block">Est. Current Value ($)</label>
          <input className="form-input" type="number" min="0" placeholder="7500" value={form.current_value ?? ""} onChange={e => set("current_value", parseFloat(e.target.value) || undefined)} />
        </div>
      </div>
      <div>
        <label className="text-xs text-muted-foreground mb-1 block">Notes</label>
        <textarea className="form-input resize-none" rows={2} value={form.notes ?? ""} onChange={e => set("notes", e.target.value)} />
      </div>
    </>
  );
}

function AssetFormFields({ assetType, form, set }: {
  assetType: AssetType;
  form: Partial<HoldingRow>;
  set: (k: keyof HoldingRow, v: any) => void;
}) {
  switch (assetType) {
    case "stock":
    case "etf":
      return <StockForm form={form} set={set} />;
    case "option":
      return <OptionForm form={form} set={set} />;
    case "crypto":
      return <CryptoForm form={form} set={set} />;
    case "commodity":
      return <CommodityForm form={form} set={set} />;
    case "kalshi":
      return <KalshiForm form={form} set={set} />;
    case "fixed_income":
      return <BondForm form={form} set={set} />;
    case "real_estate":
      return <RealEstateForm form={form} set={set} />;
    case "cash":
      return <CashForm form={form} set={set} />;
    default:
      return <OtherForm form={form} set={set} />;
  }
}

// ─── HoldingRow in table ────────────────────────────────────────────────────

function HoldingTableRow({
  holding,
  onDelete,
  onEdit,
}: {
  holding: HoldingRow;
  onDelete: (id: string) => void;
  onEdit: (h: HoldingRow) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pnl = calcPnL(holding);
  const value = holding.current_value ?? (holding.current_price != null ? holding.current_price * holding.quantity : holding.total_cost);

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="border-b border-border hover:bg-white/[0.02] transition-colors"
    >
      {/* Asset */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-base">{getAssetEmoji(holding.asset_type)}</span>
          <div>
            <p className="text-sm font-medium text-foreground leading-tight">{holding.name}</p>
            {holding.symbol && (
              <span className="text-xs font-mono bg-white/5 border border-border rounded px-1 text-muted-foreground">
                {holding.symbol}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Account */}
      <td className="px-4 py-3 text-sm text-muted-foreground">{holding.account ?? "—"}</td>

      {/* Quantity */}
      <td className="px-4 py-3 font-mono text-sm text-foreground">
        {holding.quantity.toLocaleString()}
        {holding.unit ? <span className="text-muted-foreground ml-1 text-xs">{holding.unit}</span> : null}
      </td>

      {/* Avg Cost | Current Price */}
      <td className="px-4 py-3 text-sm font-mono">
        <div className="text-muted-foreground">{holding.avg_cost != null ? formatCurrency(holding.avg_cost) : "—"}</div>
        <div className="text-foreground">{holding.current_price != null ? formatCurrency(holding.current_price) : "—"}</div>
      </td>

      {/* Current Value */}
      <td className="px-4 py-3 font-mono text-sm text-foreground font-semibold">
        {value != null ? formatCurrency(value) : "—"}
      </td>

      {/* P&L */}
      <td className="px-4 py-3 text-sm font-mono">
        {pnl ? (
          <div className={pnl.dollars >= 0 ? "text-bullish" : "text-bearish"}>
            <div>{pnl.dollars >= 0 ? "+" : ""}{formatCurrency(pnl.dollars)}</div>
            <div className="text-xs">{pnl.pct >= 0 ? "+" : ""}{pnl.pct.toFixed(2)}%</div>
          </div>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(holding)}
            className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
            title="Edit"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          {confirmDelete ? (
            <div className="flex gap-1">
              <button
                onClick={() => { onDelete(holding.id); setConfirmDelete(false); }}
                className="px-2 py-1 rounded bg-bearish/20 text-bearish text-xs hover:bg-bearish/30 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-2 py-1 rounded bg-white/5 text-muted-foreground text-xs hover:bg-white/10 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded hover:bg-bearish/10 text-muted-foreground hover:text-bearish transition-colors"
              title="Delete"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </td>
    </motion.tr>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MyPortfolio() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Panel state
  const [panelOpen, setPanelOpen]     = useState(false);
  const [assetType, setAssetType]     = useState<AssetType | null>(null);
  const [form, setForm]               = useState<Partial<HoldingRow>>({});
  const [step, setStep]               = useState<1 | 2 | 3>(1);
  const [editTarget, setEditTarget]   = useState<HoldingRow | null>(null);

  // Filter state
  const [activeTab, setActiveTab]     = useState<AssetType | "all">("all");

  // CSV import
  const [csvOpen, setCsvOpen]         = useState(false);
  const [csvPreview, setCsvPreview]   = useState<string[][]>([]);
  const fileRef                        = useRef<HTMLInputElement>(null);

  // ── Queries ───────────────────────────────────────────────────────────────

  const { data: holdings = [], isLoading } = useQuery<HoldingRow[]>({
    queryKey: ["holdings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("holdings")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as HoldingRow[]) || [];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (holding: Partial<HoldingRow>) => {
      const { data: { user: u } } = await supabase.auth.getUser();
      const payload = {
        ...holding,
        user_id: u?.id ?? user?.id ?? "demo",
        total_cost: holding.total_cost ?? (
          holding.avg_cost != null && holding.quantity != null
            ? holding.avg_cost * holding.quantity
            : undefined
        ),
        current_value: holding.current_value ?? (
          holding.current_price != null && holding.quantity != null
            ? holding.current_price * holding.quantity
            : undefined
        ),
      };
      const { error } = await supabase.from("holdings").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      toast.success("Holding added to portfolio");
      closePanel();
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to add holding"),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, holding }: { id: string; holding: Partial<HoldingRow> }) => {
      const payload = {
        ...holding,
        total_cost: holding.total_cost ?? (
          holding.avg_cost != null && holding.quantity != null
            ? holding.avg_cost * holding.quantity
            : undefined
        ),
        current_value: holding.current_value ?? (
          holding.current_price != null && holding.quantity != null
            ? holding.current_price * holding.quantity
            : undefined
        ),
      };
      const { error } = await supabase.from("holdings").update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      toast.success("Holding updated");
      closePanel();
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to update holding"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("holdings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holdings"] });
      toast.success("Holding removed");
    },
    onError: (err: any) => toast.error(err.message ?? "Failed to delete holding"),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────

  function closePanel() {
    setPanelOpen(false);
    setAssetType(null);
    setForm({});
    setStep(1);
    setEditTarget(null);
  }

  function openEdit(h: HoldingRow) {
    setEditTarget(h);
    setAssetType(h.asset_type);
    setForm({ ...h });
    setStep(2);
    setPanelOpen(true);
  }

  function setField(k: keyof HoldingRow, v: any) {
    setForm(f => ({ ...f, [k]: v }));
  }

  function handleSave() {
    if (!form.name || !form.asset_type) {
      toast.error("Name and asset type are required");
      return;
    }
    if (!form.quantity && form.quantity !== 0) {
      toast.error("Quantity is required");
      return;
    }
    if (editTarget) {
      updateMutation.mutate({ id: editTarget.id, holding: form });
    } else {
      addMutation.mutate(form);
    }
  }

  // ── CSV Import ───────────────────────────────────────────────────────────

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = text.split("\n").slice(0, 11).map(r => r.split(",").map(c => c.trim().replace(/^"|"$/g, "")));
      setCsvPreview(rows);
    };
    reader.readAsText(file);
  }

  // ── Derived values ───────────────────────────────────────────────────────

  const filtered = activeTab === "all" ? holdings : holdings.filter(h => h.asset_type === activeTab);

  const totalValue    = holdings.reduce((s, h) => s + (h.current_value ?? (h.current_price != null ? h.current_price * h.quantity : 0)), 0);
  const totalCost     = holdings.reduce((s, h) => s + (h.total_cost    ?? (h.avg_cost    != null ? h.avg_cost    * h.quantity : 0)), 0);
  const unrealizedPnl = totalValue - totalCost;

  const isPending = addMutation.isPending || updateMutation.isPending;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <style>{`
        .form-input {
          width: 100%;
          background: rgba(255,255,255,0.05);
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
          color: hsl(var(--foreground));
          outline: none;
          transition: border-color 0.15s;
        }
        .form-input:focus {
          border-color: hsl(var(--primary));
        }
        .form-input::placeholder {
          color: hsl(var(--muted-foreground));
          opacity: 0.6;
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-6">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Layers className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">My Portfolio</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Your complete financial picture — powers every decision on the platform
              </p>
            </div>
          </div>
          <button
            onClick={() => { setStep(1); setPanelOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            Add Holding
          </button>
        </div>

        {/* ── Summary bar ────────────────────────────────────────────────── */}
        {holdings.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Total Portfolio Value" value={formatCurrency(totalValue)} />
              <StatCard label="Total Invested" value={formatCurrency(totalCost)} />
              <StatCard
                label="Unrealized P&L"
                value={`${unrealizedPnl >= 0 ? "+" : ""}${formatCurrency(unrealizedPnl)}`}
                sub={totalCost > 0 ? `${((unrealizedPnl / totalCost) * 100).toFixed(2)}% return` : undefined}
                valueClass={unrealizedPnl >= 0 ? "text-bullish" : "text-bearish"}
              />
              <StatCard label="Holdings" value={holdings.length.toString()} sub="positions tracked" />
            </div>
            <div className="bg-card border border-border rounded-xl p-4 mt-3">
              <p className="text-xs text-muted-foreground mb-1">Allocation by Asset Class</p>
              <AllocationBar holdings={holdings} />
            </div>
          </motion.div>
        )}

        {/* ── Empty state benefit cards ───────────────────────────────────── */}
        {holdings.length === 0 && !isLoading && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid md:grid-cols-3 gap-4">
            {[
              { icon: TrendingUp,   title: "Personalized Signals",    desc: "Signals filter to YOUR tickers automatically once you add holdings." },
              { icon: Target,       title: "Goal Tracking",           desc: "Goal engine uses your real capital to model actual milestones." },
              { icon: Brain,        title: "Tailored Decisions",      desc: "Decision hub gives advice specific to what you own and your risk profile." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="bg-card border border-border rounded-xl p-5 flex gap-4">
                <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 h-fit">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{title}</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
            <div className="md:col-span-3 flex justify-center">
              <button
                onClick={() => { setStep(1); setPanelOpen(true); }}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add Your First Holding
              </button>
            </div>
          </motion.div>
        )}

        {/* ── Loading ─────────────────────────────────────────────────────── */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-sm">Loading holdings…</span>
          </div>
        )}

        {/* ── Holdings table ──────────────────────────────────────────────── */}
        {holdings.length > 0 && (
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Tabs */}
            <div className="flex overflow-x-auto border-b border-border">
              {TAB_FILTERS.map(tab => (
                <button
                  key={tab.value}
                  onClick={() => setActiveTab(tab.value)}
                  className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.value
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.label}
                  {tab.value !== "all" && (
                    <span className="ml-1.5 text-xs opacity-60">
                      ({holdings.filter(h => h.asset_type === tab.value).length})
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Table */}
            {filtered.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-xs text-muted-foreground border-b border-border">
                      <th className="px-4 py-2.5 text-left font-medium">Asset</th>
                      <th className="px-4 py-2.5 text-left font-medium">Account</th>
                      <th className="px-4 py-2.5 text-left font-medium">Qty</th>
                      <th className="px-4 py-2.5 text-left font-medium">Avg Cost | Price</th>
                      <th className="px-4 py-2.5 text-left font-medium">Value</th>
                      <th className="px-4 py-2.5 text-left font-medium">P&L</th>
                      <th className="px-4 py-2.5 text-left font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {filtered.map(h => (
                        <HoldingTableRow
                          key={h.id}
                          holding={h}
                          onDelete={id => deleteMutation.mutate(id)}
                          onEdit={openEdit}
                        />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-muted-foreground text-sm">
                No {activeTab === "all" ? "holdings" : TAB_FILTERS.find(t => t.value === activeTab)?.label.toLowerCase()} yet.{" "}
                <button onClick={() => { setStep(1); setPanelOpen(true); }} className="text-primary hover:underline">
                  Add one now
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── CSV Import ──────────────────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => setCsvOpen(o => !o)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-medium text-foreground hover:bg-white/[0.02] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-muted-foreground" />
              Import from Brokerage
            </div>
            {csvOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          <AnimatePresence>
            {csvOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5 border-t border-border space-y-4 pt-4">
                  <p className="text-sm text-muted-foreground">
                    Export your positions as CSV from your broker. We support{" "}
                    <span className="text-foreground">Schwab, Fidelity, TD Ameritrade, E*Trade, Interactive Brokers,</span> and{" "}
                    <span className="text-foreground">Robinhood</span> formats.
                  </p>

                  <div
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
                  >
                    <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Drop your CSV here or <span className="text-primary">click to browse</span></p>
                    <p className="text-xs text-muted-foreground mt-1">Accepts .csv files</p>
                    <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvFile} />
                  </div>

                  {csvPreview.length > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">Preview — first {csvPreview.length} rows detected:</p>
                      <div className="overflow-x-auto rounded-lg border border-border">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="bg-white/5">
                              {csvPreview[0]?.map((col, i) => (
                                <th key={i} className="px-3 py-2 text-left text-muted-foreground font-medium whitespace-nowrap">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.slice(1, 6).map((row, ri) => (
                              <tr key={ri} className="border-t border-border">
                                {row.map((cell, ci) => (
                                  <td key={ci} className="px-3 py-2 text-foreground whitespace-nowrap">{cell}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <button
                          onClick={() => toast.info("CSV mapping UI coming soon — for now, add holdings manually above.")}
                          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          Import {csvPreview.length - 1} holdings
                        </button>
                        <button
                          onClick={() => { setCsvPreview([]); if (fileRef.current) fileRef.current.value = ""; }}
                          className="px-4 py-2 bg-white/5 text-muted-foreground rounded-lg text-sm hover:bg-white/10 transition-colors"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── What this unlocks ───────────────────────────────────────────── */}
        <div className="grid md:grid-cols-3 gap-3">
          {[
            { label: "View in Decision Hub",  icon: Brain,      to: "/decisions"   },
            { label: "Check Your Signals",    icon: TrendingUp, to: "/signals"     },
            { label: "Track Performance",     icon: BarChart2,  to: "/performance" },
          ].map(({ label, icon: Icon, to }) => (
            <Link
              key={to}
              to={to}
              className="flex items-center justify-between px-5 py-4 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-primary/5 transition-colors group"
            >
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                <span className="text-sm font-medium text-foreground">{label}</span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
            </Link>
          ))}
        </div>

      </div>

      {/* ── Add / Edit Panel ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {panelOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closePanel}
              className="fixed inset-0 bg-black/50 z-40"
            />

            {/* Panel */}
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed right-0 top-0 h-full w-full max-w-lg bg-background border-l border-border z-50 flex flex-col shadow-2xl"
            >
              {/* Panel header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {editTarget ? "Edit Holding" : "Add Holding"}
                  </h2>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step === 1 ? "Choose asset type" : step === 2 ? "Enter details" : "Review & save"}
                  </p>
                </div>
                <button onClick={closePanel} className="p-1.5 rounded hover:bg-white/10 text-muted-foreground transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel body */}
              <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

                {/* Step 1: Pick type */}
                {step === 1 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-xs text-muted-foreground mb-3">What type of asset are you adding?</p>
                    <div className="grid grid-cols-2 gap-2">
                      {ASSET_TYPES.map(at => (
                        <button
                          key={at.type}
                          onClick={() => {
                            setAssetType(at.type);
                            setForm(emptyForm(at.type));
                            setStep(2);
                          }}
                          className="flex items-start gap-3 p-3.5 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-colors text-left group"
                        >
                          <span className="text-xl leading-none mt-0.5">{at.emoji}</span>
                          <div>
                            <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors">{at.label}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{at.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Fill form */}
                {step === 2 && assetType && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-border">
                      <span className="text-lg">{getAssetEmoji(assetType)}</span>
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {ASSET_TYPES.find(a => a.type === assetType)?.label}
                        </p>
                        <button onClick={() => { setStep(1); setAssetType(null); }} className="text-xs text-primary hover:underline">
                          Change type
                        </button>
                      </div>
                    </div>

                    <AssetFormFields assetType={assetType} form={form} set={setField} />
                  </motion.div>
                )}

                {/* Step 3: Review */}
                {step === 3 && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="bg-white/5 border border-border rounded-xl p-4 space-y-2">
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-3">Summary</p>
                      {[
                        ["Asset Type", ASSET_TYPES.find(a => a.type === form.asset_type)?.label ?? form.asset_type],
                        ["Name",       form.name],
                        ["Symbol",     form.symbol],
                        ["Quantity",   form.quantity?.toString()],
                        ["Avg Cost",   form.avg_cost != null ? formatCurrency(form.avg_cost) : null],
                        ["Curr Price", form.current_price != null ? formatCurrency(form.current_price) : null],
                        ["Account",    form.account],
                        ["Notes",      form.notes],
                      ].filter(([, v]) => v).map(([label, val]) => (
                        <div key={label as string} className="flex justify-between text-sm">
                          <span className="text-muted-foreground">{label}</span>
                          <span className="text-foreground font-mono">{val}</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-bullish/10 border border-bullish/20 rounded-lg">
                      <CheckCircle2 className="w-4 h-4 text-bullish shrink-0" />
                      <p className="text-xs text-bullish">Ready to add to your portfolio</p>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Panel footer */}
              {step > 1 && (
                <div className="px-6 py-4 border-t border-border flex gap-3 shrink-0">
                  {step === 2 && (
                    <>
                      <button
                        onClick={() => !editTarget && setStep(1)}
                        disabled={!!editTarget}
                        className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-white/5 transition-colors disabled:opacity-40"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => {
                          if (!form.name) { toast.error("Name is required"); return; }
                          if (!form.quantity && form.quantity !== 0) { toast.error("Quantity is required"); return; }
                          setStep(3);
                        }}
                        className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
                      >
                        Review
                      </button>
                    </>
                  )}
                  {step === 3 && (
                    <>
                      <button
                        onClick={() => setStep(2)}
                        className="flex-1 py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:bg-white/5 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {isPending
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                          : <><FileText className="w-4 h-4" /> {editTarget ? "Save Changes" : "Add to Portfolio"}</>
                        }
                      </button>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
