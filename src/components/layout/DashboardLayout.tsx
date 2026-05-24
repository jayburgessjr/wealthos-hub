import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import RightBar from "./RightBar";
import DemoBanner from "../DemoBanner";

const WEALTH_ROUTES = new Set([
  "/retirement",
  "/dividend-tracker",
  "/real-estate",
  "/collectibles",
  "/insurance",
  "/tax-harvesting",
  "/estate-planning",
  "/entity-structure",
  "/fundraising",
]);

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const isHousehold = location.pathname.startsWith("/household");
  const isWealth = WEALTH_ROUTES.has(location.pathname);

  const modeClass = isHousehold ? " household" : isWealth ? " wealth" : "";

  return (
    <div
      className={`flex h-screen flex-col bg-background overflow-hidden${modeClass}`}
    >
      <DemoBanner />
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">{children}</main>
        <RightBar />
      </div>
    </div>
  );
}
