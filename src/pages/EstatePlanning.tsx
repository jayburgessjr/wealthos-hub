import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { ScrollText, Plus, Pencil, Trash2, Loader2, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface EstateItem {
  id: string;
  user_id: string;
  item_type: string;
  title: string;
  status: string;
  attorney: string | null;
  last_reviewed: string | null;
  notes: string | null;
  created_at: string;
}

const ITEM_TYPES = [
  "Will", "Revocable Trust", "Irrevocable Trust", "Power of Attorney",
  "Healthcare Directive", "Beneficiary Designation", "Life Insurance",
  "Business Succession", "Other",
];

const STATUSES = ["Not Started", "In Progress", "Complete", "Needs Review"];

const CHECKLIST_CATEGORIES = [
  { label: "Will & Testament", types: ["Will"] },
  { label: "Revocable Trust", types: ["Revocable Trust"] },
  { label: "Power of Attorney", types: ["Power of Attorney"] },
  { label: "Healthcare Directive", types: ["Healthcare Directive"] },
  { label: "Beneficiary Designations", types: ["Beneficiary Designation"] },
  { label: "Life Insurance", types: ["Life Insurance"] },
  { label: "Business Succession", types: ["Business Succession"] },
];

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

function statusBadge(status: string) {
  const map: Record<string, string> = {
    "Complete": "bg-green-500/15 text-green-400 border-green-500/30",
    "In Progress": "bg-amber-500/15 text-amber-400 border-amber-500/30",
    "Not Started": "bg-muted/50 text-muted-foreground border-border",
    "Needs Review": "bg-red-500/15 text-red-400 border-red-500/30",
  };
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${map[status] ?? map["Not Started"]}`}>
      {status}
    </span>
  );
}

interface ItemForm {
  item_type: string;
  title: string;
  status: string;
  attorney: string;
  last_reviewed: string;
  notes: string;
}

const emptyForm: ItemForm = {
  item_type: ITEM_TYPES[0],
  title: "",
  status: "Not Started",
  attorney: "",
  last_reviewed: "",
  notes: "",
};

function ItemModal({
  open, onClose, userId, existing,
}: { open: boolean; onClose: () => void; userId: string; existing: EstateItem | null }) {
  const qc = useQueryClient();
  const [form, setForm] = useState<ItemForm>(
    existing
      ? {
          item_type: existing.item_type,
          title: existing.title,
          status: existing.status,
          attorney: existing.attorney ?? "",
          last_reviewed: existing.last_reviewed ?? "",
          notes: existing.notes ?? "",
        }
      : emptyForm,
  );

  const set = (k: keyof ItemForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [k]: e.target.value }));

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        user_id: userId,
        item_type: form.item_type,
        title: form.title.trim(),
        status: form.status,
        attorney: form.attorney.trim() || null,
        last_reviewed: form.last_reviewed || null,
        notes: form.notes.trim() || null,
      };
      if (existing) {
        const { error } = await supabase.from("estate_items").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("estate_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estate_items"] });
      toast.success(existing ? "Item updated" : "Item added");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Estate Item" : "Add Estate Item"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Item Type">
            <select className={selectCls} value={form.item_type} onChange={set("item_type")}>
              {ITEM_TYPES.map(t => <option key={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Title">
            <input className={inputCls} value={form.title} onChange={set("title")} placeholder="e.g. Last Will and Testament" />
          </Field>
          <Field label="Status">
            <select className={selectCls} value={form.status} onChange={set("status")}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Attorney">
            <input className={inputCls} value={form.attorney} onChange={set("attorney")} placeholder="Attorney name (optional)" />
          </Field>
          <Field label="Last Reviewed">
            <input className={inputCls} type="date" value={form.last_reviewed} onChange={set("last_reviewed")} />
          </Field>
          <Field label="Notes">
            <textarea className={inputCls} rows={2} value={form.notes} onChange={set("notes")} placeholder="Optional" />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={!form.title || mutation.isPending}
          >
            {mutation.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {existing ? "Save Changes" : "Add Item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function EstatePlanning() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EstateItem | null>(null);

  const { data: items = [], isLoading } = useQuery<EstateItem[]>({
    queryKey: ["estate_items", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("estate_items")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("estate_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["estate_items"] });
      toast.success("Item removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const total = items.length;
  const complete = items.filter(i => i.status === "Complete").length;
  const pct = total > 0 ? Math.round((complete / total) * 100) : 0;

  function openAdd() { setEditing(null); setModalOpen(true); }
  function openEdit(item: EstateItem) { setEditing(item); setModalOpen(true); }

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
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <ScrollText size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Estate Planning</h1>
            <p className="text-sm text-muted-foreground">Documents, beneficiaries, and legacy planning</p>
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-5 pb-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">Completion Progress</p>
              <p className="text-sm text-muted-foreground">{complete} of {total} items complete</p>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{pct}% complete</p>
          </CardContent>
        </Card>

        {/* Checklist overview */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {CHECKLIST_CATEGORIES.map(cat => {
            const catItems = items.filter(i => cat.types.includes(i.item_type));
            const catComplete = catItems.filter(i => i.status === "Complete").length;
            const done = catItems.length > 0 && catComplete === catItems.length;
            return (
              <Card key={cat.label} className={done ? "border-green-500/40" : ""}>
                <CardContent className="pt-4 pb-3 flex items-start gap-2">
                  <CheckCircle2
                    size={16}
                    className={`mt-0.5 shrink-0 ${done ? "text-green-400" : "text-muted-foreground/30"}`}
                  />
                  <div>
                    <p className="text-xs font-semibold text-foreground leading-tight">{cat.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {catComplete}/{catItems.length} complete
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Items list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Estate Items</CardTitle>
            <Button size="sm" onClick={openAdd}>
              <Plus size={14} className="mr-1.5" /> Add Item
            </Button>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin text-muted-foreground" size={20} />
              </div>
            ) : items.length === 0 ? (
              <EmptyState label="No estate items yet. Start by adding your will or trust documents." onAdd={openAdd} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <th className="pb-2 text-left">Title</th>
                      <th className="pb-2 text-left">Type</th>
                      <th className="pb-2 text-left">Status</th>
                      <th className="pb-2 text-left">Attorney</th>
                      <th className="pb-2 text-left">Last Reviewed</th>
                      <th className="pb-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map(item => (
                      <tr key={item.id} className="group">
                        <td className="py-3 font-medium text-foreground">{item.title}</td>
                        <td className="py-3 text-muted-foreground">{item.item_type}</td>
                        <td className="py-3">{statusBadge(item.status)}</td>
                        <td className="py-3 text-muted-foreground">{item.attorney ?? "—"}</td>
                        <td className="py-3 text-muted-foreground">
                          {item.last_reviewed ? new Date(item.last_reviewed).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(item)}>
                              <Pencil size={13} />
                            </Button>
                            <Button
                              size="icon" variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => deleteMutation.mutate(item.id)}
                            >
                              <Trash2 size={13} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Key reminders */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Key Reminders</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground list-none">
              {[
                "Review estate documents every 3 years or after major life events (marriage, divorce, new child, significant asset change).",
                "Ensure beneficiary designations on retirement accounts and life insurance are current — these override your will.",
                "Store originals in a fireproof safe or with your attorney. Keep a digital copy in a secure, accessible location.",
                "Notify your executor and healthcare proxy of their roles and where to find key documents.",
              ].map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  {r}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </motion.div>

      {user && (
        <ItemModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          userId={user.id}
          existing={editing}
        />
      )}
    </DashboardLayout>
  );
}
