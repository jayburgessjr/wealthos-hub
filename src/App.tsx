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
import LegalDisclosureGate from "@/components/legal/LegalDisclosureGate";
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

const queryClient = new QueryClient();

const HouseholdRoutes = () => (
  <HouseholdBudgetProvider>
    <Routes>
      <Route path="/" element={<HouseholdDashboard />} />
      <Route path="/setup" element={<HouseholdSetup />} />
      <Route path="/command-center" element={<HouseholdDashboard />} />
      <Route path="/budget" element={<HouseholdBudget />} />
      <Route path="/bills" element={<HouseholdBills />} />
      <Route path="/income" element={<HouseholdIncome />} />
      <Route path="/subscriptions" element={<HouseholdSubscriptions />} />
      <Route path="/goals" element={<HouseholdGoals />} />
      <Route path="/debts" element={<HouseholdDebts />} />
      <Route path="/bank-accounts" element={<HouseholdBankAccounts />} />
      <Route path="/credit-scores" element={<HouseholdCreditScores />} />
      <Route path="/net-worth" element={<HouseholdNetWorth />} />
      <Route path="/simulator" element={<HouseholdSimulator />} />
      <Route path="/weekly-meeting" element={<HouseholdWeeklyMeeting />} />
      <Route path="/monthly-closeout" element={<HouseholdMonthlyCloseout />} />
      <Route path="/quarterly-review" element={<HouseholdQuarterlyReview />} />
      <Route path="/ai-assistant" element={<HouseholdAIAssistant />} />
      <Route path="/cfo-reports" element={<HouseholdCFOReports />} />
      <Route path="/careers" element={<HouseholdCareers />} />
      <Route path="/vision" element={<HouseholdVision />} />
      <Route path="/tasks" element={<HouseholdTasks />} />
      <Route path="/settings" element={<HouseholdSettings />} />
      <Route path="/members" element={<HouseholdSettings />} />
      <Route path="/invite/:token" element={<AcceptInvitation />} />
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
    <Route path="/financial-advisor" element={<FinancialAdvisor />} />
    <Route path="/login" element={<Login />} />
    <Route path="/signup" element={<Signup />} />
    <Route path="/about" element={<About />} />
    <Route path="/terms" element={<TermsOfService />} />
    <Route path="/privacy" element={<PrivacyPolicy />} />
    <Route path="/disclaimer" element={<Disclaimer />} />
    <Route path="/pnl-calendar" element={<PnLCalendar />} />
    <Route path="/position-sizer" element={<PositionSizer />} />
    <Route path="/trading-journal" element={<TradingJournal />} />
    <Route path="/weekly-briefing" element={<WeeklyBriefing />} />
    <Route path="/tax-harvesting" element={<TaxHarvesting />} />
    <Route path="/earnings-calendar" element={<EarningsCalendar />} />
    <Route path="/heat-map" element={<HeatMap />} />
    <Route path="/paper-trading" element={<PaperTrading />} />
    <Route path="/strategy-123" element={<Strategy123 />} />
    <Route path="/playbook" element={<Playbook />} />
    <Route path="/alerts" element={<Alerts />} />
    <Route path="/chart" element={<Chart />} />
    <Route path="/screener" element={<Screener />} />
    <Route path="/insider-activity" element={<InsiderActivity />} />
    <Route path="/community" element={<Community />} />
    <Route path="/profile/:userId" element={<Profile />} />
    <Route path="/bots" element={<Bots />} />
    <Route path="/forex" element={<Forex />} />
    <Route path="/commodities" element={<Commodities />} />
    <Route path="/fixed-income" element={<FixedIncome />} />
    <Route path="/private-equity" element={<PrivateEquity />} />
    <Route path="/mergers-acquisitions" element={<MergersAcquisitions />} />
    <Route path="/kalshi" element={<Kalshi />} />
    <Route path="/polymarket" element={<Polymarket />} />
    <Route path="/sports-trading" element={<SportsTrading />} />
    <Route path="/lottery-ev" element={<LotteryEV />} />
    <Route path="/financial-news" element={<FinancialNews />} />
    <Route path="/my-portfolio" element={<MyPortfolio />} />
    <Route
      path="/net-worth"
      element={<Navigate to="/household/net-worth" replace />}
    />
    <Route
      path="/debt-manager"
      element={<Navigate to="/household/debts" replace />}
    />
    <Route path="/retirement" element={<Retirement />} />
    <Route
      path="/cash-flow-planner"
      element={<Navigate to="/household/bank-accounts" replace />}
    />
    <Route path="/dividend-tracker" element={<DividendTracker />} />
    <Route path="/real-estate" element={<RealEstate />} />
    <Route path="/collectibles" element={<Collectibles />} />
    <Route path="/options-flow" element={<OptionsFlow />} />
    <Route path="/macro" element={<Macro />} />
    <Route path="/ipo-tracker" element={<IpoTracker />} />
    <Route path="/estate-planning" element={<EstatePlanning />} />
    <Route path="/insurance" element={<Insurance />} />
    <Route path="/entity-structure" element={<EntityStructure />} />
    <Route path="/fundraising" element={<Fundraising />} />
    <Route path="/household/*" element={<HouseholdRoutes />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
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
);

export default App;
