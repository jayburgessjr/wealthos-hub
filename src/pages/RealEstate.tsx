import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Home, Plus, Pencil, Trash2, Calculator, DollarSign,
  TrendingUp, Percent, Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

type PropertyType = "Primary Residence" | "Rental" | "Vacation" | "Commercial" | "Land";

interface Property {
  id: string;
  user_id: string;
  address: string;
  property_type: PropertyType;
  purchase_price: number;
  current_value: number;
  mortgage_balance: number;
  monthly_rent: number;
  monthly_expenses: number;
  purchase_date: string;
  notes: string;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number, decimals = 0) =>
  n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtUSD = (n: number) =>
  n < 0
    ? `-$${fmt(Math.abs(n))}`
    : `$${fmt(n)}`;

const fmtPct = (n: number) => `${n.toFixed(2)}%`;

function equity(p: Property) { return p.current_value - p.mortgage_balance; }
function monthlyNet(p: Property) { return p.monthly_rent - p.monthly_expenses; }
function capRate(p: Property) {
  if (!p.current_value) return 0;
  const annualNet = monthlyNet(p) * 12;
  return (annualNet / p.current_value) * 100;
}
function cashOnCash(p: Property) {
  const downPayment = p.purchase_price - p.mortgage_balance;
  if (!downPayment) return 0;
  return (monthlyNet(p) * 12) / downPayment * 100;
}

function typeBadge(t: PropertyType) {
  const map: Record<PropertyType, string> = {
    "Primary Residence": "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "Rental":            "bg-primary/15 text-primary border-primary/30",
    "Vacation":          "bg-purple-500/15 text-purple-400 border-purple-500/30",
    "Commercial":        "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "Land":              "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  };
  return map[t] ?? "";
}

const PROPERTY_TYPES: PropertyType[] = [
  "Primary Residence", "Rental", "Vacation", "Commercial", "Land",
];

// ── Shared UI helpers ──────────────────────────────────────────────────────────

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="text-2xl font-bold text-foreground">{value}</span>
      {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const selectCls = `${inputCls} appearance-none`;

// ── Empty State ────────────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
      <Home size={32} className="text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">No properties yet. Add your first property to get started.</p>
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus size={14} className="mr-1.5" /> Add Property
      </Button>
    </div>
  );
}

// ── Add / Edit Dialog ──────────────────────────────────────────────────────────

const BLANK = {
  address: "",
  property_type: "Rental" as PropertyType,
  purchase_price: "",
  current_value: "",
  mortgage_balance: "",
  monthly_rent: "",
  monthly_expenses: "",
  purchase_date: "",
  notes: "",
};

function PropertyDialog({
  open, onClose, existing, userId,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Property;
  userId: string;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<typeof BLANK>(
    existing
      ? {
          address: existing.address,
          property_type: existing.property_type,
          purchase_price: String(existing.purchase_price ?? ""),
          current_value: String(existing.current_value ?? ""),
          mortgage_balance: String(existing.mortgage_balance ?? ""),
          monthly_rent: String(existing.monthly_rent ?? ""),
          monthly_expenses: String(existing.monthly_expenses ?? ""),
          purchase_date: existing.purchase_date ?? "",
          notes: existing.notes ?? "",
        }
      : BLANK,
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof BLANK) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setF(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!f.address.trim()) { toast.error("Address is required"); return; }
    setSaving(true);
    const payload = {
      user_id: userId,
      address: f.address.trim(),
      property_type: f.property_type,
      purchase_price: parseFloat(f.purchase_price) || 0,
      current_value: parseFloat(f.current_value) || 0,
      mortgage_balance: parseFloat(f.mortgage_balance) || 0,
      monthly_rent: parseFloat(f.monthly_rent) || 0,
      monthly_expenses: parseFloat(f.monthly_expenses) || 0,
      purchase_date: f.purchase_date || null,
      notes: f.notes,
    };
    const { error } = existing
      ? await supabase.from("real_estate_properties").update(payload).eq("id", existing.id)
      : await supabase.from("real_estate_properties").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["real_estate_properties", userId] });
    toast.success(existing ? "Property updated." : "Property added.");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Property" : "Add Property"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Address">
            <input className={inputCls} value={f.address} onChange={set("address")} placeholder="123 Main St, City, ST 00000" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Property Type">
              <select className={selectCls} value={f.property_type} onChange={set("property_type")}>
                {PROPERTY_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </Field>
            <Field label="Purchase Date">
              <input type="date" className={inputCls} value={f.purchase_date} onChange={set("purchase_date")} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Price ($)">
              <input type="number" className={inputCls} value={f.purchase_price} onChange={set("purchase_price")} placeholder="450000" />
            </Field>
            <Field label="Current Value ($)">
              <input type="number" className={inputCls} value={f.current_value} onChange={set("current_value")} placeholder="520000" />
            </Field>
          </div>
          <Field label="Mortgage Balance ($)">
            <input type="number" className={inputCls} value={f.mortgage_balance} onChange={set("mortgage_balance")} placeholder="380000" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly Rent ($)">
              <input type="number" className={inputCls} value={f.monthly_rent} onChange={set("monthly_rent")} placeholder="2400" />
            </Field>
            <Field label="Monthly Expenses ($)">
              <input type="number" className={inputCls} value={f.monthly_expenses} onChange={set("monthly_expenses")} placeholder="800" />
            </Field>
          </div>
          <Field label="Notes">
            <textarea className={`${inputCls} h-20 resize-none`} value={f.notes} onChange={set("notes")} placeholder="Optional notes…" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Property"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Cap Rate Calculator ────────────────────────────────────────────────────────

function CapRateCalculator() {
  const [purchasePrice, setPurchasePrice] = useState("");
  const [grossRent, setGrossRent] = useState("");
  const [vacancyRate, setVacancyRate] = useState("5");
  const [opExpenses, setOpExpenses] = useState("");
  const [mortgageMonthly, setMortgageMonthly] = useState("");

  const pp = parseFloat(purchasePrice) || 0;
  const gr = parseFloat(grossRent) || 0;
  const vr = parseFloat(vacancyRate) || 0;
  const oe = parseFloat(opExpenses) || 0;
  const mp = parseFloat(mortgageMonthly) || 0;

  const effectiveRent = gr * (1 - vr / 100);
  const noi = effectiveRent - oe;
  const calcCapRate = pp > 0 ? (noi / pp) * 100 : 0;
  const annualMortgage = mp * 12;
  const cashFlow = noi - annualMortgage;
  const downPayment = pp * 0.2; // assume 20% down
  const calcCoc = downPayment > 0 ? (cashFlow / downPayment) * 100 : 0;
  const grm = gr > 0 ? pp / gr : 0;

  const rowCls = "flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0";

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Calculator size={16} className="text-primary" />
        <span className="font-semibold text-sm">Cap Rate Calculator</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Purchase Price ($)">
          <input type="number" className={inputCls} value={purchasePrice} onChange={e => setPurchasePrice(e.target.value)} placeholder="500000" />
        </Field>
        <Field label="Annual Gross Rent ($)">
          <input type="number" className={inputCls} value={grossRent} onChange={e => setGrossRent(e.target.value)} placeholder="30000" />
        </Field>
        <Field label="Vacancy Rate (%)">
          <input type="number" className={inputCls} value={vacancyRate} onChange={e => setVacancyRate(e.target.value)} placeholder="5" />
        </Field>
        <Field label="Operating Expenses (annual $)">
          <input type="number" className={inputCls} value={opExpenses} onChange={e => setOpExpenses(e.target.value)} placeholder="8000" />
        </Field>
        <Field label="Mortgage Payment (monthly $)">
          <input type="number" className={inputCls} value={mortgageMonthly} onChange={e => setMortgageMonthly(e.target.value)} placeholder="1800" />
        </Field>
      </div>
      {pp > 0 && (
        <div className="rounded-lg bg-muted/30 p-4 space-y-0.5">
          <div className={rowCls}>
            <span className="text-muted-foreground">Net Operating Income (NOI)</span>
            <span className={noi >= 0 ? "text-primary font-semibold" : "text-bearish font-semibold"}>{fmtUSD(noi)}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Cap Rate</span>
            <span className={calcCapRate >= 5 ? "text-primary font-semibold" : "text-foreground font-semibold"}>{fmtPct(calcCapRate)}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Cash-on-Cash Return (20% down assumed)</span>
            <span className={calcCoc >= 0 ? "text-primary font-semibold" : "text-bearish font-semibold"}>{fmtPct(calcCoc)}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Gross Rent Multiplier (GRM)</span>
            <span className="font-semibold">{grm > 0 ? grm.toFixed(1) : "—"}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Mortgage Calculator ────────────────────────────────────────────────────────

function MortgageCalculator() {
  const [loanAmount, setLoanAmount] = useState("");
  const [rate, setRate] = useState("");
  const [termYears, setTermYears] = useState("30");

  const P = parseFloat(loanAmount) || 0;
  const annualRate = parseFloat(rate) || 0;
  const years = parseFloat(termYears) || 30;

  const r = annualRate / 100 / 12;
  const n = years * 12;
  const monthlyPayment = P > 0 && r > 0 ? (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1) : P > 0 ? P / n : 0;
  const totalPaid = monthlyPayment * n;
  const totalInterest = totalPaid - P;

  const rowCls = "flex justify-between text-sm py-1.5 border-b border-border/50 last:border-0";

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center gap-2">
        <DollarSign size={16} className="text-primary" />
        <span className="font-semibold text-sm">Mortgage Calculator</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Loan Amount ($)">
          <input type="number" className={inputCls} value={loanAmount} onChange={e => setLoanAmount(e.target.value)} placeholder="400000" />
        </Field>
        <Field label="Interest Rate (%)">
          <input type="number" className={inputCls} value={rate} onChange={e => setRate(e.target.value)} placeholder="6.75" step="0.01" />
        </Field>
        <Field label="Term (Years)">
          <select className={selectCls} value={termYears} onChange={e => setTermYears(e.target.value)}>
            {[10, 15, 20, 25, 30].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </Field>
      </div>
      {P > 0 && (
        <div className="rounded-lg bg-muted/30 p-4 space-y-0.5">
          <div className={rowCls}>
            <span className="text-muted-foreground">Monthly Payment</span>
            <span className="text-primary font-bold text-base">{fmtUSD(monthlyPayment)}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Total Paid ({years}yr)</span>
            <span className="font-semibold">{fmtUSD(totalPaid)}</span>
          </div>
          <div className={rowCls}>
            <span className="text-muted-foreground">Total Interest</span>
            <span className="text-bearish font-semibold">{fmtUSD(totalInterest)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function RealEstate() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Property | undefined>();

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["real_estate_properties", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("real_estate_properties")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Property[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("real_estate_properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["real_estate_properties", user?.id] });
      toast.success("Property removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalValue = properties.reduce((s, p) => s + (p.current_value ?? 0), 0);
  const totalEquity = properties.reduce((s, p) => s + equity(p), 0);
  const totalMonthlyNet = properties.reduce((s, p) => s + monthlyNet(p), 0);
  const avgCapRate = properties.length
    ? properties.reduce((s, p) => s + capRate(p), 0) / properties.length
    : 0;

  const openAdd = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (p: Property) => { setEditing(p); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(undefined); };

  return (
    <DashboardLayout>
      <SubscriptionGate tier="elite">
      <div className="space-y-6 p-4 md:p-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Home size={20} className="text-primary" />
            <h1 className="text-xl font-bold">Real Estate</h1>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} className="mr-1.5" /> Add Property
          </Button>
        </motion.div>

        {/* KPI Row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiCard label="Portfolio Value" value={fmtUSD(totalValue)} />
          <KpiCard label="Total Equity" value={fmtUSD(totalEquity)} />
          <KpiCard
            label="Monthly Net Income"
            value={fmtUSD(totalMonthlyNet)}
            sub={totalMonthlyNet >= 0 ? "positive cash flow" : "negative cash flow"}
          />
          <KpiCard label="Avg Cap Rate" value={fmtPct(avgCapRate)} />
        </motion.div>

        {/* Properties Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-semibold text-sm">Properties</span>
              <span className="text-xs text-muted-foreground">{properties.length} total</span>
            </div>
            <Separator />
            {isLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : properties.length === 0 ? (
              <div className="p-5">
                <EmptyState onAdd={openAdd} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Address</th>
                      <th className="px-4 py-3 text-left">Type</th>
                      <th className="px-4 py-3 text-right">Value</th>
                      <th className="px-4 py-3 text-right">Equity</th>
                      <th className="px-4 py-3 text-right">Rent/mo</th>
                      <th className="px-4 py-3 text-right">Exp/mo</th>
                      <th className="px-4 py-3 text-right">Cap Rate</th>
                      <th className="px-4 py-3 text-right">CoC</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {properties.map(p => (
                      <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3 font-medium max-w-[200px] truncate">{p.address}</td>
                        <td className="px-4 py-3">
                          <Badge variant="outline" className={typeBadge(p.property_type)}>{p.property_type}</Badge>
                        </td>
                        <td className="px-4 py-3 text-right font-medium">{fmtUSD(p.current_value)}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={equity(p) >= 0 ? "text-primary" : "text-bearish"}>{fmtUSD(equity(p))}</span>
                        </td>
                        <td className="px-4 py-3 text-right">{p.monthly_rent ? fmtUSD(p.monthly_rent) : "—"}</td>
                        <td className="px-4 py-3 text-right text-muted-foreground">{p.monthly_expenses ? fmtUSD(p.monthly_expenses) : "—"}</td>
                        <td className="px-4 py-3 text-right">
                          <span className={capRate(p) >= 5 ? "text-primary font-medium" : "text-muted-foreground"}>
                            {p.current_value ? fmtPct(capRate(p)) : "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={cashOnCash(p) >= 0 ? "text-primary font-medium" : "text-bearish font-medium"}>
                            {fmtPct(cashOnCash(p))}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-1">
                            <button
                              onClick={() => openEdit(p)}
                              className="rounded p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => deleteMutation.mutate(p.id)}
                              className="rounded p-1.5 hover:bg-bearish/10 text-muted-foreground hover:text-bearish transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Calculators */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 gap-4 lg:grid-cols-2"
        >
          <CapRateCalculator />
          <MortgageCalculator />
        </motion.div>
      </div>

      {dialogOpen && (
        <PropertyDialog
          open={dialogOpen}
          onClose={closeDialog}
          existing={editing}
          userId={user?.id ?? ""}
        />
      )}
      </SubscriptionGate>
    </DashboardLayout>
  );
}
