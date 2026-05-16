import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  TrendingUp, Plus, Pencil, Trash2, Loader2,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

interface Asset {
  id: string;
  user_id: string;
  name: string;
  category: string;
  value: number;
  notes: string | null;
  updated_at: string;
}

interface Liability {
  id: string;
  user_id: string;
  name: string;
  category: string;
  balance: number;
  interest_rate: number | null;
  notes: string | null;
  updated_at: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ASSET_CATEGORIES = [
  "Cash & Bank", "Investments", "Retirement", "Real Estate",
  "Business", "Vehicle", "Other",
];

const LIABILITY_CATEGORIES = [
  "Mortgage", "Auto Loan", "Student Loan", "Credit Card",
  "Personal Loan", "Other",
];

// ── Shared helpers ───────────────────────────────────────────────────────────

const fmt = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none";
const selectCls = `${inputCls} appearance-none`;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function EmptyState({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
      <p className="text-sm text-muted-foreground">{label}</p>
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus size={14} className="mr-1.5" /> Add First Entry
      </Button>
    </div>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

// ── Asset Modal ──────────────────────────────────────────────────────────────

interface AssetForm { name: string; category: string; value: string; notes: string; }
const emptyAssetForm: AssetForm = { name: "", category: ASSET_CATEGORIES[0], value: "", notes: "" };

function AssetModal({
  open, onClose, userId, existing,
}: { open: boolean; onClose: () => void; userId: string; existing: Asset | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<AssetForm>(
    existing
      ? { name: existing.name, category: existing.category, value: String(existing.value), notes: existing.notes ?? "" }
      : emptyAssetForm,
  );

  const set = (k: keyof AssetForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        name: form.name.trim(),
        category: form.category,
        value: parseFloat(form.value) || 0,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabase.from("net_worth_assets").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("net_worth_assets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["net_worth_assets"] });
      toast.success(existing ? "Asset updated" : "Asset added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Asset" : "Add Asset"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Name">
            <input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Chase Checking" />
          </Field>
          <Field label="Category">
            <select className={selectCls} value={form.category} onChange={set("category")}>
              {ASSET_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Value ($)">
            <input className={inputCls} type="number" min="0" value={form.value} onChange={set("value")} placeholder="0" />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name || !form.value || mutation.isPending}
          >
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Liability Modal ──────────────────────────────────────────────────────────

interface LiabilityForm { name: string; category: string; balance: string; interest_rate: string; notes: string; }
const emptyLiabilityForm: LiabilityForm = { name: "", category: LIABILITY_CATEGORIES[0], balance: "", interest_rate: "", notes: "" };

function LiabilityModal({
  open, onClose, userId, existing,
}: { open: boolean; onClose: () => void; userId: string; existing: Liability | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<LiabilityForm>(
    existing
      ? {
          name: existing.name,
          category: existing.category,
          balance: String(existing.balance),
          interest_rate: existing.interest_rate != null ? String(existing.interest_rate) : "",
          notes: existing.notes ?? "",
        }
      : emptyLiabilityForm,
  );

  const set = (k: keyof LiabilityForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        name: form.name.trim(),
        category: form.category,
        balance: parseFloat(form.balance) || 0,
        interest_rate: form.interest_rate ? parseFloat(form.interest_rate) : null,
        notes: form.notes.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (existing) {
        const { error } = await supabase.from("net_worth_liabilities").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("net_worth_liabilities").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["net_worth_liabilities"] });
      toast.success(existing ? "Liability updated" : "Liability added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Liability" : "Add Liability"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Name">
            <input className={inputCls} value={form.name} onChange={set("name")} placeholder="e.g. Home Mortgage" />
          </Field>
          <Field label="Category">
            <select className={selectCls} value={form.category} onChange={set("category")}>
              {LIABILITY_CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </Field>
          <Field label="Balance ($)">
            <input className={inputCls} type="number" min="0" value={form.balance} onChange={set("balance")} placeholder="0" />
          </Field>
          <Field label="Interest Rate (%)">
            <input className={inputCls} type="number" min="0" step="0.01" value={form.interest_rate} onChange={set("interest_rate")} placeholder="0.00" />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.name || !form.balance || mutation.isPending}
          >
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Liability"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function NetWorth() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [assetModal, setAssetModal] = useState<{ open: boolean; existing: Asset | null }>({ open: false, existing: null });
  const [liabilityModal, setLiabilityModal] = useState<{ open: boolean; existing: Liability | null }>({ open: false, existing: null });

  const { data: assets = [], isLoading: assetsLoading } = useQuery<Asset[]>({
    queryKey: ["net_worth_assets", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("net_worth_assets")
        .select("*")
        .eq("user_id", user.id)
        .order("category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: liabilities = [], isLoading: liabilitiesLoading } = useQuery<Liability[]>({
    queryKey: ["net_worth_liabilities", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("net_worth_liabilities")
        .select("*")
        .eq("user_id", user.id)
        .order("category")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("net_worth_assets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["net_worth_assets"] }); toast.success("Asset deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteLiability = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("net_worth_liabilities").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["net_worth_liabilities"] }); toast.success("Liability deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const kpi = useMemo(() => {
    const totalAssets = assets.reduce((s, a) => s + (a.value ?? 0), 0);
    const totalLiabilities = liabilities.reduce((s, l) => s + (l.balance ?? 0), 0);
    const netWorth = totalAssets - totalLiabilities;
    const dta = totalAssets > 0 ? (totalLiabilities / totalAssets) * 100 : 0;
    return { totalAssets, totalLiabilities, netWorth, dta };
  }, [assets, liabilities]);

  const assetsByCategory = useMemo(() => {
    const map: Record<string, Asset[]> = {};
    for (const a of assets) {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    }
    return map;
  }, [assets]);

  const liabilitiesByCategory = useMemo(() => {
    const map: Record<string, Liability[]> = {};
    for (const l of liabilities) {
      if (!map[l.category]) map[l.category] = [];
      map[l.category].push(l);
    }
    return map;
  }, [liabilities]);

  const barTotal = kpi.totalAssets + kpi.totalLiabilities;
  const assetPct = barTotal > 0 ? (kpi.totalAssets / barTotal) * 100 : 50;
  const liabilityPct = 100 - assetPct;

  const isLoading = assetsLoading || liabilitiesLoading;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <TrendingUp size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Net Worth</h1>
            <p className="text-sm text-muted-foreground">Your complete financial balance sheet</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 size={28} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="Total Assets" value={fmt(kpi.totalAssets)} />
              <KpiCard label="Total Liabilities" value={fmt(kpi.totalLiabilities)} />
              <KpiCard
                label="Net Worth"
                value={fmt(kpi.netWorth)}
                sub={kpi.netWorth >= 0 ? "Positive net worth" : "Negative net worth"}
              />
              <KpiCard
                label="Debt-to-Asset Ratio"
                value={`${kpi.dta.toFixed(1)}%`}
                sub={kpi.dta < 50 ? "Healthy leverage" : "High leverage"}
              />
            </div>

            {/* Net Worth Bar */}
            {barTotal > 0 && (
              <Card>
                <CardContent className="pt-5 pb-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Balance Sheet Breakdown
                  </p>
                  <div className="flex h-4 w-full overflow-hidden rounded-full">
                    <div
                      className="bg-primary transition-all duration-500"
                      style={{ width: `${assetPct}%` }}
                    />
                    <div
                      className="bg-destructive transition-all duration-500"
                      style={{ width: `${liabilityPct}%` }}
                    />
                  </div>
                  <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" />
                      Assets {assetPct.toFixed(1)}%
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                      Liabilities {liabilityPct.toFixed(1)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Assets Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Assets</CardTitle>
                <Button size="sm" onClick={() => setAssetModal({ open: true, existing: null })}>
                  <Plus size={14} className="mr-1.5" /> Add Asset
                </Button>
              </CardHeader>
              <CardContent>
                {assets.length === 0 ? (
                  <EmptyState label="No assets yet" onAdd={() => setAssetModal({ open: true, existing: null })} />
                ) : (
                  <div className="space-y-4">
                    {Object.entries(assetsByCategory).map(([cat, items]) => {
                      const subtotal = items.reduce((s, a) => s + a.value, 0);
                      return (
                        <div key={cat}>
                          <div className="mb-1 flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">{cat}</Badge>
                            <span className="text-xs font-semibold text-muted-foreground">{fmt(subtotal)}</span>
                          </div>
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Value</th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Notes</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map(a => (
                                  <tr key={a.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                                    <td className="px-3 py-2 font-medium text-foreground">{a.name}</td>
                                    <td className="px-3 py-2 text-right font-mono text-primary">{fmt(a.value)}</td>
                                    <td className="px-3 py-2 text-muted-foreground">{a.notes ?? "—"}</td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                                          onClick={() => setAssetModal({ open: true, existing: a })}
                                        >
                                          <Pencil size={13} />
                                        </button>
                                        <button
                                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                                          onClick={() => deleteAsset.mutate(a.id)}
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Liabilities Section */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base">Liabilities</CardTitle>
                <Button size="sm" onClick={() => setLiabilityModal({ open: true, existing: null })}>
                  <Plus size={14} className="mr-1.5" /> Add Liability
                </Button>
              </CardHeader>
              <CardContent>
                {liabilities.length === 0 ? (
                  <EmptyState label="No liabilities yet" onAdd={() => setLiabilityModal({ open: true, existing: null })} />
                ) : (
                  <div className="space-y-4">
                    {Object.entries(liabilitiesByCategory).map(([cat, items]) => {
                      const subtotal = items.reduce((s, l) => s + l.balance, 0);
                      return (
                        <div key={cat}>
                          <div className="mb-1 flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">{cat}</Badge>
                            <span className="text-xs font-semibold text-muted-foreground">{fmt(subtotal)}</span>
                          </div>
                          <div className="overflow-x-auto rounded-lg border border-border">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b border-border bg-muted/30">
                                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Balance</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rate</th>
                                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground"></th>
                                </tr>
                              </thead>
                              <tbody>
                                {items.map(l => (
                                  <tr key={l.id} className="border-b border-border/50 last:border-0 hover:bg-muted/10">
                                    <td className="px-3 py-2 font-medium text-foreground">{l.name}</td>
                                    <td className="px-3 py-2 text-right font-mono text-destructive">{fmt(l.balance)}</td>
                                    <td className="px-3 py-2 text-right text-muted-foreground">
                                      {l.interest_rate != null ? `${l.interest_rate}%` : "—"}
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                      <div className="flex items-center justify-end gap-1">
                                        <button
                                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                                          onClick={() => setLiabilityModal({ open: true, existing: l })}
                                        >
                                          <Pencil size={13} />
                                        </button>
                                        <button
                                          className="rounded p-1 text-muted-foreground hover:text-destructive"
                                          onClick={() => deleteLiability.mutate(l.id)}
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
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>

      {/* Modals */}
      {user && (
        <>
          <AssetModal
            open={assetModal.open}
            onClose={() => setAssetModal({ open: false, existing: null })}
            userId={user.id}
            existing={assetModal.existing}
          />
          <LiabilityModal
            open={liabilityModal.open}
            onClose={() => setLiabilityModal({ open: false, existing: null })}
            userId={user.id}
            existing={liabilityModal.existing}
          />
        </>
      )}
    </DashboardLayout>
  );
}
