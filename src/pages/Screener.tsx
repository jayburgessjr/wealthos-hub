import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Play,
  Save,
  Trash2,
  BarChart2,
  Bell,
  Star,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScreenerFilters {
  min_price: string;
  max_price: string;
  min_volume: string;
  min_change_pct: string;
  max_change_pct: string;
}

interface ScreenerResult {
  ticker: string;
  price: number;
  open: number;
  change: number;
  change_pct: number;
  volume: number;
  vwap: number;
  high: number;
  low: number;
}

interface SavedPreset {
  id: string;
  name: string;
  filters: ScreenerFilters;
  created_at: string;
}

// ─── Preset definitions ───────────────────────────────────────────────────────

interface PresetDefinition {
  label: string;
  filters: Partial<ScreenerFilters>;
}

const PRESET_SCREENERS: PresetDefinition[] = [
  {
    label: "High Volume Breakout",
    filters: { min_volume: "5000000", min_change_pct: "2" },
  },
  {
    label: "RSI Oversold",
    filters: { max_change_pct: "-3", min_volume: "1000000" },
  },
  {
    label: "Momentum Leaders",
    filters: { min_change_pct: "3", min_volume: "2000000", min_price: "10" },
  },
  {
    label: "Large Cap Movers",
    filters: { min_price: "50", min_volume: "3000000" },
  },
  {
    label: "Penny Runners",
    filters: { min_price: "1", max_price: "10", min_change_pct: "5" },
  },
  {
    label: "Value Dip",
    filters: { max_change_pct: "-2", min_price: "20", min_volume: "500000" },
  },
];

const EMPTY_FILTERS: ScreenerFilters = {
  min_price: "",
  max_price: "",
  min_volume: "",
  min_change_pct: "",
  max_change_pct: "",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatVolume(v: number): string {
  if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
  return String(v);
}

function formatPrice(p: number): string {
  return `$${p.toFixed(2)}`;
}

function formatChangePct(pct: number): string {
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`;
}

function avg(arr: number[]): number {
  if (!arr.length) return 0;
  return arr.reduce((s, n) => s + n, 0) / arr.length;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function Screener() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<ScreenerFilters>(EMPTY_FILTERS);
  const [runTrigger, setRunTrigger] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  // ─── Screener query ────────────────────────────────────────────────────────

  const { data: screenData, isLoading, isFetching } = useQuery({
    queryKey: ["screener", filters, runTrigger],
    queryFn: async () => {
      if (runTrigger === 0) return { results: [], total_matched: 0, message: "" };

      const parsedFilters: Record<string, number | undefined> = {
        min_price: filters.min_price ? Number(filters.min_price) : undefined,
        max_price: filters.max_price ? Number(filters.max_price) : undefined,
        min_volume: filters.min_volume ? Number(filters.min_volume) : undefined,
        min_change_pct: filters.min_change_pct ? Number(filters.min_change_pct) : undefined,
        max_change_pct: filters.max_change_pct ? Number(filters.max_change_pct) : undefined,
      };

      // Remove undefined keys
      Object.keys(parsedFilters).forEach((k) => {
        if (parsedFilters[k] === undefined) delete parsedFilters[k];
      });

      const { data, error } = await supabase.functions.invoke("screen-assets", {
        body: { filters: parsedFilters, limit: 100 },
      });

      if (error) throw error;
      return data ?? { results: [], total_matched: 0 };
    },
    enabled: runTrigger > 0,
  });

  const results: ScreenerResult[] = screenData?.results ?? [];
  const hasRun = runTrigger > 0;
  const isBusy = isLoading || isFetching;

  // ─── Saved presets query ───────────────────────────────────────────────────

  const { data: savedPresets = [] } = useQuery<SavedPreset[]>({
    queryKey: ["screener-presets"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("screener_presets")
        .select("id, name, filters, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // ─── Save preset mutation ──────────────────────────────────────────────────

  const savePresetMutation = useMutation({
    mutationFn: async (name: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("screener_presets").insert({
        user_id: user.id,
        name,
        filters,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screener-presets"] });
      toast.success("Preset saved");
      setSaveDialogOpen(false);
      setPresetName("");
    },
    onError: (err: Error) => {
      toast.error(`Failed to save preset: ${err.message}`);
    },
  });

  // ─── Delete preset mutation ────────────────────────────────────────────────

  const deletePresetMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("screener_presets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["screener-presets"] });
      toast.success("Preset deleted");
    },
    onError: (err: Error) => {
      toast.error(`Failed to delete preset: ${err.message}`);
    },
  });

  // ─── Handlers ─────────────────────────────────────────────────────────────

  function applyPreset(preset: PresetDefinition) {
    setFilters({ ...EMPTY_FILTERS, ...preset.filters });
    setActivePreset(preset.label);
  }

  function applyUserPreset(preset: SavedPreset) {
    setFilters({ ...EMPTY_FILTERS, ...(preset.filters as Partial<ScreenerFilters>) });
    setActivePreset(preset.name);
  }

  function handleFilterChange(key: keyof ScreenerFilters, value: string) {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setActivePreset(null);
  }

  function handleRun() {
    setRunTrigger((t) => t + 1);
  }

  function handleSave() {
    if (!presetName.trim()) return;
    savePresetMutation.mutate(presetName.trim());
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  const totalVolume = results.reduce((s, r) => s + r.volume, 0);
  const avgChangePct = avg(results.map((r) => r.change_pct));

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <div className="flex flex-col gap-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Search className="w-6 h-6 text-muted-foreground" />
              Asset Screener
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Scan the US equity market with real-time filters
            </p>
          </div>
        </div>

        {/* Preset Screener Pills */}
        <div className="flex flex-wrap gap-2">
          {PRESET_SCREENERS.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                activePreset === preset.label
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-muted-foreground"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Filter Panel */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-accent/50 transition-colors"
            onClick={() => setFiltersOpen((o) => !o)}
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              Filters
            </span>
            {filtersOpen ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {filtersOpen && (
            <div className="px-4 pb-4 border-t border-border">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-4">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min Price ($)</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.min_price}
                    onChange={(e) => handleFilterChange("min_price", e.target.value)}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max Price ($)</label>
                  <Input
                    type="number"
                    placeholder="∞"
                    value={filters.max_price}
                    onChange={(e) => handleFilterChange("max_price", e.target.value)}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min Volume</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={filters.min_volume}
                    onChange={(e) => handleFilterChange("min_volume", e.target.value)}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Min Chg%</label>
                  <Input
                    type="number"
                    placeholder="-100"
                    value={filters.min_change_pct}
                    onChange={(e) => handleFilterChange("min_change_pct", e.target.value)}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Max Chg%</label>
                  <Input
                    type="number"
                    placeholder="100"
                    value={filters.max_change_pct}
                    onChange={(e) => handleFilterChange("max_change_pct", e.target.value)}
                    className="h-8 text-sm font-mono"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    onClick={handleRun}
                    disabled={isBusy}
                    className="h-8 w-full gap-1.5 text-sm"
                  >
                    <Play className="w-3.5 h-3.5" />
                    {isBusy ? "Running…" : "Run Screener"}
                  </Button>
                </div>
              </div>

              {/* Save preset row */}
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSaveDialogOpen(true)}
                  className="gap-1.5 text-xs h-7"
                >
                  <Save className="w-3 h-3" />
                  Save current filters
                </Button>
              </div>

              {/* User saved presets */}
              {savedPresets.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {savedPresets.map((preset) => (
                    <div
                      key={preset.id}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-xs transition-colors ${
                        activePreset === preset.name
                          ? "bg-primary/10 border-primary/40 text-primary"
                          : "bg-accent/30 border-border text-muted-foreground"
                      }`}
                    >
                      <button
                        onClick={() => applyUserPreset(preset)}
                        className="hover:text-foreground transition-colors"
                      >
                        {preset.name}
                      </button>
                      <button
                        onClick={() => deletePresetMutation.mutate(preset.id)}
                        className="ml-1 text-muted-foreground hover:text-bearish transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Stats Bar */}
        {hasRun && !isBusy && results.length > 0 && (
          <div className="flex flex-wrap gap-4 text-sm">
            <span className="text-muted-foreground">
              <span className="text-foreground font-mono font-medium">{results.length}</span> results
            </span>
            <span className="text-muted-foreground">
              Avg Change:{" "}
              <span
                className={`font-mono font-medium ${
                  avgChangePct >= 0 ? "text-bullish" : "text-bearish"
                }`}
              >
                {formatChangePct(avgChangePct)}
              </span>
            </span>
            <span className="text-muted-foreground">
              Total Volume:{" "}
              <span className="text-foreground font-mono font-medium">
                {formatVolume(totalVolume)}
              </span>
            </span>
          </div>
        )}

        {/* Results Table */}
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          {isBusy ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full rounded-md" />
              ))}
            </div>
          ) : !hasRun ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
              <Search className="w-10 h-10 opacity-30" />
              <p className="text-base">Run a screen to see results</p>
              <p className="text-sm opacity-70">
                Set your filters above and click <strong>Run Screener</strong>
              </p>
            </div>
          ) : results.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-3">
              <BarChart2 className="w-10 h-10 opacity-30" />
              <p className="text-base">No results match your filters</p>
              <p className="text-sm opacity-70">Try widening your criteria</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-muted-foreground text-xs font-medium w-24">
                    Ticker
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Price
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Change
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Chg%
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Volume
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    VWAP
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    High
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right">
                    Low
                  </TableHead>
                  <TableHead className="text-muted-foreground text-xs font-medium text-right w-40">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row) => (
                  <TableRow
                    key={row.ticker}
                    className="border-border hover:bg-accent/30 transition-colors"
                  >
                    <TableCell className="font-mono font-bold text-foreground text-sm">
                      {row.ticker}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">
                      {formatPrice(row.price)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm ${
                        row.change >= 0 ? "text-bullish" : "text-bearish"
                      }`}
                    >
                      {row.change >= 0 ? "+" : ""}
                      {row.change.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-sm font-medium ${
                        row.change_pct >= 0 ? "text-bullish" : "text-bearish"
                      }`}
                    >
                      {formatChangePct(row.change_pct)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {formatVolume(row.volume)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {formatPrice(row.vwap)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {formatPrice(row.high)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {formatPrice(row.low)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => navigate(`/chart?ticker=${row.ticker}`)}
                        >
                          <BarChart2 className="w-3 h-3" />
                          Chart
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => navigate("/alerts")}
                        >
                          <Bell className="w-3 h-3" />
                          Alert
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-6 px-2 text-xs gap-1"
                          onClick={() => toast.success(`Added ${row.ticker} to watchlist`)}
                        >
                          <Star className="w-3 h-3" />
                          Watch
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* Save Preset Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Screener Preset</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-sm text-muted-foreground mb-2 block">Preset name</label>
            <Input
              placeholder="e.g. My Momentum Setup"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!presetName.trim() || savePresetMutation.isPending}
            >
              {savePresetMutation.isPending ? "Saving…" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
