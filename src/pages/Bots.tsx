import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  Play,
  Pause,
  Pencil,
  Trash2,
  Info,
  ChevronRight,
  AlertTriangle,
  Activity,
  Zap,
  BarChart2,
  X,
} from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";

// ── Types ──────────────────────────────────────────────────────────────────────
type BotStatus = "active" | "paused" | "draft";
type ExecStatus = "pending" | "filled" | "cancelled" | "failed";
type ExecAction = "buy" | "sell" | "short" | "cover";

interface Condition {
  id: string;
  indicator: string;
  operator: string;
  value: string;
}

interface BotRecord {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  status: BotStatus;
  entry_conditions: Condition[];
  exit_conditions: Condition[];
  symbols: string[];
  position_size_pct: number;
  max_concurrent_trades: number;
  paper_mode: boolean;
  webhook_url: string | null;
  executions_count: number;
  last_triggered_at: string | null;
  created_at: string;
}

interface BotExecution {
  id: string;
  bot_id: string;
  symbol: string;
  action: ExecAction;
  price: number | null;
  quantity: number | null;
  status: ExecStatus;
  paper_mode: boolean;
  note: string | null;
  executed_at: string;
  bots: { name: string } | null;
}

// ── Constants ──────────────────────────────────────────────────────────────────
const INDICATORS = [
  "Price",
  "RSI (14)",
  "SMA 20",
  "SMA 50",
  "EMA 9",
  "Volume",
  "MACD Signal",
  "Bollinger Upper",
  "Bollinger Lower",
];

const OPERATORS = [
  "is above",
  "is below",
  "crosses above",
  "crosses below",
  "equals",
];

const OPERATOR_SYMBOLS: Record<string, string> = {
  "is above": ">",
  "is below": "<",
  "crosses above": "↑",
  "crosses below": "↓",
  equals: "=",
};

const DEFAULT_BOT_FORM = {
  name: "",
  description: "",
  symbolsRaw: "",
  position_size_pct: 5,
  max_concurrent_trades: "1",
  paper_mode: true,
  webhook_url: "",
  entry_conditions: [] as Condition[],
  exit_conditions: [] as Condition[],
  stop_loss_pct: "",
  take_profit_pct: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function newCondition(): Condition {
  return {
    id: crypto.randomUUID(),
    indicator: "Price",
    operator: "is above",
    value: "",
  };
}

function conditionLabel(c: Condition): string {
  const sym = OPERATOR_SYMBOLS[c.operator] ?? c.operator;
  return `${c.indicator} ${sym} ${c.value}`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatPrice(n: number | null): string {
  if (n === null) return "—";
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── ConditionBuilder ───────────────────────────────────────────────────────────
function ConditionBuilder({
  conditions,
  onChange,
}: {
  conditions: Condition[];
  onChange: (next: Condition[]) => void;
}) {
  function addCondition() {
    onChange([...conditions, newCondition()]);
  }

  function removeCondition(id: string) {
    onChange(conditions.filter((c) => c.id !== id));
  }

  function updateCondition(id: string, patch: Partial<Condition>) {
    onChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }

  return (
    <div className="space-y-3">
      <AnimatePresence initial={false}>
        {conditions.map((cond, idx) => (
          <motion.div
            key={cond.id}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {idx > 0 && (
              <div className="flex items-center gap-2 my-2">
                <div className="flex-1 h-px bg-border" />
                <span className="text-xs font-mono text-muted-foreground px-2 py-0.5 rounded bg-muted border border-border">
                  AND
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>
            )}
            <div className="flex items-center gap-2 p-3 bg-muted/30 border border-border rounded-lg">
              <Select
                value={cond.indicator}
                onValueChange={(v) =>
                  updateCondition(cond.id, { indicator: v })
                }
              >
                <SelectTrigger className="w-40 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INDICATORS.map((ind) => (
                    <SelectItem key={ind} value={ind}>
                      {ind}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={cond.operator}
                onValueChange={(v) => updateCondition(cond.id, { operator: v })}
              >
                <SelectTrigger className="w-36 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                className="h-8 w-24 text-sm font-mono"
                placeholder="value"
                value={cond.value}
                onChange={(e) =>
                  updateCondition(cond.id, { value: e.target.value })
                }
              />

              {cond.value && (
                <Badge
                  variant="outline"
                  className="text-xs font-mono text-muted-foreground hidden sm:flex"
                >
                  {conditionLabel(cond)}
                </Badge>
              )}

              <button
                type="button"
                onClick={() => removeCondition(cond.id)}
                className="ml-auto text-muted-foreground hover:text-destructive transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addCondition}
        className="w-full border-dashed"
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add Condition
      </Button>
    </div>
  );
}

// ── BotCard ────────────────────────────────────────────────────────────────────
function BotCard({
  bot,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  bot: BotRecord;
  onEdit: (bot: BotRecord) => void;
  onToggleStatus: (bot: BotRecord) => void;
  onDelete: (id: string) => void;
}) {
  const visibleSymbols = bot.symbols.slice(0, 3);
  const extraSymbols = bot.symbols.length - 3;

  const entryText =
    bot.entry_conditions.length > 0
      ? bot.entry_conditions.map(conditionLabel).join(" AND ")
      : "No entry conditions";

  const exitText =
    bot.exit_conditions.length > 0
      ? bot.exit_conditions.map(conditionLabel).join(" AND ")
      : "No exit conditions";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="bg-card border border-border rounded-lg p-5 flex flex-col gap-4"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground truncate">
              {bot.name}
            </span>
            <StatusBadge status={bot.status} />
            {bot.paper_mode ? (
              <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
                Paper
              </Badge>
            ) : (
              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-xs">
                Live
              </Badge>
            )}
          </div>
          {bot.description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {bot.description}
            </p>
          )}
        </div>
      </div>

      {/* Symbols */}
      {bot.symbols.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {visibleSymbols.map((s) => (
            <Badge key={s} variant="outline" className="font-mono text-xs">
              {s}
            </Badge>
          ))}
          {extraSymbols > 0 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{extraSymbols} more
            </Badge>
          )}
        </div>
      )}

      <Separator className="opacity-50" />

      {/* Conditions */}
      <div className="space-y-2">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
            Entry
          </p>
          <p className="text-xs text-foreground/80 line-clamp-2">{entryText}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-0.5">
            Exit
          </p>
          <p className="text-xs text-foreground/80 line-clamp-2">{exitText}</p>
        </div>
      </div>

      <Separator className="opacity-50" />

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xs text-muted-foreground">Position Size</p>
          <p className="text-sm font-mono font-semibold">
            {bot.position_size_pct}%
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Executions</p>
          <p className="text-sm font-mono font-semibold">
            {bot.executions_count}
          </p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Last Run</p>
          <p className="text-sm font-mono font-semibold">
            {relativeTime(bot.last_triggered_at)}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onToggleStatus(bot)}
          className="gap-1.5"
        >
          {bot.status === "active" ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Pause
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5" /> Start
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onEdit(bot)}
          className="gap-1.5"
        >
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onDelete(bot.id)}
          className="gap-1.5 text-destructive hover:text-destructive ml-auto"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}

// ── StatusBadge ────────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: BotStatus }) {
  if (status === "active") {
    return (
      <Badge className="bg-bullish/15 text-bullish border-bullish/30 text-xs gap-1">
        <span className="relative flex h-1.5 w-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-bullish opacity-75" />
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-bullish" />
        </span>
        Active
      </Badge>
    );
  }
  if (status === "paused") {
    return (
      <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs">
        Paused
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-muted-foreground text-xs">
      Draft
    </Badge>
  );
}

// ── ExecStatusBadge ────────────────────────────────────────────────────────────
function ExecStatusBadge({ status }: { status: ExecStatus }) {
  const map: Record<ExecStatus, string> = {
    filled: "bg-bullish/15 text-bullish border-bullish/30",
    pending: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
    failed: "bg-bearish/15 text-bearish border-bearish/30",
    cancelled: "bg-muted text-muted-foreground",
  };
  return (
    <Badge className={`text-xs capitalize ${map[status]}`}>{status}</Badge>
  );
}

// ── BotBuilderModal ────────────────────────────────────────────────────────────
function BotBuilderModal({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean;
  editing: BotRecord | null;
  onClose: () => void;
  onSave: (data: Partial<BotRecord> & { activate?: boolean }) => void;
}) {
  const [activeTab, setActiveTab] = useState("setup");
  const [form, setForm] = useState(() => {
    if (editing) {
      return {
        name: editing.name,
        description: editing.description ?? "",
        symbolsRaw: editing.symbols.join(", "),
        position_size_pct: editing.position_size_pct,
        max_concurrent_trades: String(editing.max_concurrent_trades),
        paper_mode: editing.paper_mode,
        webhook_url: editing.webhook_url ?? "",
        entry_conditions: editing.entry_conditions as Condition[],
        exit_conditions: editing.exit_conditions as Condition[],
        stop_loss_pct: "",
        take_profit_pct: "",
      };
    }
    return { ...DEFAULT_BOT_FORM };
  });

  // Reset form when modal opens/closes or editing target changes
  const resetForm = (bot: BotRecord | null) => {
    if (bot) {
      setForm({
        name: bot.name,
        description: bot.description ?? "",
        symbolsRaw: bot.symbols.join(", "),
        position_size_pct: bot.position_size_pct,
        max_concurrent_trades: String(bot.max_concurrent_trades),
        paper_mode: bot.paper_mode,
        webhook_url: bot.webhook_url ?? "",
        entry_conditions: bot.entry_conditions as Condition[],
        exit_conditions: bot.exit_conditions as Condition[],
        stop_loss_pct: "",
        take_profit_pct: "",
      });
    } else {
      setForm({ ...DEFAULT_BOT_FORM });
    }
    setActiveTab("setup");
  };

  // Reset when the modal opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) resetForm(editing);
    else onClose();
  };

  function buildPayload(
    activate?: boolean,
  ): Partial<BotRecord> & { activate?: boolean } {
    const symbols = form.symbolsRaw
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean);

    const exitConditions = [...form.exit_conditions];
    // Append synthetic stop-loss / take-profit conditions to exit
    if (form.stop_loss_pct) {
      exitConditions.push({
        id: "sl",
        indicator: "Stop Loss",
        operator: "is below",
        value: `${form.stop_loss_pct}%`,
      });
    }
    if (form.take_profit_pct) {
      exitConditions.push({
        id: "tp",
        indicator: "Take Profit",
        operator: "is above",
        value: `${form.take_profit_pct}%`,
      });
    }

    return {
      name: form.name.trim(),
      description: form.description.trim() || null,
      symbols,
      position_size_pct: form.position_size_pct,
      max_concurrent_trades: parseInt(form.max_concurrent_trades, 10),
      paper_mode: form.paper_mode,
      webhook_url: form.webhook_url.trim() || null,
      entry_conditions: form.entry_conditions,
      exit_conditions: exitConditions,
      activate,
    };
  }

  const isValid = form.name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">
            {editing ? "Edit Bot" : "New Trading Bot"}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="setup">Setup</TabsTrigger>
            <TabsTrigger value="entry">Entry</TabsTrigger>
            <TabsTrigger value="exit">Exit</TabsTrigger>
            <TabsTrigger value="review">Review</TabsTrigger>
          </TabsList>

          {/* ── Tab: Setup ── */}
          <TabsContent value="setup" className="space-y-5 pt-4">
            <div className="space-y-1.5">
              <Label htmlFor="bot-name">Bot Name</Label>
              <Input
                id="bot-name"
                placeholder="e.g., RSI Oversold Bounce"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bot-desc">Description</Label>
              <Textarea
                id="bot-desc"
                placeholder="Describe this bot's strategy..."
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bot-symbols">Symbols (comma-separated)</Label>
              <Input
                id="bot-symbols"
                placeholder="SPY, QQQ, AAPL"
                value={form.symbolsRaw}
                onChange={(e) =>
                  setForm({ ...form, symbolsRaw: e.target.value })
                }
              />
              <p className="text-xs text-muted-foreground">
                Bot will scan these tickers for matching conditions.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Position Size</Label>
                <span className="text-sm font-mono font-semibold text-foreground">
                  {form.position_size_pct}%
                </span>
              </div>
              <Slider
                min={1}
                max={25}
                step={0.5}
                value={[form.position_size_pct]}
                onValueChange={([v]) =>
                  setForm({ ...form, position_size_pct: v })
                }
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>1%</span>
                <span>25%</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Max Concurrent Trades</Label>
              <Select
                value={form.max_concurrent_trades}
                onValueChange={(v) =>
                  setForm({ ...form, max_concurrent_trades: v })
                }
              >
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["1", "2", "3", "5"].map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-2 px-3 bg-muted/30 rounded-lg border border-border">
              <div>
                <p className="text-sm font-medium">Paper Mode</p>
                <p className="text-xs text-muted-foreground">
                  Simulated execution — no real orders placed
                </p>
              </div>
              <Switch
                checked={form.paper_mode}
                onCheckedChange={(v) => setForm({ ...form, paper_mode: v })}
              />
            </div>

            {!form.paper_mode && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1.5"
              >
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  placeholder="https://your-broker-webhook.com/..."
                  value={form.webhook_url}
                  onChange={(e) =>
                    setForm({ ...form, webhook_url: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  POST requests will be sent here on signal trigger.
                </p>
              </motion.div>
            )}
          </TabsContent>

          {/* ── Tab: Entry ── */}
          <TabsContent value="entry" className="pt-4 space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Define conditions that must ALL be true for the bot to enter a
                position. Multiple conditions are joined with AND logic.
              </p>
              <ConditionBuilder
                conditions={form.entry_conditions}
                onChange={(c) => setForm({ ...form, entry_conditions: c })}
              />
            </div>
          </TabsContent>

          {/* ── Tab: Exit ── */}
          <TabsContent value="exit" className="pt-4 space-y-5">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                Define conditions that trigger an exit. Also configure stop-loss
                and take-profit levels below.
              </p>
              <ConditionBuilder
                conditions={form.exit_conditions}
                onChange={(c) => setForm({ ...form, exit_conditions: c })}
              />
            </div>

            <Separator />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="stop-loss">Stop Loss (%)</Label>
                <Input
                  id="stop-loss"
                  type="number"
                  placeholder="e.g., 2"
                  min={0}
                  max={50}
                  step={0.5}
                  value={form.stop_loss_pct}
                  onChange={(e) =>
                    setForm({ ...form, stop_loss_pct: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Exit if position drops by this %
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="take-profit">Take Profit (%)</Label>
                <Input
                  id="take-profit"
                  type="number"
                  placeholder="e.g., 4"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.take_profit_pct}
                  onChange={(e) =>
                    setForm({ ...form, take_profit_pct: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Exit if position gains this %
                </p>
              </div>
            </div>
          </TabsContent>

          {/* ── Tab: Review ── */}
          <TabsContent value="review" className="pt-4 space-y-5">
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Bot Name
                </p>
                <p className="font-semibold">{form.name || "—"}</p>
              </div>

              {form.description && (
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Description
                  </p>
                  <p className="text-sm text-foreground/80">
                    {form.description}
                  </p>
                </div>
              )}

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Symbols
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {form.symbolsRaw
                    .split(",")
                    .map((s) => s.trim().toUpperCase())
                    .filter(Boolean)
                    .map((s) => (
                      <Badge
                        key={s}
                        variant="outline"
                        className="font-mono text-xs"
                      >
                        {s}
                      </Badge>
                    ))}
                  {!form.symbolsRaw.trim() && (
                    <span className="text-sm text-muted-foreground">
                      None specified
                    </span>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Position Size
                  </p>
                  <p className="font-mono font-semibold">
                    {form.position_size_pct}% per trade
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                    Mode
                  </p>
                  <p className="font-semibold">
                    {form.paper_mode ? "Paper (Simulated)" : "Live"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Entry Conditions
                </p>
                {form.entry_conditions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No conditions set
                  </p>
                ) : (
                  <p className="text-sm font-mono">
                    {form.entry_conditions.map(conditionLabel).join(" AND ")}
                  </p>
                )}
              </div>

              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
                  Exit Conditions
                </p>
                {form.exit_conditions.length === 0 &&
                !form.stop_loss_pct &&
                !form.take_profit_pct ? (
                  <p className="text-sm text-muted-foreground">
                    No conditions set
                  </p>
                ) : (
                  <div className="space-y-0.5">
                    {form.exit_conditions.map((c) => (
                      <p key={c.id} className="text-sm font-mono">
                        {conditionLabel(c)}
                      </p>
                    ))}
                    {form.stop_loss_pct && (
                      <p className="text-sm font-mono text-bearish">
                        Stop Loss: -{form.stop_loss_pct}%
                      </p>
                    )}
                    {form.take_profit_pct && (
                      <p className="text-sm font-mono text-bullish">
                        Take Profit: +{form.take_profit_pct}%
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <Button
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                disabled={!isValid}
                onClick={() => onSave(buildPayload(true))}
              >
                <Zap className="h-4 w-4 mr-1.5" />
                Activate Bot
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                disabled={!isValid}
                onClick={() => onSave(buildPayload(false))}
              >
                Save as Draft
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Bottom nav */}
        <div className="flex justify-between pt-2 border-t border-border mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const tabs = ["setup", "entry", "exit", "review"];
              const idx = tabs.indexOf(activeTab);
              if (idx > 0) setActiveTab(tabs[idx - 1]);
            }}
            disabled={activeTab === "setup"}
          >
            ← Back
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const tabs = ["setup", "entry", "exit", "review"];
              const idx = tabs.indexOf(activeTab);
              if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
            }}
            disabled={activeTab === "review"}
          >
            Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function Bots() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<BotRecord | null>(null);
  const [execFilterBot, setExecFilterBot] = useState<string>("all");
  const [execPage, setExecPage] = useState(0);
  const PAGE_SIZE = 20;

  // ── Queries ──────────────────────────────────────────────────────────────────
  const {
    data: bots = [],
    isLoading: botsLoading,
    refetch: refetchBots,
  } = useQuery({
    queryKey: ["bots"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bots")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as BotRecord[];
    },
  });

  const { data: executions = [], isLoading: execLoading } = useQuery({
    queryKey: ["bot-executions"],
    queryFn: async () => {
      const { data } = await supabase
        .from("bot_executions")
        .select("*, bots(name)")
        .order("executed_at", { ascending: false })
        .limit(100);
      return (data ?? []) as BotExecution[];
    },
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createBot = useMutation({
    mutationFn: async (
      payload: Partial<BotRecord> & { activate?: boolean },
    ) => {
      const { activate, ...rest } = payload;
      const { error } = await supabase.from("bots").insert({
        ...rest,
        user_id: user?.id,
        status: activate ? "active" : "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      refetchBots();
      queryClient.invalidateQueries({ queryKey: ["bot-executions"] });
      toast.success("Bot created successfully");
      setModalOpen(false);
    },
    onError: () => toast.error("Failed to create bot"),
  });

  const updateBot = useMutation({
    mutationFn: async ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<BotRecord> & { activate?: boolean };
    }) => {
      const { activate, ...rest } = payload;
      const { error } = await supabase
        .from("bots")
        .update({
          ...rest,
          ...(activate !== undefined
            ? { status: activate ? "active" : "draft" }
            : {}),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchBots();
      toast.success("Bot updated");
      setModalOpen(false);
      setEditingBot(null);
    },
    onError: () => toast.error("Failed to update bot"),
  });

  const deleteBot = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchBots();
      queryClient.invalidateQueries({ queryKey: ["bot-executions"] });
      toast.success("Bot deleted");
    },
    onError: () => toast.error("Failed to delete bot"),
  });

  const toggleStatus = useMutation({
    mutationFn: async (bot: BotRecord) => {
      const next: BotStatus = bot.status === "active" ? "paused" : "active";
      const { error } = await supabase
        .from("bots")
        .update({ status: next })
        .eq("id", bot.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchBots();
    },
    onError: () => toast.error("Failed to update bot status"),
  });

  // ── Derived ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const active = bots.filter((b) => b.status === "active").length;
    const totalExec = bots.reduce((sum, b) => sum + b.executions_count, 0);
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const paperThisWeek = executions.filter(
      (e) => e.paper_mode && new Date(e.executed_at) >= weekAgo,
    ).length;
    return { total: bots.length, active, totalExec, paperThisWeek };
  }, [bots, executions]);

  const filteredExecPages = useMemo(() => {
    const filtered =
      execFilterBot === "all"
        ? executions
        : executions.filter((e) => e.bot_id === execFilterBot);
    return filtered;
  }, [executions, execFilterBot]);

  const pagedExecs = filteredExecPages.slice(
    execPage * PAGE_SIZE,
    (execPage + 1) * PAGE_SIZE,
  );
  const totalPages = Math.ceil(filteredExecPages.length / PAGE_SIZE);

  // ── Handlers ─────────────────────────────────────────────────────────────────
  function handleOpenNew() {
    setEditingBot(null);
    setModalOpen(true);
  }

  function handleEdit(bot: BotRecord) {
    setEditingBot(bot);
    setModalOpen(true);
  }

  function handleSave(payload: Partial<BotRecord> & { activate?: boolean }) {
    if (editingBot) {
      updateBot.mutate({ id: editingBot.id, payload });
    } else {
      createBot.mutate(payload);
    }
  }

  function handleDelete(id: string) {
    if (window.confirm("Delete this bot? This action cannot be undone.")) {
      deleteBot.mutate(id);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <SubscriptionGate>
        <div className="space-y-6 p-4 sm:p-6">
          {/* Page Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Trading Bots
              </h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                Automate your strategies with rule-based execution
              </p>
            </div>
            <Button
              onClick={handleOpenNew}
              className="gap-1.5 self-start sm:self-auto"
            >
              <Plus className="h-4 w-4" />
              New Bot
            </Button>
          </div>

          {/* Paper Mode Banner */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/25 rounded-lg px-4 py-3"
          >
            <Info className="h-4 w-4 text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-300">
              <span className="font-semibold">
                Paper Mode is on by default.
              </span>{" "}
              All bots run in simulation — no real orders are placed. Enable
              live execution only after thorough testing and at your own risk.
            </p>
          </motion.div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              {
                label: "Total Bots",
                value: botsLoading ? null : stats.total,
                icon: Bot,
                color: "text-foreground",
              },
              {
                label: "Active",
                value: botsLoading ? null : stats.active,
                icon: Activity,
                color: "text-bullish",
              },
              {
                label: "Total Executions",
                value: botsLoading ? null : stats.totalExec,
                icon: BarChart2,
                color: "text-foreground",
              },
              {
                label: "Paper Trades This Week",
                value: execLoading ? null : stats.paperThisWeek,
                icon: Zap,
                color: "text-blue-400",
              },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="bg-card border border-border rounded-lg p-4 flex items-center gap-3"
              >
                <Icon className={`h-5 w-5 shrink-0 ${color}`} />
                <div>
                  <p className="text-xs text-muted-foreground">{label}</p>
                  {value === null ? (
                    <Skeleton className="h-5 w-10 mt-0.5" />
                  ) : (
                    <p className={`text-lg font-mono font-bold ${color}`}>
                      {value}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Bot Cards Grid */}
          {botsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-64 rounded-lg" />
              ))}
            </div>
          ) : bots.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center gap-4 py-20 text-center"
            >
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Bot className="h-8 w-8 text-muted-foreground" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">
                  No bots yet
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Create your first automated strategy
                </p>
              </div>
              <Button onClick={handleOpenNew} className="gap-1.5">
                <Plus className="h-4 w-4" />
                Create Bot
              </Button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {bots.map((bot) => (
                  <BotCard
                    key={bot.id}
                    bot={bot}
                    onEdit={handleEdit}
                    onToggleStatus={(b) => toggleStatus.mutate(b)}
                    onDelete={handleDelete}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}

          {/* Execution Log */}
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-foreground">Execution Log</h2>
              </div>
              <Select
                value={execFilterBot}
                onValueChange={(v) => {
                  setExecFilterBot(v);
                  setExecPage(0);
                }}
              >
                <SelectTrigger className="w-44 h-8 text-sm">
                  <SelectValue placeholder="Filter by bot" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Bots</SelectItem>
                  {bots.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {execLoading ? (
              <div className="p-5 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded" />
                ))}
              </div>
            ) : pagedExecs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
                <AlertTriangle className="h-5 w-5" />
                <p className="text-sm">No executions recorded yet.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="text-xs uppercase tracking-wide">
                          Bot
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">
                          Symbol
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">
                          Action
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">
                          Price
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">
                          Qty
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">
                          Status
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">
                          Mode
                        </TableHead>
                        <TableHead className="text-xs uppercase tracking-wide">
                          Time
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pagedExecs.map((exec) => (
                        <TableRow
                          key={exec.id}
                          className={`border-border ${
                            exec.paper_mode ? "opacity-80" : ""
                          }`}
                        >
                          <TableCell className="text-sm font-medium">
                            {exec.bots?.name ?? "—"}
                          </TableCell>
                          <TableCell className="font-mono text-sm font-semibold">
                            {exec.symbol}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={`text-xs capitalize font-mono ${
                                exec.action === "buy" || exec.action === "cover"
                                  ? "text-bullish border-bullish/30"
                                  : "text-bearish border-bearish/30"
                              }`}
                            >
                              {exec.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {formatPrice(exec.price)}
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {exec.quantity ?? "—"}
                          </TableCell>
                          <TableCell>
                            <ExecStatusBadge status={exec.status} />
                          </TableCell>
                          <TableCell>
                            {exec.paper_mode ? (
                              <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs">
                                Paper
                              </Badge>
                            ) : (
                              <Badge className="bg-orange-500/15 text-orange-400 border-orange-500/30 text-xs">
                                Live
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground font-mono">
                            {relativeTime(exec.executed_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Page {execPage + 1} of {totalPages} (
                      {filteredExecPages.length} total)
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={execPage === 0}
                        onClick={() => setExecPage((p) => Math.max(0, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={execPage >= totalPages - 1}
                        onClick={() =>
                          setExecPage((p) => Math.min(totalPages - 1, p + 1))
                        }
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bot Builder Modal */}
        <BotBuilderModal
          open={modalOpen}
          editing={editingBot}
          onClose={() => {
            setModalOpen(false);
            setEditingBot(null);
          }}
          onSave={handleSave}
        />
      </SubscriptionGate>
    </DashboardLayout>
  );
}
