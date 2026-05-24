import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

const ACTION_LABELS: Record<string, string> = {
  strong_buy: "Strong Buy", buy: "Buy", hold: "Hold",
  watch: "Watch", exit: "Exit", strong_exit: "Strong Exit",
};

const VALID_STRATEGY_TYPES = [
  'covered_call','cash_secured_put','call_debit','put_debit','call_spread',
  'put_spread','long_stock','short_stock','hard_money','tax_lien','p2p_lending','other',
];

const VALID_ASSET_CLASSES = ['options','equities','real_estate','lending','crypto','other'];

export default function TopRecommendation() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [shares, setShares] = useState("1");

  const { data: signals = [] } = useQuery({
    queryKey: ['signals', 'top-recommendation'],
    queryFn: async () => {
      const { data } = await supabase
        .from('signals')
        .select('*')
        .order('signal_score', { ascending: false })
        .limit(4);
      return data ?? [];
    },
  });

  const top = signals[0];

  const { mutate: executeTrade, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !top) throw new Error("No user or signal");
      const sharesCount = parseFloat(shares) || 1;
      const entryPrice = top.entry_price ?? 0;
      const totalValue = entryPrice * sharesCount;
      const today = new Date().toISOString().split('T')[0];
      const strategyType = VALID_STRATEGY_TYPES.includes(top.strategy_type ?? '') ? top.strategy_type! : 'other';
      const assetClass = VALID_ASSET_CLASSES.includes(top.asset_class ?? '') ? top.asset_class! : 'other';

      const { data: pos, error: posErr } = await supabase
        .from('positions')
        .insert({
          user_id: user.id,
          ticker: top.ticker,
          company_name: top.company_name,
          strategy_type: strategyType,
          asset_class: assetClass,
          entry_date: today,
          entry_price: entryPrice,
          current_price: entryPrice,
          shares_contracts: sharesCount,
          value: totalValue,
          pnl_dollars: 0,
          pnl_percent: 0,
          signal_score: top.signal_score,
          status: 'open',
        })
        .select()
        .single();
      if (posErr) throw posErr;

      await supabase.from('transactions').insert({
        user_id: user.id,
        position_id: pos.id,
        ticker: top.ticker,
        action: 'open',
        strategy_type: strategyType,
        price: entryPrice,
        quantity: sharesCount,
        total_value: totalValue,
        signal_score_at_entry: top.signal_score,
      });

      const { data: portfolio } = await supabase
        .from('portfolios')
        .select('deployed_capital, available_capital')
        .eq('user_id', user.id)
        .maybeSingle();

      if (portfolio) {
        await supabase.from('portfolios').update({
          deployed_capital: (portfolio.deployed_capital ?? 0) + totalValue,
          available_capital: Math.max(0, (portfolio.available_capital ?? 0) - totalValue),
        }).eq('user_id', user.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['portfolio'] });
      toast.success(`Position opened: ${top?.ticker}`);
      setOpen(false);
      setShares("1");
    },
    onError: (err: any) => {
      toast.error(err.message ?? 'Failed to execute trade');
    },
  });

  if (!top) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">No signals available</p>
      </div>
    );
  }

  const reasons = (top.reasoning as string[] | null) ?? [];
  const estimatedValue = (top.entry_price ?? 0) * (parseFloat(shares) || 1);
  const rrRatio = top.entry_price && top.target_price && top.stop_price
    ? ((top.target_price - top.entry_price) / (top.entry_price - top.stop_price)).toFixed(1)
    : null;

  return (
    <>
      <div className="rounded-lg border border-bullish/30 bg-card p-5 glow-green">
        <div className="mb-1 flex items-center justify-between">
          <span className="font-body text-xs font-semibold uppercase tracking-widest text-bullish">Top Pick</span>
          <span className="rounded-full bg-bullish/15 px-2 py-0.5 font-mono text-xs font-bold text-bullish">
            {top.signal_score}/100
          </span>
        </div>
        <h3 className="font-display text-2xl font-bold text-foreground">{top.ticker}</h3>
        <span className="mt-0.5 inline-block rounded bg-bullish/10 px-2 py-0.5 font-mono text-xs font-semibold text-bullish">
          {ACTION_LABELS[top.action ?? ''] ?? top.action}
        </span>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { label: "Entry",  val: top.entry_price  ? `$${top.entry_price}`  : "—" },
            { label: "Target", val: top.target_price ? `$${top.target_price}` : "—", color: "text-bullish" },
            { label: "Stop",   val: top.stop_price   ? `$${top.stop_price}`   : "—", color: "text-bearish" },
            { label: "R/R",    val: rrRatio ? `${rrRatio}:1` : "—", color: parseFloat(rrRatio ?? "0") >= 2 ? "text-bullish" : "text-watch" },
          ].map((i) => (
            <div key={i.label} className="rounded-md bg-background p-2 text-center">
              <span className="block text-[10px] uppercase text-muted-foreground">{i.label}</span>
              <span className={`font-mono text-sm font-semibold ${i.color ?? "text-foreground"}`}>{i.val}</span>
            </div>
          ))}
        </div>
        {top.position_size_dollars != null && (
          <div className="mt-3">
            <span className="text-[10px] uppercase text-muted-foreground">Position Size</span>
            <p className="font-mono text-sm text-foreground">
              ${top.position_size_dollars.toLocaleString()} ({top.position_size_pct ?? 0}%)
            </p>
          </div>
        )}
        {reasons.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-xs text-muted-foreground">
                <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-bullish" />
                {r}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setOpen(true)}
          className="mt-4 w-full rounded-lg bg-primary py-2.5 font-body text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110"
        >
          Execute Trade
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm border-border bg-card text-foreground">
          <DialogHeader>
            <DialogTitle className="font-display">Execute Trade — {top.ticker}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-md bg-background p-2">
                <span className="block uppercase text-muted-foreground">Action</span>
                <span className="font-mono font-semibold text-bullish">
                  {ACTION_LABELS[top.action ?? ''] ?? top.action}
                </span>
              </div>
              <div className="rounded-md bg-background p-2">
                <span className="block uppercase text-muted-foreground">Entry Price</span>
                <span className="font-mono font-semibold">{top.entry_price ? `$${top.entry_price}` : "Market"}</span>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">Shares / Contracts</label>
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={shares}
                onChange={(e) => setShares(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground outline-none transition-fast focus:border-bullish"
              />
            </div>
            <div className="flex justify-between rounded-md bg-background p-3 text-sm">
              <span className="text-muted-foreground">Estimated Value</span>
              <span className="font-mono font-semibold text-foreground">
                ${estimatedValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <button
              onClick={() => executeTrade()}
              disabled={isPending}
              className="w-full rounded-lg bg-primary py-2.5 font-body text-sm font-semibold text-primary-foreground transition-fast hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Opening Position…" : "Confirm Trade"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
