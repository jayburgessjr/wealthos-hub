import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import SignalCards from "@/components/dashboard/SignalCards";
import PriceChart from "@/components/dashboard/PriceChart";
import TopRecommendation from "@/components/dashboard/TopRecommendation";
import PositionsTable from "@/components/dashboard/PositionsTable";
import CompoundPanel from "@/components/dashboard/CompoundPanel";
import WatchlistSentiment from "@/components/dashboard/WatchlistSentiment";
import AllocationDonut from "@/components/dashboard/AllocationDonut";
import MorningPulse from "@/components/dashboard/MorningPulse";

export default function Dashboard() {
  const [selectedTicker, setSelectedTicker] = useState<string>("SPY");

  const { data: firstSignal } = useQuery({
    queryKey: ['signals', 'first'],
    queryFn: async () => {
      const { data } = await supabase
        .from('signals')
        .select('ticker')
        .order('signal_score', { ascending: false })
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
        {/* Morning Pulse */}
        <MorningPulse />

        {/* Row 1 — Signal Cards */}
        <SignalCards onSelectTicker={setSelectedTicker} />

        {/* Row 2 — Chart + Top Recommendation */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <PriceChart ticker={selectedTicker} />
          <TopRecommendation />
        </div>

        {/* Row 3 — Positions, Compound, Watchlist/Sentiment */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PositionsTable />
          <CompoundPanel />
          <WatchlistSentiment />
        </div>

        {/* Row 4 — Portfolio Allocation */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <AllocationDonut />
        </div>
      </div>
    </DashboardLayout>
  );
}
