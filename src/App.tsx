import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DemoProvider } from "@/components/DemoProvider";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import Decisions from "./pages/Decisions";
import Dashboard from "./pages/Dashboard";
import Signals from "./pages/Signals";
import Positions from "./pages/Positions";
import Compound from "./pages/Compound";
import AIAdvisor from "./pages/AIAdvisor";
import Performance from "./pages/Performance";
import MarketRegime from "./pages/MarketRegime";
import StrategyAllocator from "./pages/StrategyAllocator";
import Watchlist from "./pages/Watchlist";
import Documents from "./pages/Documents";
import SettingsPage from "./pages/Settings";
import AdminDashboard from "./pages/Admin";
import NotFound from "./pages/NotFound";
import Crypto from "./pages/Crypto";
import Markets from "./pages/Markets";
import News from "./pages/News";
import Quantum from "./pages/Quantum";
import Security from "./pages/Security";

const queryClient = new QueryClient();

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/onboarding" element={<Onboarding />} />
    <Route path="/decisions" element={<Decisions />} />
    <Route path="/dashboard" element={<Dashboard />} />
    <Route path="/signals" element={<Signals />} />
    <Route path="/positions" element={<Positions />} />
    <Route path="/compound" element={<Compound />} />
    <Route path="/strategy-allocator" element={<StrategyAllocator />} />
    <Route path="/ai-advisor" element={<AIAdvisor />} />
    <Route path="/performance" element={<Performance />} />
    <Route path="/market-regime" element={<MarketRegime />} />
    <Route path="/watchlist" element={<Watchlist />} />
    <Route path="/documents" element={<Documents />} />
    <Route path="/settings" element={<SettingsPage />} />
    <Route path="/admin" element={<AdminDashboard />} />
    <Route path="/crypto" element={<Crypto />} />
    <Route path="/markets" element={<Markets />} />
    <Route path="/news" element={<News />} />
    <Route path="/quantum" element={<Quantum />} />
    <Route path="/security" element={<Security />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <DemoProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </TooltipProvider>
      </DemoProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
