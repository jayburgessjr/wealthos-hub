/** All help copy lives here so the Help page, the top-bar popover and the tooltips stay in sync. */

export interface AreaGuide {
  id: "home" | "invest" | "wealth" | "household" | "desk";
  name: string;
  path: string;
  tagline: string;
  what: string;
  useItFor: string[];
  proOnly?: boolean;
  ownerOnly?: boolean;
}

export const AREAS: AreaGuide[] = [
  {
    id: "home",
    name: "Home",
    path: "/home",
    tagline: "Your one-screen summary.",
    what: "A plain overview of where you stand: what you own, what you owe, and what to look at next. It reads from the other areas, so you never enter anything twice.",
    useItFor: ["Checking in once a week", "Seeing what needs attention", "Jumping into the right area"],
  },
  {
    id: "household",
    name: "Household",
    path: "/household",
    tagline: "Everyday money for you and the people you share it with.",
    what: "Income, bills, budget, debts, goals and net worth for a household. Members of the same household see the same numbers.",
    useItFor: ["Tracking income and bills", "Planning a budget", "Paying down debt", "Setting savings goals", "Asking the Money coach what to do next"],
    proOnly: true,
  },
  {
    id: "wealth",
    name: "Wealth",
    path: "/wealth",
    tagline: "Long-term planning and the things you own.",
    what: "Retirement, estate planning, real estate, collectibles, dividends, insurance and tax. This is where slow, big decisions live.",
    useItFor: ["Retirement projections", "Tracking property and other assets", "Insurance and estate checklists", "Tax harvesting ideas"],
    proOnly: true,
  },
  {
    id: "invest",
    name: "Invest",
    path: "/invs/dashboard",
    tagline: "Research, signals and your trading journal.",
    what: "Markets, news, screeners, signals, charts, a paper trading account, bots and a review journal. It helps you decide and learn. It does not place real trades for you.",
    useItFor: ["Researching a ticker", "Practising with paper money", "Keeping a trade journal", "Reviewing what worked"],
    proOnly: true,
  },
  {
    id: "desk",
    name: "Desk",
    path: "/desk",
    tagline: "A private paper-trading desk with an approval queue.",
    what: "AI agents propose trades with a bull case, a bear case and a stop. Nothing happens until you approve it, and it runs on paper money only. Only the desk owner sees this tab.",
    useItFor: ["Reviewing agent trade proposals", "Watching a paper portfolio", "Reading research notes", "Checking performance"],
    ownerOnly: true,
  },
];

export interface QuickStep {
  title: string;
  body: string;
  to: string;
}

export const GETTING_STARTED: QuickStep[] = [
  { title: "Set up your household", body: "Create or join a household so bills, debts and goals have a home.", to: "/household/setup" },
  { title: "Add what you earn and own", body: "Enter income and your bank accounts. Rough numbers are fine; you can refine later.", to: "/household/money-in/income" },
  { title: "Add bills and debts", body: "List recurring bills and any debt with its interest rate. This is what powers the Money coach.", to: "/household/money-out/bills" },
  { title: "Open the Money coach", body: "It ranks the moves that would save or earn you the most this year.", to: "/household/money" },
  { title: "Pick a goal", body: "Give your savings a target and a date so progress is visible.", to: "/household/future/goals" },
];

export interface PageGuide {
  /** The guide applies when the path equals `prefix` or starts with it plus a slash. Longest prefix wins. */
  prefix: string;
  title: string;
  purpose: string;
  howTo: string[];
}

export const PAGE_GUIDES: PageGuide[] = [
  { prefix: "/home", title: "Home", purpose: "A one-screen summary of your money.", howTo: ["Read the cards top to bottom.", "Click any card to open the full page behind it.", "Use Simple mode in the top bar for fewer menus."] },
  { prefix: "/help", title: "Help", purpose: "Explains every area, page and term.", howTo: ["Search for a word or page.", "Open Glossary for plain-English definitions.", "Hover the small info icons around the app for quick answers."] },
  { prefix: "/learn", title: "Learn", purpose: "Short lessons on core money ideas.", howTo: ["Pick a lesson.", "Each one is a few plain points, no jargon.", "These are general education, not advice for your situation."] },
  { prefix: "/household/money", title: "Money coach", purpose: "Turns your entered numbers into a ranked list of next moves.", howTo: ["Check the four top cards: net worth, cash, invested, debt.", "Read Next best moves; the top one has the biggest yearly impact.", "Fix missing data (bills, debts, accounts) to sharpen the advice.", "It only reads your data. It never moves money."] },
  { prefix: "/household/money-in", title: "Money in", purpose: "Where income and bank accounts are recorded.", howTo: ["Add each income source with how often it pays.", "Add accounts so cash and net worth are right.", "Update balances when they change."] },
  { prefix: "/household/money-out", title: "Money out", purpose: "Budget, bills and debts.", howTo: ["Add recurring bills with their due date and frequency.", "Add each debt with balance, rate and minimum payment.", "Compare spending against your budget."] },
  { prefix: "/household/future", title: "Future", purpose: "Goals, net worth over time and what-if simulations.", howTo: ["Set a goal with a target and date.", "Use the simulator to test a change before you make it.", "Simulations are estimates, not predictions."] },
  { prefix: "/household/insights", title: "Insights", purpose: "AI assistant and CFO-style reports for your household.", howTo: ["Ask a plain question about your numbers.", "Answers use what you have entered, so keep it current.", "Treat output as a starting point, not advice."] },
  { prefix: "/household/life", title: "Life", purpose: "Careers, vision and tasks that sit around the money.", howTo: ["Capture longer-term plans.", "Turn plans into tasks.", "Revisit them when your numbers change."] },
  { prefix: "/household/manage", title: "Household settings", purpose: "Members, invitations and household details.", howTo: ["Invite someone by email.", "Members of a household share the same data.", "Manage members and invitations here."] },
  { prefix: "/household", title: "Household", purpose: "Everyday money for the people you share it with.", howTo: ["Start with Setup if you have not created a household.", "Use the left menu: Money in, Money out, Future, Insights.", "Open Money coach for ranked next steps."] },
  { prefix: "/wealth", title: "Wealth", purpose: "Long-term planning and the things you own.", howTo: ["Start with the dashboard summary.", "Open Long-term for retirement and estate planning.", "Open Assets for property, collectibles and dividends.", "Protection covers insurance and tax."] },
  { prefix: "/invs/execute/paper", title: "Paper trading", purpose: "Practise trades with pretend money.", howTo: ["Pick a ticker and size.", "Place a paper order and watch it.", "Nothing here touches a real broker."] },
  { prefix: "/invs/review", title: "Review", purpose: "Journal and performance of your trades.", howTo: ["Log why you entered and exited.", "Check performance and the P&L calendar.", "Use the playbook to write down rules you keep."] },
  { prefix: "/invs/discover", title: "Discover", purpose: "Signals, heat maps, options flow, earnings and IPOs.", howTo: ["Scan for ideas, not instructions.", "Open a signal to see the reasoning and risk.", "Verify elsewhere before acting."] },
  { prefix: "/invs/market", title: "Market", purpose: "Macro backdrop and market regime.", howTo: ["Check the regime first.", "Use Macro for rates, inflation and growth.", "These describe conditions; they do not predict them."] },
  { prefix: "/invs/strategy", title: "Strategy and coach", purpose: "Build a plan and chat with the wealth coach.", howTo: ["Use the strategy builder for an allocation idea.", "Use the earn-more track for income ideas.", "The coach is an AI. It can be wrong; check anything important."] },
  { prefix: "/invs", title: "Invest", purpose: "Research and decision tools for investing.", howTo: ["Orient with the dashboard and alerts.", "Research a ticker with Chart, Screener and Watchlist.", "Practise in paper trading before risking money.", "Nothing here places real trades."] },
  { prefix: "/desk", title: "Desk", purpose: "Paper-trading desk with a human approval queue.", howTo: ["Proposals from agents wait in the Approval queue.", "Read the bull case, bear case, stop and risk preview.", "Approve or reject. Nothing is sent until you approve.", "It runs on paper money only."] },
  { prefix: "/settings", title: "Settings", purpose: "Your account and preferences.", howTo: ["Update your profile.", "Change theme or notifications.", "Sign out from the account menu in the top bar."] },
];

export const FALLBACK_GUIDE: PageGuide = {
  prefix: "",
  title: "This page",
  purpose: "Part of your money workspace.",
  howTo: ["Use the left menu to move between pages.", "Open Help for a full guide to every area."],
};

/** Longest matching prefix wins. */
export function guideForPath(pathname: string): PageGuide {
  let best: PageGuide | undefined;
  for (const g of PAGE_GUIDES) {
    if (pathname === g.prefix || pathname.startsWith(g.prefix + "/")) {
      if (!best || g.prefix.length > best.prefix.length) best = g;
    }
  }
  return best ?? FALLBACK_GUIDE;
}

export interface GlossaryEntry {
  term: string;
  short: string;
  long: string;
}

export const GLOSSARY: Record<string, GlossaryEntry> = {
  "net-worth": { term: "Net worth", short: "What you own minus what you owe.", long: "Add up cash and investments, subtract debts. It is a snapshot, so it moves as balances and prices change." },
  cash: { term: "Cash", short: "Money in your bank accounts.", long: "Checking and savings balances you have entered." },
  invested: { term: "Invested", short: "Money put into assets that can rise or fall.", long: "Brokerage and portfolio value. It can go down as well as up." },
  debt: { term: "Debt", short: "Money you owe.", long: "Credit cards, loans and anything else with a balance and an interest rate." },
  "emergency-fund": { term: "Emergency fund", short: "Cash set aside for surprises.", long: "The Money coach targets three months of bills and debt payments. Keep it in a safe, easy-to-reach account." },
  avalanche: { term: "Debt avalanche", short: "Pay the highest interest rate first.", long: "Make minimum payments on everything, then put extra money on the debt with the highest rate. It usually costs the least interest overall." },
  "interest-rate": { term: "Interest rate (APR)", short: "The yearly cost of a debt.", long: "A 20% rate on 1,000 dollars costs about 200 dollars a year if left unpaid." },
  subscription: { term: "Subscriptions", short: "Recurring charges that renew on their own.", long: "Small monthly amounts add up. The coach shows the yearly total so you can cancel what you do not use." },
  "paper-trading": { term: "Paper trading", short: "Practice trading with pretend money.", long: "Orders are simulated at market prices. No real money moves." },
  "approval-queue": { term: "Approval queue", short: "Trade ideas waiting for your yes or no.", long: "Agents propose; you decide. Nothing leaves the queue until you approve it." },
  "stop-loss": { term: "Stop", short: "The price where you accept you were wrong.", long: "A stop limits how much one trade can lose. The risk preview uses it to size the position." },
  "risk-preview": { term: "Risk preview", short: "A pre-check on a proposed trade.", long: "Shows size, dollars at risk and rule checks. It is advisory; the server recomputes risk before anything is sent." },
  "bull-bear": { term: "Bull and bear case", short: "The best and worst argument for a trade.", long: "Reading both helps you avoid only seeing what you hope is true." },
  "simple-pro": { term: "Simple and Pro", short: "How much of the menu you see.", long: "Simple shows a short plain menu. Pro adds Invest, Wealth and Household areas in the top bar. Your data is the same in both." },
  household: { term: "Household", short: "A shared set of money records.", long: "People in the same household see the same income, bills, debts and goals." },
  "not-advice": { term: "Not financial advice", short: "General information only.", long: "Nothing here knows your full situation. Treat output as a starting point and check big decisions with a qualified professional." },
};

export function tip(key: string): GlossaryEntry {
  return GLOSSARY[key];
}

export interface Faq {
  q: string;
  a: string;
}

export const FAQS: Faq[] = [
  { q: "Does this app move my money or place real trades?", a: "No. The Money coach only reads what you entered. Invest and Desk are paper-only. Nothing connects to a bank, and nothing places a real-money trade." },
  { q: "Where does my data come from?", a: "Only from what you type in. Numbers are as accurate as your entries, so update balances when they change." },
  { q: "Who can see my data?", a: "You, and members of your household. Other households cannot see it." },
  { q: "Why is the Money coach saying to add data?", a: "It needs bills, debts, accounts or income to work out advice. Empty sections are skipped, not guessed." },
  { q: "What is the difference between Invest, Wealth, Household and Desk?", a: "Household is everyday money. Wealth is long-term planning and assets. Invest is research and paper practice. Desk is a private paper desk with an approval queue." },
  { q: "Why can I not see Desk?", a: "Desk is for the desk owner only. If you should have access, ask the owner to add you." },
  { q: "What do Simple and Pro mean?", a: "Simple hides most menus so you see Home, plan, money, grow, learn and coach. Pro shows every area. Switch any time; nothing is lost." },
  { q: "Are the AI answers reliable?", a: "They can be wrong. Use them to think, then check anything that matters. Not financial advice." },
  { q: "Are sample numbers on some Invest pages real?", a: "Some Invest pages still show sample data while live feeds are connected. Treat those numbers as illustrative." },
];
