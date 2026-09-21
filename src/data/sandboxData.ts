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
  { id: "t-6", ticker: "MSFT", executed_at: "2024-04-02", pnl_realized: 620, strategy_type: "long_stock", action: "close", price: 410, quantity: 15, total_value: 6150, signal_score_at_entry: 82 },
  { id: "t-7", ticker: "META", executed_at: "2024-04-10", pnl_realized: -280, strategy_type: "call_debit", action: "close", price: 480, quantity: 8, total_value: 3840, signal_score_at_entry: 58 },
  { id: "t-8", ticker: "NVDA", executed_at: "2024-04-18", pnl_realized: 3100, strategy_type: "long_stock", action: "close", price: 850, quantity: 6, total_value: 5100, signal_score_at_entry: 93 },
  { id: "t-9", ticker: "ETH", executed_at: "2024-04-25", pnl_realized: 940, strategy_type: "options", action: "close", price: 3200, quantity: 3, total_value: 9600, signal_score_at_entry: 80 },
  { id: "t-10", ticker: "PLTR", executed_at: "2024-05-05", pnl_realized: -150, strategy_type: "swing_trade", action: "close", price: 22, quantity: 100, total_value: 2200, signal_score_at_entry: 55 },
  { id: "t-11", ticker: "AAPL", executed_at: "2024-05-14", pnl_realized: 410, strategy_type: "covered_call", action: "close", price: 190, quantity: 25, total_value: 4750, signal_score_at_entry: 74 },
  { id: "t-12", ticker: "SOL", executed_at: "2024-05-22", pnl_realized: 780, strategy_type: "options", action: "close", price: 145, quantity: 20, total_value: 2900, signal_score_at_entry: 86 },
  { id: "t-13", ticker: "TSLA", executed_at: "2024-06-03", pnl_realized: 560, strategy_type: "put_credit", action: "close", price: 175, quantity: 12, total_value: 2100, signal_score_at_entry: 71 },
  { id: "t-14", ticker: "AMD", executed_at: "2024-06-15", pnl_realized: -410, strategy_type: "long_stock", action: "close", price: 155, quantity: 18, total_value: 2790, signal_score_at_entry: 60 },
  { id: "t-15", ticker: "SMCI", executed_at: "2024-06-28", pnl_realized: 1850, strategy_type: "options", action: "close", price: 780, quantity: 4, total_value: 3120, signal_score_at_entry: 90 },
  { id: "t-16", ticker: "GOOGL", executed_at: "2024-07-10", pnl_realized: 720, strategy_type: "call_debit", action: "close", price: 178, quantity: 10, total_value: 1780, signal_score_at_entry: 83 },
  { id: "t-17", ticker: "AVGO", executed_at: "2024-07-22", pnl_realized: 990, strategy_type: "long_stock", action: "close", price: 1650, quantity: 3, total_value: 4950, signal_score_at_entry: 88 },
  { id: "t-18", ticker: "COIN", executed_at: "2024-08-05", pnl_realized: -520, strategy_type: "options", action: "close", price: 210, quantity: 8, total_value: 1680, signal_score_at_entry: 54 },
  { id: "t-19", ticker: "BTC", executed_at: "2024-08-19", pnl_realized: 1400, strategy_type: "long_stock", action: "close", price: 61000, quantity: 0.08, total_value: 4880, signal_score_at_entry: 89 },
  { id: "t-20", ticker: "AMZN", executed_at: "2024-09-02", pnl_realized: 630, strategy_type: "long_stock", action: "close", price: 185, quantity: 20, total_value: 3700, signal_score_at_entry: 79 },
];

export const sandboxMacro = {
  composite: 78,
  yieldCurve: { value: 0.45, status: "Normal", score: 70 },
  vix: { value: 13.2, label: "Low Risk", score: 85 },
  sector: { value: 4.2, label: "Bullish", score: 80 },
  fed: { value: "Pause", label: "Neutral", score: 60 },
  updatedAt: new Date().toISOString()
};
