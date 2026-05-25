import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SignalCards from "@/components/dashboard/SignalCards";
import TopRecommendation from "@/components/dashboard/TopRecommendation";
import PositionsTable from "@/components/dashboard/PositionsTable";
import CompoundPanel from "@/components/dashboard/CompoundPanel";
import WatchlistSentiment from "@/components/dashboard/WatchlistSentiment";
import AllocationDonut from "@/components/dashboard/AllocationDonut";
import MorningPulse from "@/components/dashboard/MorningPulse";
import PredictionMarket from "@/components/dashboard/PredictionMarket";

export default function Dashboard() {
  const [selectedTicker, setSelectedTicker] = useState<string>("SPY");

  const { data: firstSignal } = useQuery({
    queryKey: ["signals", "first"],
    queryFn: async () => {
      const { data } = await supabase
        .from("signals")
        .select("ticker")
        .order("signal_score", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (firstSignal?.ticker) {
      setSelectedTicker(firstSignal.ticker);
    }
  }, [firstSignal]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ── 1. Open book + Compound growth ── */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
          <CompoundPanel />
          <PositionsTable />
        </div>

        {/* ── 3. Signal cards (full width) ── */}
        <SignalCards onSelectTicker={setSelectedTicker} />

        {/* ── 4. Top pick + Allocation + Watchlist ── */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TopRecommendation />
          <AllocationDonut />
          <WatchlistSentiment />
        </div>

        {/* ── 5. Prediction market ── */}
        <PredictionMarket />

        {/* ── 6. Daily briefing (morning pulse — context, not command) ── */}
        <div>
          <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground/40">
            Daily Briefing
          </p>
          <MorningPulse />
        </div>
      </div>
    </DashboardLayout>
  );
}
