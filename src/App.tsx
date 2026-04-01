import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import AuthProvider, { useAuth } from "@/components/AuthProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DemoProvider } from "@/components/DemoProvider";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Signals from "./pages/Signals";
import Positions from "./pages/Positions";
import Compound from "./pages/Compound";
import AIAdvisor from "./pages/AIAdvisor";
import Performance from "./pages/Performance";
import MarketRegime from "./pages/MarketRegime";
import StrategyAllocator from "./pages/StrategyAllocator";
import Watchlist from "./pages/Watchlist";
import SettingsPage from "./pages/Settings";
import AdminDashboard from "./pages/Admin";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center bg-background"><span className="text-muted-foreground">Loading...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
    <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
    <Route path="/signals" element={<ProtectedRoute><Signals /></ProtectedRoute>} />
    <Route path="/positions" element={<ProtectedRoute><Positions /></ProtectedRoute>} />
    <Route path="/compound" element={<ProtectedRoute><Compound /></ProtectedRoute>} />
    <Route path="/strategy-allocator" element={<ProtectedRoute><StrategyAllocator /></ProtectedRoute>} />
    <Route path="/ai-advisor" element={<ProtectedRoute><AIAdvisor /></ProtectedRoute>} />
    <Route path="/performance" element={<ProtectedRoute><Performance /></ProtectedRoute>} />
    <Route path="/market-regime" element={<ProtectedRoute><MarketRegime /></ProtectedRoute>} />
    <Route path="/watchlist" element={<ProtectedRoute><Watchlist /></ProtectedRoute>} />
    <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
    <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
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
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </BrowserRouter>
        </TooltipProvider>
      </DemoProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
