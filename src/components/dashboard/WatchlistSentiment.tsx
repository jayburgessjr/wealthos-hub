import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/AuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { useDemo } from "@/components/DemoProvider";
import { sandboxSignals } from "@/data/sandboxData";

const WatchlistItem = ({ item }: { item: any }) => {
  const { isDemoMode } = useDemo();
  const [priceData, setPriceData] = useState<{ price: number; change: number } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isDemoMode) {
      setPriceData({ price: item.ticker === 'NVDA' ? 890.20 : 172.50, change: 2.4 });
      setLoading(false);
      return;
    }
    const fetchPrice = async () => {
      try {
        const { data, error } = await supabase.functions.invoke("get-price-data", {
          body: { ticker: item.ticker, timeframe: "1D" },
        });
        if (error) throw error;
        if (data?.candles && data.candles.length > 0) {
          const first = data.candles[0];
          const last = data.candles[data.candles.length - 1];
          const change = ((last.close - first.open) / first.open) * 100;
          setPriceData({ price: last.close, change: Number(change.toFixed(2)) });
        }
      } catch (err) {
        console.error(`Error fetching price for ${item.ticker}:`, err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrice();
  }, [item.ticker]);

  return (
    <div className="flex items-center justify-between rounded-md p-2 transition-fast hover:bg-accent/30">
      <div>
        <span className="font-mono text-sm font-semibold text-foreground">{item.ticker}</span>
        <span className="ml-2 text-xs text-muted-foreground">{item.company_name}</span>
      </div>
      <div className="flex items-center gap-3">
        {loading ? (
          <Skeleton className="h-4 w-20" />
        ) : (
          <>
            <span className="font-mono text-sm text-foreground">${priceData?.price ?? '—'}</span>
            <span className={`font-mono text-xs font-semibold ${priceData && priceData.change >= 0 ? "text-bullish" : "text-bearish"}`}>
              {priceData && priceData.change >= 0 ? "+" : ""}{priceData?.change ?? '0'}%
            </span>
          </>
        )}
        <span className="rounded-full bg-accent px-2 py-0.5 font-mono text-xs text-foreground">
          {item.alert_signal_above || '—'}
        </span>
      </div>
    </div>
  );
};

export default function WatchlistSentiment() {
  const { user } = useAuth();
  const { isDemoMode } = useDemo();

  const { data: watchlist = [], isLoading: watchLoading } = useQuery({
    queryKey: ['watchlist', user?.id, isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return [
        { id: 'w1', ticker: 'NVDA', company_name: 'NVIDIA Corp', alert_signal_above: 90 },
        { id: 'w2', ticker: 'AAPL', company_name: 'Apple Inc', alert_signal_above: 85 }
      ];
      const { data } = await supabase
        .from('watchlist')
        .select('*')
        .eq('user_id', user!.id);
      return data ?? [];
    },
    enabled: !!user || isDemoMode,
  });

  const { data: signals = [], isLoading: signalsLoading } = useQuery({
    queryKey: ['signals', 'sentiment', isDemoMode ? 'demo' : 'live'],
    queryFn: async () => {
      if (isDemoMode) return sandboxSignals;
      const { data } = await supabase
        .from('signals')
        .select('*')
        .order('signal_score', { ascending: false })
        .limit(3);
      return data ?? [];
    },
  });

  const ACTION_LABELS: Record<string, string> = {
    strong_buy: "Bullish", buy: "Bullish", hold: "Neutral",
    watch: "Neutral", exit: "Bearish", strong_exit: "Bearish",
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Watchlist */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Watchlist</h3>
        <div className="space-y-2">
          {watchLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)
          ) : watchlist.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">Watchlist is empty</p>
          ) : (
            watchlist.map((w) => <WatchlistItem key={w.id} item={w} />)
          )}
        </div>
      </div>

      {/* Sentiment Feed */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-display text-sm font-semibold text-foreground">Live Market Sentiment</h3>
        <div className="space-y-3">
          {signalsLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
          ) : signals.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-4">No sentiment data available</p>
          ) : (
            signals.map((s) => (
              <div key={s.id} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold">{s.ticker}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {ACTION_LABELS[s.action || 'hold']}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">Signal Score: {s.signal_score}</span>
                  <div className="flex h-1.5 w-24 overflow-hidden rounded-full bg-border">
                    <div 
                      className={`h-full ${s.signal_score >= 50 ? 'bg-bullish' : 'bg-bearish'}`} 
                      style={{ width: `${s.signal_score}%` }} 
                    />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
