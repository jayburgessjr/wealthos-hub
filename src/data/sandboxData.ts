export const sandboxPortfolio = {
  total_capital: 124500,
  available_capital: 42100,
  deployed_capital: 82400,
  total_pnl: 18430,
  total_pnl_pct: 17.4,
  win_rate: 78.2,
  total_trades: 142
};

export const sandboxPositions = [
  {
    id: "demo-1",
    ticker: "NVDA",
    company_name: "NVIDIA Corp",
    strategy_type: "long_stock",
    entry_price: 420.50,
    current_price: 890.20,
    value: 44510,
    pnl_dollars: 23485,
    pnl_percent: 111.7,
    signal_score: 92,
    status: "open",
    entry_date: "2023-10-12"
  },
  {
    id: "demo-2",
    ticker: "TSLA",
    company_name: "Tesla, Inc.",
    strategy_type: "covered_call",
    entry_price: 180.20,
    current_price: 175.40,
    value: 17540,
    pnl_dollars: -480,
    pnl_percent: -2.6,
    signal_score: 65,
    status: "open",
    entry_date: "2024-02-15"
  },
  {
    id: "demo-3",
    ticker: "BTC",
    company_name: "Bitcoin",
    strategy_type: "long_stock",
    entry_price: 42000,
    current_price: 68500,
    value: 20350,
    pnl_dollars: 7850,
    pnl_percent: 63.1,
    signal_score: 88,
    status: "open",
    entry_date: "2024-01-05"
  }
];

export const sandboxSignals = [
  {
    id: "s-1",
    ticker: "AAPL",
    company_name: "Apple Inc.",
    signal_score: 88,
    action: "buy",
    entry_price: 172.50,
    target_price: 195.00,
    stop_price: 165.00,
    reasoning: ["Strong support at 170", "Bullish MACD crossover", "Positive iPhone sentiment"]
  },
  {
    id: "s-2",
    ticker: "MSFT",
    company_name: "Microsoft Corp",
    signal_score: 94,
    action: "strong_buy",
    entry_price: 415.20,
    target_price: 460.00,
    stop_price: 400.00,
    reasoning: ["AI revenue acceleration", "Cloud margin expansion", "Institutional accumulation"]
  },
  {
    id: "s-3",
    ticker: "META",
    company_name: "Meta Platforms",
    signal_score: 72,
    action: "buy",
    entry_price: 495.00,
    target_price: 540.00,
    stop_price: 475.00,
    reasoning: ["Ad spend recovering", "Efficiency year continuing", "Llama 3 anticipation"]
  }
];

export const sandboxTransactions = [
  { id: "t-1", ticker: "AMD", executed_at: "2024-03-01", pnl_realized: 1200, strategy_type: "long_stock", action: "close", price: 180, quantity: 10, total_value: 1800, signal_score_at_entry: 85 },
  { id: "t-2", ticker: "GOOGL", executed_at: "2024-03-05", pnl_realized: 850, strategy_type: "call_debit", action: "close", price: 145, quantity: 5, total_value: 725, signal_score_at_entry: 78 },
  { id: "t-3", ticker: "AMZN", executed_at: "2024-03-10", pnl_realized: -320, strategy_type: "long_stock", action: "close", price: 172, quantity: 20, total_value: 3440, signal_score_at_entry: 62 },
  { id: "t-4", ticker: "COIN", executed_at: "2024-03-15", pnl_realized: 2450, strategy_type: "options", action: "close", price: 240, quantity: 10, total_value: 4800, signal_score_at_entry: 91 },
  { id: "t-5", ticker: "SMCI", executed_at: "2024-03-20", pnl_realized: 4100, strategy_type: "long_stock", action: "close", price: 950, quantity: 5, total_value: 4750, signal_score_at_entry: 95 },
];

export const sandboxMacro = {
  composite: 78,
  yieldCurve: { value: 0.45, status: "Normal", score: 70 },
  vix: { value: 13.2, label: "Low Risk", score: 85 },
  sector: { value: 4.2, label: "Bullish", score: 80 },
  fed: { value: "Pause", label: "Neutral", score: 60 },
  updatedAt: new Date().toISOString()
};
