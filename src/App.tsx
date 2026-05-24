import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { HouseholdBudgetProvider } from "@/context/HouseholdBudgetContext";

// Household pages (stubs — will be replaced in Tasks 9-29)
import HouseholdSetup from "./pages/household/HouseholdSetup";
import HouseholdDashboard from "./pages/household/HouseholdDashboard";
import HouseholdBudget from "./pages/household/HouseholdBudget";
import HouseholdBills from "./pages/household/HouseholdBills";
import HouseholdIncome from "./pages/household/HouseholdIncome";
import HouseholdSubscriptions from "./pages/household/HouseholdSubscriptions";
import HouseholdGoals from "./pages/household/HouseholdGoals";
import HouseholdDebts from "./pages/household/HouseholdDebts";
import HouseholdBankAccounts from "./pages/household/HouseholdBankAccounts";
import HouseholdCreditScores from "./pages/household/HouseholdCreditScores";
import HouseholdNetWorth from "./pages/household/HouseholdNetWorth";
import HouseholdSimulator from "./pages/household/HouseholdSimulator";
import HouseholdWeeklyMeeting from "./pages/household/HouseholdWeeklyMeeting";
import HouseholdMonthlyCloseout from "./pages/household/HouseholdMonthlyCloseout";
import HouseholdQuarterlyReview from "./pages/household/HouseholdQuarterlyReview";
import HouseholdAIAssistant from "./pages/household/HouseholdAIAssistant";
import HouseholdCFOReports from "./pages/household/HouseholdCFOReports";
import HouseholdCareers from "./pages/household/HouseholdCareers";
import HouseholdVision from "./pages/household/HouseholdVision";
import HouseholdTasks from "./pages/household/HouseholdTasks";
import HouseholdSettings from "./pages/household/HouseholdSettings";
import AcceptInvitation from "./pages/household/AcceptInvitation";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DemoProvider } from "@/components/DemoProvider";
import AuthProvider from "@/components/AuthProvider";
import ProtectedRoute from "@/components/ProtectedRoute";
import LegalDisclosureGate from "@/components/legal/LegalDisclosureGate";
import { Sentry } from "@/lib/sentry";
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
import FinancialAdvisor from "./pages/FinancialAdvisor";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import PnLCalendar from "./pages/PnLCalendar";
import PositionSizer from "./pages/PositionSizer";
import TradingJournal from "./pages/TradingJournal";
import WeeklyBriefing from "./pages/WeeklyBriefing";
import TaxHarvesting from "./pages/TaxHarvesting";
import EarningsCalendar from "./pages/EarningsCalendar";
import HeatMap from "./pages/HeatMap";
import PaperTrading from "./pages/PaperTrading";
import TermsOfService from "./pages/TermsOfService";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Disclaimer from "./pages/Disclaimer";
import Strategy123 from "./pages/Strategy123";
import Playbook from "./pages/Playbook";
import Alerts from "./pages/Alerts";
import Chart from "./pages/Chart";
import Screener from "./pages/Screener";
import InsiderActivity from "./pages/InsiderActivity";
import Community from "./pages/Community";
import About from "./pages/About";
import Profile from "./pages/Profile";
import Bots from "./pages/Bots";
import Forex from "./pages/Forex";
import Commodities from "./pages/Commodities";
import FixedIncome from "./pages/FixedIncome";
import PrivateEquity from "./pages/PrivateEquity";
import MergersAcquisitions from "./pages/MergersAcquisitions";
import Kalshi from "./pages/Kalshi";
import Polymarket from "./pages/Polymarket";
import SportsTrading from "./pages/SportsTrading";
import LotteryEV from "./pages/LotteryEV";
import FinancialNews from "./pages/FinancialNews";
import MyPortfolio from "./pages/MyPortfolio";
import Retirement from "./pages/Retirement";
import DividendTracker from "./pages/DividendTracker";
import RealEstate from "./pages/RealEstate";
import Collectibles from "./pages/Collectibles";
import OptionsFlow from "./pages/OptionsFlow";
import Macro from "./pages/Macro";
import IpoTracker from "./pages/IpoTracker";
import EstatePlanning from "./pages/EstatePlanning";
import Insurance from "./pages/Insurance";
import EntityStructure from "./pages/EntityStructure";
import Fundraising from "./pages/Fundraising";
import WealthDashboard from "./pages/WealthDashboard";
import HomeDashboard from "./pages/HomeDashboard";

const queryClient = new QueryClient();

const HouseholdRoutes = () => (
  <HouseholdBudgetProvider>
    <Routes>
      {/* Dashboard — standalone */}
      <Route path="/" element={<HouseholdDashboard />} />
      <Route path="/setup" element={<HouseholdSetup />} />

      {/* Money In */}
      <Route
        path="/money-in"
        element={<Navigate to="/household/money-in/income" replace />}
      />
      <Route path="/money-in/income" element={<HouseholdIncome />} />
      <Route
        path="/money-in/bank-accounts"
        element={<HouseholdBankAccounts />}
      />

      {/* Money Out */}
      <Route
        path="/money-out"
        element={<Navigate to="/household/money-out/budget" replace />}
      />
      <Route path="/money-out/budget" element={<HouseholdBudget />} />
      <Route path="/money-out/bills" element={<HouseholdBills />} />
      <Route
        path="/money-out/subscriptions"
        element={<HouseholdSubscriptions />}
      />
      <Route path="/money-out/debts" element={<HouseholdDebts />} />

      {/* Future */}
      <Route
        path="/future"
        element={<Navigate to="/household/future/goals" replace />}
      />
      <Route path="/future/goals" element={<HouseholdGoals />} />
      <Route path="/future/net-worth" element={<HouseholdNetWorth />} />
      <Route path="/future/simulator" element={<HouseholdSimulator />} />

      {/* Insights */}
      <Route
        path="/insights"
        element={<Navigate to="/household/insights/ai-assistant" replace />}
      />
      <Route path="/insights/ai-assistant" element={<HouseholdAIAssistant />} />
      <Route path="/insights/cfo-reports" element={<HouseholdCFOReports />} />
      <Route
        path="/insights/weekly-meeting"
        element={<HouseholdWeeklyMeeting />}
      />
      <Route
        path="/insights/monthly-closeout"
        element={<HouseholdMonthlyCloseout />}
      />
      <Route
        path="/insights/quarterly-review"
        element={<HouseholdQuarterlyReview />}
      />

      {/* Life */}
      <Route
        path="/life"
        element={<Navigate to="/household/life/careers" replace />}
      />
      <Route path="/life/careers" element={<HouseholdCareers />} />
      <Route path="/life/vision" element={<HouseholdVision />} />
      <Route path="/life/tasks" element={<HouseholdTasks />} />

      {/* Manage */}
      <Route
        path="/manage"
        element={<Navigate to="/household/manage/settings" replace />}
      />
      <Route path="/manage/settings" element={<HouseholdSettings />} />
      <Route path="/manage/members" element={<HouseholdSettings />} />

      {/* Misc */}
      <Route path="/invite/:token" element={<AcceptInvitation />} />

      {/* Legacy redirects */}
      <Route
        path="/income"
        element={<Navigate to="/household/money-in/income" replace />}
      />
      <Route
        path="/bank-accounts"
        element={<Navigate to="/household/money-in/bank-accounts" replace />}
      />
      <Route
        path="/budget"
        element={<Navigate to="/household/money-out/budget" replace />}
      />
      <Route
        path="/bills"
        element={<Navigate to="/household/money-out/bills" replace />}
      />
      <Route
        path="/subscriptions"
        element={<Navigate to="/household/money-out/subscriptions" replace />}
      />
      <Route
        path="/debts"
        element={<Navigate to="/household/money-out/debts" replace />}
      />
      <Route
        path="/goals"
        element={<Navigate to="/household/future/goals" replace />}
      />
      <Route
        path="/net-worth"
        element={<Navigate to="/household/future/net-worth" replace />}
      />
      <Route
        path="/simulator"
        element={<Navigate to="/household/future/simulator" replace />}
      />
      <Route
        path="/ai-assistant"
        element={<Navigate to="/household/insights/ai-assistant" replace />}
      />
      <Route
        path="/cfo-reports"
        element={<Navigate to="/household/insights/cfo-reports" replace />}
      />
      <Route
        path="/weekly-meeting"
        element={<Navigate to="/household/insights/weekly-meeting" replace />}
      />
      <Route
        path="/monthly-closeout"
        element={<Navigate to="/household/insights/monthly-closeout" replace />}
      />
      <Route
        path="/quarterly-review"
        element={<Navigate to="/household/insights/quarterly-review" replace />}
      />
      <Route
        path="/careers"
        element={<Navigate to="/household/life/careers" replace />}
      />
      <Route
        path="/vision"
        element={<Navigate to="/household/life/vision" replace />}
      />
      <Route
        path="/tasks"
        element={<Navigate to="/household/life/tasks" replace />}
      />
      <Route
        path="/settings"
        element={<Navigate to="/household/manage/settings" replace />}
      />
      <Route
        path="/members"
        element={<Navigate to="/household/manage/members" replace />}
      />
      <Route
        path="/command-center"
        element={<Navigate to="/household" replace />}
      />
      <Route
        path="/credit-scores"
        element={<Navigate to="/household/money-in/bank-accounts" replace />}
      />
    </Routes>
  </HouseholdBudgetProvider>
);

const AppShell = () => (
  <>
    <AppRoutes />
    <LegalDisclosureGate />
  </>
);

const AppRoutes = () => (
  <Routes>
    {/* Public routes — accessible without auth */}
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/about" element={<About />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/disclaimer" element={<Disclaimer />} />

    {/* Protected routes — require authenticated user */}
    <Route element={<ProtectedRoute />}>
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/profile/:userId" element={<Profile />} />

      {/* ── Investment section (/invs/) ── */}
      {/* Orient */}
      <Route path="/invs/dashboard" element={<Dashboard />} />
      <Route path="/invs/alerts" element={<Alerts />} />

      {/* Market (tabbed) */}
      <Route path="/invs/market" element={<Markets />} />
      <Route path="/invs/market/macro" element={<Macro />} />
      <Route path="/invs/market/regime" element={<MarketRegime />} />

      {/* News */}
      <Route path="/invs/news" element={<News />} />

      {/* Discover (tabbed) */}
      <Route path="/invs/discover" element={<Signals />} />
      <Route path="/invs/discover/heat-map" element={<HeatMap />} />
      <Route path="/invs/discover/options-flow" element={<OptionsFlow />} />
      <Route path="/invs/discover/earnings" element={<EarningsCalendar />} />
      <Route path="/invs/discover/ipo" element={<IpoTracker />} />
      <Route path="/invs/discover/insider" element={<InsiderActivity />} />

      {/* Research */}
      <Route path="/invs/chart" element={<Chart />} />
      <Route path="/invs/screener" element={<Screener />} />
      <Route path="/invs/watchlist" element={<Watchlist />} />

      {/* Decide */}
      <Route path="/invs/decisions" element={<Decisions />} />
      <Route path="/invs/trading-ai" element={<AIAdvisor />} />
      <Route path="/invs/strategy" element={<FinancialAdvisor />} />
      <Route path="/invs/strategy/123" element={<Strategy123 />} />
      <Route path="/invs/strategy/allocator" element={<StrategyAllocator />} />
      <Route path="/invs/strategy/sizer" element={<PositionSizer />} />

      {/* Assets / Go Deep (tabbed) */}
      <Route path="/invs/assets" element={<Crypto />} />
      <Route path="/invs/assets/forex" element={<Forex />} />
      <Route path="/invs/assets/commodities" element={<Commodities />} />
      <Route path="/invs/assets/fixed-income" element={<FixedIncome />} />
      <Route path="/invs/assets/private-equity" element={<PrivateEquity />} />
      <Route path="/invs/assets/ma" element={<MergersAcquisitions />} />

      {/* Execute (tabbed) */}
      <Route path="/invs/execute" element={<Positions />} />
      <Route path="/invs/execute/portfolio" element={<MyPortfolio />} />
      <Route path="/invs/execute/paper" element={<PaperTrading />} />

      {/* Automate */}
      <Route path="/invs/bots" element={<Bots />} />

      {/* Review (tabbed) */}
      <Route path="/invs/review" element={<TradingJournal />} />
      <Route path="/invs/review/performance" element={<Performance />} />
      <Route path="/invs/review/pnl" element={<PnLCalendar />} />
      <Route path="/invs/review/briefing" element={<WeeklyBriefing />} />
      <Route path="/invs/review/playbook" element={<Playbook />} />

      {/* Documents */}
      <Route path="/invs/documents" element={<Documents />} />

      {/* AI Engines (tabbed) */}
      <Route path="/invs/ai-engines" element={<Compound />} />
      <Route path="/invs/ai-engines/quantum" element={<Quantum />} />

      {/* Prediction Markets (tabbed) */}
      <Route path="/invs/prediction-markets" element={<Kalshi />} />
      <Route
        path="/invs/prediction-markets/polymarket"
        element={<Polymarket />}
      />
      <Route
        path="/invs/prediction-markets/sports"
        element={<SportsTrading />}
      />
      <Route path="/invs/prediction-markets/lottery" element={<LotteryEV />} />

      {/* Account */}
      <Route path="/invs/security" element={<Security />} />
      <Route path="/invs/community" element={<Community />} />

      {/* Admin */}
      <Route path="/invs/admin" element={<AdminDashboard />} />

      {/* ── Legacy redirects (keep bookmarks working) ── */}
      <Route
        path="/dashboard"
        element={<Navigate to="/invs/dashboard" replace />}
      />
      <Route
        path="/signals"
        element={<Navigate to="/invs/discover" replace />}
      />
      <Route
        path="/decisions"
        element={<Navigate to="/invs/decisions" replace />}
      />
      <Route
        path="/ai-advisor"
        element={<Navigate to="/invs/trading-ai" replace />}
      />
      <Route
        path="/compound"
        element={<Navigate to="/invs/ai-engines" replace />}
      />
      <Route
        path="/quantum"
        element={<Navigate to="/invs/ai-engines/quantum" replace />}
      />
      <Route path="/markets" element={<Navigate to="/invs/market" replace />} />
      <Route path="/news" element={<Navigate to="/invs/news" replace />} />
      <Route
        path="/financial-news"
        element={<Navigate to="/invs/news" replace />}
      />
      <Route path="/crypto" element={<Navigate to="/invs/assets" replace />} />
      <Route
        path="/kalshi"
        element={<Navigate to="/invs/prediction-markets" replace />}
      />
      <Route
        path="/positions"
        element={<Navigate to="/invs/execute" replace />}
      />
      <Route
        path="/trading-journal"
        element={<Navigate to="/invs/review" replace />}
      />
      <Route path="/alerts" element={<Navigate to="/invs/alerts" replace />} />
      <Route
        path="/performance"
        element={<Navigate to="/invs/review/performance" replace />}
      />
      <Route
        path="/community"
        element={<Navigate to="/invs/community" replace />}
      />
      <Route
        path="/security"
        element={<Navigate to="/invs/security" replace />}
      />
      <Route path="/admin" element={<Navigate to="/invs/admin" replace />} />

      {/* ── Wealth (/wealth/) ── */}
      <Route path="/wealth" element={<WealthDashboard />} />
      {/* Long-term */}
      <Route
        path="/wealth/long-term"
        element={<Navigate to="/wealth/long-term/retirement" replace />}
      />
      <Route path="/wealth/long-term/retirement" element={<Retirement />} />
      <Route
        path="/wealth/long-term/estate-planning"
        element={<EstatePlanning />}
      />
      {/* Assets */}
      <Route
        path="/wealth/assets"
        element={<Navigate to="/wealth/assets/real-estate" replace />}
      />
      <Route path="/wealth/assets/real-estate" element={<RealEstate />} />
      <Route path="/wealth/assets/collectibles" element={<Collectibles />} />
      <Route path="/wealth/assets/dividends" element={<DividendTracker />} />
      {/* Protection */}
      <Route
        path="/wealth/protection"
        element={<Navigate to="/wealth/protection/insurance" replace />}
      />
      <Route path="/wealth/protection/insurance" element={<Insurance />} />
      <Route
        path="/wealth/protection/tax-harvesting"
        element={<TaxHarvesting />}
      />
      {/* Business */}
      <Route
        path="/wealth/business"
        element={<Navigate to="/wealth/business/entity-structure" replace />}
      />
      <Route
        path="/wealth/business/entity-structure"
        element={<EntityStructure />}
      />
      <Route path="/wealth/business/fundraising" element={<Fundraising />} />
      {/* Legacy redirects */}
      <Route
        path="/retirement"
        element={<Navigate to="/wealth/long-term/retirement" replace />}
      />
      <Route
        path="/estate-planning"
        element={<Navigate to="/wealth/long-term/estate-planning" replace />}
      />
      <Route
        path="/real-estate"
        element={<Navigate to="/wealth/assets/real-estate" replace />}
      />
      <Route
        path="/collectibles"
        element={<Navigate to="/wealth/assets/collectibles" replace />}
      />
      <Route
        path="/dividend-tracker"
        element={<Navigate to="/wealth/assets/dividends" replace />}
      />
      <Route
        path="/insurance"
        element={<Navigate to="/wealth/protection/insurance" replace />}
      />
      <Route
        path="/tax-harvesting"
        element={<Navigate to="/wealth/protection/tax-harvesting" replace />}
      />
      <Route
        path="/entity-structure"
        element={<Navigate to="/wealth/business/entity-structure" replace />}
      />
      <Route
        path="/fundraising"
        element={<Navigate to="/wealth/business/fundraising" replace />}
      />
      <Route
        path="/net-worth"
        element={<Navigate to="/household/future/net-worth" replace />}
      />
      <Route
        path="/debt-manager"
        element={<Navigate to="/household/money-out/debts" replace />}
      />
      <Route
        path="/cash-flow-planner"
        element={<Navigate to="/household/money-in/bank-accounts" replace />}
      />

      <Route
        path="/home"
        element={
          <HouseholdBudgetProvider>
            <HomeDashboard />
          </HouseholdBudgetProvider>
        }
      />

      <Route path="/household/*" element={<HouseholdRoutes />} />
    </Route>

    <Route path="*" element={<NotFound />} />
  </Routes>
);

const SentryFallback = () => (
  <div className="flex h-screen flex-col items-center justify-center bg-background p-8 text-center">
    <h1 className="font-display text-3xl font-bold text-foreground">
      Something went wrong
    </h1>
    <p className="mt-3 max-w-md text-muted-foreground">
      We've been notified and are looking into it. Try refreshing — if the
      problem persists, contact support.
    </p>
    <button
      onClick={() => window.location.reload()}
      className="mt-6 rounded-full bg-accent px-8 py-3 font-semibold text-foreground transition-fast hover:bg-accent/80"
    >
      Reload
    </button>
  </div>
);

const App = () => (
  <Sentry.ErrorBoundary fallback={<SentryFallback />}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthProvider>
          <DemoProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppShell />
              </BrowserRouter>
            </TooltipProvider>
          </DemoProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </Sentry.ErrorBoundary>
);

export default App;
