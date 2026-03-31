import DashboardLayout from "@/components/layout/DashboardLayout";
import SignalCards from "@/components/dashboard/SignalCards";
import PriceChart from "@/components/dashboard/PriceChart";
import TopRecommendation from "@/components/dashboard/TopRecommendation";
import PositionsTable from "@/components/dashboard/PositionsTable";
import CompoundPanel from "@/components/dashboard/CompoundPanel";
import WatchlistSentiment from "@/components/dashboard/WatchlistSentiment";

export default function Dashboard() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Row 1 — Signal Cards */}
        <SignalCards />

        {/* Row 2 — Chart + Top Recommendation */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
          <PriceChart />
          <TopRecommendation />
        </div>

        {/* Row 3 — Positions, Compound, Watchlist/Sentiment */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <PositionsTable />
          <CompoundPanel />
          <WatchlistSentiment />
        </div>
      </div>
    </DashboardLayout>
  );
}
