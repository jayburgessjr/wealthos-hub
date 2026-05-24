import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Bell,
  BellOff,
  BellRing,
  Plus,
  Trash2,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";

// ── Types ──────────────────────────────────────────────────────────────────

type ConditionType =
  | "price_above"
  | "price_below"
  | "rsi_above"
  | "rsi_below"
  | "volume_spike"
  | "pct_change_above"
  | "pct_change_below";

type DeliveryType = "email" | "webhook" | "both";
type StatusType = "active" | "triggered" | "paused";

interface Alert {
  id: string;
  user_id: string;
  symbol: string;
  condition_type: ConditionType;
  threshold: number;
  current_value: number | null;
  status: StatusType;
  delivery: DeliveryType;
  webhook_url: string | null;
  note: string | null;
  triggered_at: string | null;
  created_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CONDITION_LABELS: Record<ConditionType, string> = {
  price_above: "Price Above",
  price_below: "Price Below",
  pct_change_above: "% Change Above",
  pct_change_below: "% Change Below",
  rsi_above: "RSI Above",
  rsi_below: "RSI Below",
  volume_spike: "Volume Spike",
};

const THRESHOLD_LABELS: Record<ConditionType, string> = {
  price_above: "Price ($)",
  price_below: "Price ($)",
  pct_change_above: "% Change",
  pct_change_below: "% Change",
  rsi_above: "RSI Level",
  rsi_below: "RSI Level",
  volume_spike: "Volume Ratio (e.g. 2 = 2×)",
};

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatValue(val: number | null, condition: ConditionType): string {
  if (val === null) return "—";
  if (condition === "price_above" || condition === "price_below") {
    return `$${val.toFixed(2)}`;
  }
  if (condition === "pct_change_above" || condition === "pct_change_below") {
    return `${val > 0 ? "+" : ""}${val.toFixed(2)}%`;
  }
  if (condition === "rsi_above" || condition === "rsi_below") {
    return val.toFixed(1);
  }
  if (condition === "volume_spike") {
    return `${val.toFixed(2)}×`;
  }
  return String(val);
}

function StatusBadge({ status }: { status: StatusType }) {
  const config: Record<StatusType, { label: string; className: string }> = {
    active: {
      label: "Active",
      className: "bg-bullish/15 text-bullish border-bullish/30",
    },
    triggered: {
      label: "Triggered",
      className: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    },
    paused: {
      label: "Paused",
      className: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    },
  };
  const { label, className } = config[status];
  return (
    <Badge variant="outline" className={`text-xs ${className}`}>
      {label}
    </Badge>
  );
}

function DeliveryBadge({ delivery }: { delivery: DeliveryType }) {
  const config: Record<DeliveryType, string> = {
    email: "bg-muted text-muted-foreground",
    webhook: "bg-purple-500/15 text-purple-400 border-purple-500/30",
    both: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  };
  return (
    <Badge
      variant="outline"
      className={`text-xs capitalize ${config[delivery]}`}
    >
      {delivery}
    </Badge>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  accent?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-lg p-4 flex items-center gap-4">
      <div className={`p-2 rounded-md bg-muted ${accent ?? ""}`}>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-mono font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  );
}

// ── Empty State ────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <BellOff className="h-12 w-12 text-muted-foreground/40 mb-4" />
      <p className="text-foreground font-medium mb-1">No alerts yet</p>
      <p className="text-sm text-muted-foreground">
        Create your first alert above to start monitoring the market.
      </p>
    </div>
  );
}

// ── Alert Row ──────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onToggle,
  onDelete,
}: {
  alert: Alert;
  onToggle: (id: string, current: StatusType) => void;
  onDelete: (id: string) => void;
}) {
  const isPaused = alert.status === "paused";
  const isTriggered = alert.status === "triggered";

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
    >
      <td className="px-4 py-3">
        <span className="font-mono font-semibold text-foreground text-sm">
          {alert.symbol}
        </span>
      </td>
      <td className="px-4 py-3 text-sm text-muted-foreground">
        {CONDITION_LABELS[alert.condition_type]}
      </td>
      <td className="px-4 py-3 font-mono text-sm text-foreground">
        {formatValue(alert.threshold, alert.condition_type)}
      </td>
      <td className="px-4 py-3 font-mono text-sm">
        {alert.current_value !== null ? (
          <span
            className={
              alert.condition_type === "pct_change_above" ||
              alert.condition_type === "pct_change_below"
                ? alert.current_value >= 0
                  ? "text-bullish"
                  : "text-bearish"
                : "text-foreground"
            }
          >
            {formatValue(alert.current_value, alert.condition_type)}
          </span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={alert.status} />
      </td>
      <td className="px-4 py-3">
        <DeliveryBadge delivery={alert.delivery} />
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {formatDate(alert.created_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {!isTriggered && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onToggle(alert.id, alert.status)}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-bearish"
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="bg-card border-border">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Alert</AlertDialogTitle>
                <AlertDialogDescription>
                  Delete the {CONDITION_LABELS[alert.condition_type]} alert for{" "}
                  <span className="font-mono font-semibold">
                    {alert.symbol}
                  </span>
                  ? This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => onDelete(alert.id)}
                  className="bg-bearish hover:bg-bearish/90 text-white"
                >
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </td>
    </motion.tr>
  );
}

// ── Alerts Table ──────────────────────────────────────────────────────────

function AlertsTable({
  alerts,
  onToggle,
  onDelete,
  loading,
}: {
  alerts: Alert[];
  onToggle: (id: string, current: StatusType) => void;
  onDelete: (id: string) => void;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2 px-4 py-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }
  if (alerts.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {[
              "Symbol",
              "Condition",
              "Threshold",
              "Current",
              "Status",
              "Delivery",
              "Created",
              "Actions",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {alerts.map((alert) => (
              <AlertRow
                key={alert.id}
                alert={alert}
                onToggle={onToggle}
                onDelete={onDelete}
              />
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

// ── Triggered History ─────────────────────────────────────────────────────

function TriggeredHistory({
  alerts,
  loading,
}: {
  alerts: Alert[];
  loading: boolean;
}) {
  const triggered = alerts.filter((a) => a.status === "triggered");

  if (loading) {
    return (
      <div className="space-y-2 px-4 py-3">
        {[...Array(2)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-md" />
        ))}
      </div>
    );
  }

  if (triggered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <CheckCircle2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <p className="text-foreground font-medium mb-1">No triggered alerts</p>
        <p className="text-sm text-muted-foreground">
          Alerts that fire will appear here with timestamps.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            {[
              "Symbol",
              "Condition",
              "Threshold",
              "Value at Trigger",
              "Triggered At",
              "Note",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <AnimatePresence>
            {triggered.map((alert) => (
              <motion.tr
                key={alert.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3 font-mono font-semibold text-foreground text-sm">
                  {alert.symbol}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  {CONDITION_LABELS[alert.condition_type]}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-foreground">
                  {formatValue(alert.threshold, alert.condition_type)}
                </td>
                <td className="px-4 py-3 font-mono text-sm text-blue-400">
                  {formatValue(alert.current_value, alert.condition_type)}
                </td>
                <td className="px-4 py-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3" />
                    {alert.triggered_at
                      ? formatDateTime(alert.triggered_at)
                      : "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                  {alert.note ?? "—"}
                </td>
              </motion.tr>
            ))}
          </AnimatePresence>
        </tbody>
      </table>
    </div>
  );
}

// ── Create Alert Form ─────────────────────────────────────────────────────

interface CreateFormState {
  symbol: string;
  condition_type: ConditionType;
  threshold: string;
  delivery: DeliveryType;
  webhook_url: string;
  note: string;
}

const defaultForm: CreateFormState = {
  symbol: "",
  condition_type: "price_above",
  threshold: "",
  delivery: "email",
  webhook_url: "",
  note: "",
};

function CreateAlertForm({ onCreated }: { onCreated: () => void }) {
  const { user } = useAuth();
  const [form, setForm] = useState<CreateFormState>(defaultForm);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateFormState) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!payload.symbol.trim()) throw new Error("Symbol is required");
      if (!payload.threshold || isNaN(Number(payload.threshold)))
        throw new Error("Valid threshold is required");
      if (
        (payload.delivery === "webhook" || payload.delivery === "both") &&
        !payload.webhook_url.trim()
      )
        throw new Error("Webhook URL is required for webhook delivery");

      const { error } = await supabase.from("alerts").insert({
        user_id: user.id,
        symbol: payload.symbol.trim().toUpperCase(),
        condition_type: payload.condition_type,
        threshold: Number(payload.threshold),
        delivery: payload.delivery,
        webhook_url: payload.webhook_url.trim() || null,
        note: payload.note.trim() || null,
        status: "active",
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Alert created successfully");
      setForm(defaultForm);
      onCreated();
    },
    onError: (err: Error) => {
      toast.error(err.message);
    },
  });

  const showWebhook = form.delivery === "webhook" || form.delivery === "both";

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center gap-2 mb-5">
        <Plus className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-foreground">Create Alert</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Symbol */}
        <div className="space-y-1.5">
          <Label htmlFor="symbol" className="text-xs text-muted-foreground">
            Symbol
          </Label>
          <Input
            id="symbol"
            placeholder="AAPL"
            value={form.symbol}
            onChange={(e) =>
              setForm((f) => ({ ...f, symbol: e.target.value.toUpperCase() }))
            }
            className="font-mono uppercase bg-background border-border"
          />
        </div>

        {/* Condition */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Condition</Label>
          <Select
            value={form.condition_type}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, condition_type: v as ConditionType }))
            }
          >
            <SelectTrigger className="bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(
                Object.entries(CONDITION_LABELS) as [ConditionType, string][]
              ).map(([val, label]) => (
                <SelectItem key={val} value={val}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Threshold */}
        <div className="space-y-1.5">
          <Label htmlFor="threshold" className="text-xs text-muted-foreground">
            {THRESHOLD_LABELS[form.condition_type]}
          </Label>
          <Input
            id="threshold"
            type="number"
            step="any"
            placeholder="0.00"
            value={form.threshold}
            onChange={(e) =>
              setForm((f) => ({ ...f, threshold: e.target.value }))
            }
            className="font-mono bg-background border-border"
          />
        </div>

        {/* Delivery */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Delivery</Label>
          <Select
            value={form.delivery}
            onValueChange={(v) =>
              setForm((f) => ({ ...f, delivery: v as DeliveryType }))
            }
          >
            <SelectTrigger className="bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Webhook URL — conditional */}
        {showWebhook && (
          <div className="space-y-1.5 sm:col-span-2">
            <Label
              htmlFor="webhook_url"
              className="text-xs text-muted-foreground"
            >
              Webhook URL
            </Label>
            <Input
              id="webhook_url"
              type="url"
              placeholder="https://hooks.example.com/…"
              value={form.webhook_url}
              onChange={(e) =>
                setForm((f) => ({ ...f, webhook_url: e.target.value }))
              }
              className="bg-background border-border"
            />
          </div>
        )}

        {/* Note */}
        <div className={`space-y-1.5 ${showWebhook ? "" : "sm:col-span-2"}`}>
          <Label htmlFor="note" className="text-xs text-muted-foreground">
            Note <span className="text-muted-foreground/50">(optional)</span>
          </Label>
          <Textarea
            id="note"
            placeholder="Why this alert matters…"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            className="bg-background border-border resize-none h-10 py-2 text-sm"
            rows={1}
          />
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          onClick={() => createMutation.mutate(form)}
          disabled={createMutation.isPending}
          className="gap-2"
        >
          <BellRing className="h-4 w-4" />
          {createMutation.isPending ? "Creating…" : "Create Alert"}
        </Button>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────

export default function Alerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ["alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    enabled: !!user,
  });

  const refetch = () => queryClient.invalidateQueries({ queryKey: ["alerts"] });

  const toggleMutation = useMutation({
    mutationFn: async ({
      id,
      current,
    }: {
      id: string;
      current: StatusType;
    }) => {
      const next = current === "paused" ? "active" : "paused";
      const { error } = await supabase
        .from("alerts")
        .update({ status: next })
        .eq("id", id);
      if (error) throw new Error(error.message);
      return next;
    },
    onSuccess: (next) => {
      toast.success(next === "paused" ? "Alert paused" : "Alert resumed");
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("alerts").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Alert deleted");
      refetch();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ── Stats ──────────────────────────────────────────────────────────────

  const total = alerts.length;
  const active = alerts.filter((a) => a.status === "active").length;
  const paused = alerts.filter((a) => a.status === "paused").length;

  const today = new Date().toDateString();
  const triggeredToday = alerts.filter(
    (a) =>
      a.status === "triggered" &&
      a.triggered_at &&
      new Date(a.triggered_at).toDateString() === today,
  ).length;

  return (
    <DashboardLayout>
      <SubscriptionGate>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <Bell className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="text-xl font-semibold text-foreground">
                Alert Engine
              </h1>
              <p className="text-sm text-muted-foreground">
                Monitor price, RSI, volume, and momentum conditions in
                real-time.
              </p>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Total Alerts" value={total} icon={Bell} />
            <StatCard
              label="Active"
              value={active}
              icon={BellRing}
              accent="text-bullish"
            />
            <StatCard
              label="Triggered Today"
              value={triggeredToday}
              icon={AlertTriangle}
              accent="text-blue-400"
            />
            <StatCard label="Paused" value={paused} icon={BellOff} />
          </div>

          {/* Create form */}
          <CreateAlertForm onCreated={refetch} />

          {/* Tabs: All / Triggered History */}
          <Tabs defaultValue="all">
            <TabsList className="bg-muted/50">
              <TabsTrigger value="all">All Alerts</TabsTrigger>
              <TabsTrigger value="history">Triggered History</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-3">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <AlertsTable
                  alerts={alerts}
                  onToggle={(id, current) =>
                    toggleMutation.mutate({ id, current })
                  }
                  onDelete={(id) => deleteMutation.mutate(id)}
                  loading={isLoading}
                />
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-3">
              <div className="bg-card border border-border rounded-lg overflow-hidden">
                <TriggeredHistory alerts={alerts} loading={isLoading} />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SubscriptionGate>
    </DashboardLayout>
  );
}
