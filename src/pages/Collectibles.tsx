import { useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, Plus, Pencil, Trash2, TrendingUp, TrendingDown, Loader2, Award,
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

type Category =
  | "Art"
  | "Wine & Spirits"
  | "Watches"
  | "Jewelry"
  | "Sports Memorabilia"
  | "Trading Cards"
  | "Coins & Currency"
  | "Antiques"
  | "Other";

type Condition = "Mint" | "Near Mint" | "Excellent" | "Good" | "Fair" | "Poor";

interface Collectible {
  id: string;
  user_id: string;
  name: string;
  category: Category;
  purchase_price: number;
  current_value: number;
  purchase_date: string;
  condition: Condition;
  notes: string;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  "Art", "Wine & Spirits", "Watches", "Jewelry", "Sports Memorabilia",
  "Trading Cards", "Coins & Currency", "Antiques", "Other",
];

const CONDITIONS: Condition[] = ["Mint", "Near Mint", "Excellent", "Good", "Fair", "Poor"];

// ── Helpers ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtUSD = (n: number) => (n < 0 ? `-$${fmt(Math.abs(n))}` : `$${fmt(n)}`);
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function gainLoss(c: Collectible) { return c.current_value - c.purchase_price; }
function gainLossPct(c: Collectible) {
  if (!c.purchase_price) return 0;
  return ((c.current_value - c.purchase_price) / c.purchase_price) * 100;
}

function categoryBadge(cat: Category): string {
  const map: Record<Category, string> = {
    "Art":               "bg-purple-500/15 text-purple-400 border-purple-500/30",
    "Wine & Spirits":    "bg-red-500/15 text-red-400 border-red-500/30",
    "Watches":           "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "Jewelry":           "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "Sports Memorabilia":"bg-green-600/15 text-green-400 border-green-600/30",
    "Trading Cards":     "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    "Coins & Currency":  "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    "Antiques":          "bg-orange-500/15 text-orange-400 border-orange-500/30",
    "Other":             "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30",
  };
  return map[cat] ?? "";
}

function conditionBadge(cond: Condition): string {
  if (cond === "Mint" || cond === "Near Mint") return "bg-primary/15 text-primary border-primary/30";
  if (cond === "Excellent" || cond === "Good") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  return "bg-muted-foreground/15 text-muted-foreground border-muted-foreground/30";
}

// ── Shared UI ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, valueClass }: { label: string; value: string; sub?: string; valueClass?: string }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`text-2xl font-bold ${valueClass ?? "text-foreground"}`}>{value}</span>
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
      <Award size={32} className="text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">No collectibles yet. Add your first item to track your collection.</p>
      <Button size="sm" variant="outline" onClick={onAdd}>
        <Plus size={14} className="mr-1.5" /> Add Item
      </Button>
    </div>
  );
}

// ── Add / Edit Dialog ──────────────────────────────────────────────────────────

const BLANK = {
  name: "",
  category: "Art" as Category,
  purchase_price: "",
  current_value: "",
  purchase_date: "",
  condition: "Excellent" as Condition,
  notes: "",
};

function CollectibleDialog({
  open, onClose, existing, userId,
}: {
  open: boolean;
  onClose: () => void;
  existing?: Collectible;
  userId: string;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState<typeof BLANK>(
    existing
      ? {
          name: existing.name,
          category: existing.category,
          purchase_price: String(existing.purchase_price ?? ""),
          current_value: String(existing.current_value ?? ""),
          purchase_date: existing.purchase_date ?? "",
          condition: existing.condition,
          notes: existing.notes ?? "",
        }
      : BLANK,
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof BLANK) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setF(prev => ({ ...prev, [k]: e.target.value }));

  const handleSave = async () => {
    if (!f.name.trim()) { toast.error("Name is required"); return; }
    setSaving(true);
    const payload = {
      user_id: userId,
      name: f.name.trim(),
      category: f.category,
      purchase_price: parseFloat(f.purchase_price) || 0,
      current_value: parseFloat(f.current_value) || 0,
      purchase_date: f.purchase_date || null,
      condition: f.condition,
      notes: f.notes,
    };
    const { error } = existing
      ? await supabase.from("collectibles").update(payload).eq("id", existing.id)
      : await supabase.from("collectibles").insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["collectibles", userId] });
    toast.success(existing ? "Item updated." : "Item added.");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Item" : "Add Collectible"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Name">
            <input className={inputCls} value={f.name} onChange={set("name")} placeholder="1952 Topps Mickey Mantle #311" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className={selectCls} value={f.category} onChange={set("category")}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Condition">
              <select className={selectCls} value={f.condition} onChange={set("condition")}>
                {CONDITIONS.map(c => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase Price ($)">
              <input type="number" className={inputCls} value={f.purchase_price} onChange={set("purchase_price")} placeholder="5000" />
            </Field>
            <Field label="Current Value ($)">
              <input type="number" className={inputCls} value={f.current_value} onChange={set("current_value")} placeholder="7500" />
            </Field>
          </div>
          <Field label="Purchase Date">
            <input type="date" className={inputCls} value={f.purchase_date} onChange={set("purchase_date")} />
          </Field>
          <Field label="Notes">
            <textarea className={`${inputCls} h-20 resize-none`} value={f.notes} onChange={set("notes")} placeholder="Graded PSA 7, provenance…" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Category Breakdown ─────────────────────────────────────────────────────────

interface CategoryRow {
  category: Category;
  count: number;
  totalValue: number;
  totalCost: number;
  gl: number;
}

function CategoryBreakdown({ items }: { items: Collectible[] }) {
  const map = new Map<Category, CategoryRow>();
  for (const item of items) {
    const existing = map.get(item.category);
    if (existing) {
      existing.count++;
      existing.totalValue += item.current_value ?? 0;
      existing.totalCost += item.purchase_price ?? 0;
      existing.gl += gainLoss(item);
    } else {
      map.set(item.category, {
        category: item.category,
        count: 1,
        totalValue: item.current_value ?? 0,
        totalCost: item.purchase_price ?? 0,
        gl: gainLoss(item),
      });
    }
  }
  const rows = [...map.values()].sort((a, b) => b.totalValue - a.totalValue);

  return (
    <Card className="overflow-hidden">
      <div className="px-5 py-4 font-semibold text-sm">Category Breakdown</div>
      <Separator />
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
              <th className="px-5 py-3 text-left">Category</th>
              <th className="px-4 py-3 text-right">Items</th>
              <th className="px-4 py-3 text-right">Total Value</th>
              <th className="px-4 py-3 text-right">Total Cost</th>
              <th className="px-4 py-3 text-right">Gain / Loss</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.category} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="px-5 py-3">
                  <Badge variant="outline" className={categoryBadge(r.category)}>{r.category}</Badge>
                </td>
                <td className="px-4 py-3 text-right text-muted-foreground">{r.count}</td>
                <td className="px-4 py-3 text-right font-medium">{fmtUSD(r.totalValue)}</td>
                <td className="px-4 py-3 text-right text-muted-foreground">{fmtUSD(r.totalCost)}</td>
                <td className="px-4 py-3 text-right">
                  <span className={r.gl >= 0 ? "text-primary font-medium" : "text-bearish font-medium"}>
                    {fmtUSD(r.gl)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function Collectibles() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Collectible | undefined>();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["collectibles", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collectibles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Collectible[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("collectibles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["collectibles", user?.id] });
      toast.success("Item removed.");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const totalValue = items.reduce((s, i) => s + (i.current_value ?? 0), 0);
  const totalCost = items.reduce((s, i) => s + (i.purchase_price ?? 0), 0);
  const totalGL = totalValue - totalCost;
  const bestPerformer = items.length
    ? items.reduce((best, i) => (gainLossPct(i) > gainLossPct(best) ? i : best), items[0])
    : null;

  const openAdd = () => { setEditing(undefined); setDialogOpen(true); };
  const openEdit = (i: Collectible) => { setEditing(i); setDialogOpen(true); };
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
            <Star size={20} className="text-primary" />
            <h1 className="text-xl font-bold">Collectibles</h1>
          </div>
          <Button size="sm" onClick={openAdd}>
            <Plus size={14} className="mr-1.5" /> Add Item
          </Button>
        </motion.div>

        {/* KPI Row */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        >
          <KpiCard label="Collection Value" value={fmtUSD(totalValue)} />
          <KpiCard label="Total Cost Basis" value={fmtUSD(totalCost)} />
          <KpiCard
            label="Unrealized Gain / Loss"
            value={fmtUSD(totalGL)}
            valueClass={totalGL >= 0 ? "text-primary" : "text-bearish"}
            sub={totalCost > 0 ? fmtPct((totalGL / totalCost) * 100) : undefined}
          />
          <KpiCard
            label="Best Performer"
            value={bestPerformer ? fmtPct(gainLossPct(bestPerformer)) : "—"}
            valueClass="text-primary"
            sub={bestPerformer?.name ?? undefined}
          />
        </motion.div>

        {/* Items Table */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4">
              <span className="font-semibold text-sm">Collection Items</span>
              <span className="text-xs text-muted-foreground">{items.length} items</span>
            </div>
            <Separator />
            {isLoading ? (
              <div className="flex items-center justify-center py-14">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="p-5">
                <EmptyState onAdd={openAdd} />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="px-5 py-3 text-left">Name</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-left">Condition</th>
                      <th className="px-4 py-3 text-right">Cost Basis</th>
                      <th className="px-4 py-3 text-right">Current Value</th>
                      <th className="px-4 py-3 text-right">Gain / Loss</th>
                      <th className="px-4 py-3 text-right">Return</th>
                      <th className="px-4 py-3 text-right"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(item => {
                      const gl = gainLoss(item);
                      const glPct = gainLossPct(item);
                      return (
                        <tr key={item.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-5 py-3 font-medium max-w-[220px]">
                            <span className="block truncate">{item.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={categoryBadge(item.category)}>{item.category}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={conditionBadge(item.condition)}>{item.condition}</Badge>
                          </td>
                          <td className="px-4 py-3 text-right text-muted-foreground">{fmtUSD(item.purchase_price)}</td>
                          <td className="px-4 py-3 text-right font-medium">{fmtUSD(item.current_value)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {gl >= 0
                                ? <TrendingUp size={12} className="text-primary" />
                                : <TrendingDown size={12} className="text-bearish" />
                              }
                              <span className={gl >= 0 ? "text-primary font-medium" : "text-bearish font-medium"}>
                                {fmtUSD(gl)}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className={glPct >= 0 ? "text-primary font-medium" : "text-bearish font-medium"}>
                              {fmtPct(glPct)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1">
                              <button
                                onClick={() => openEdit(item)}
                                className="rounded p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <Pencil size={13} />
                              </button>
                              <button
                                onClick={() => deleteMutation.mutate(item.id)}
                                className="rounded p-1.5 hover:bg-bearish/10 text-muted-foreground hover:text-bearish transition-colors"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </motion.div>

        {/* Category Breakdown */}
        {items.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <CategoryBreakdown items={items} />
          </motion.div>
        )}
      </div>

      {dialogOpen && (
        <CollectibleDialog
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
