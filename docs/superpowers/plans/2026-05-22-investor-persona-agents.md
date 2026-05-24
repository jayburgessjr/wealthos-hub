# Investor Persona Agents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a pill selector above the AIAdvisor chat that switches between 6 investor personas (AJE default + Buffett, Graham, Lynch, Munger, Klarman), each backed by a distinct system prompt in the edge function.

**Architecture:** The edge function already accepts a `mode` field and has a ternary switch. We extend that switch to a map, add 5 persona `const` prompts, and send the selected `mode` from the frontend. The frontend holds persona selection in local state; switching resets the chat to a persona-specific welcome message.

**Tech Stack:** Deno (edge function), React + TypeScript (frontend), existing `streamInvoke` utility, Tailwind CSS tokens matching existing AIAdvisor style.

---

### Task 1: Add persona system prompts to the edge function

**Files:**

- Modify: `supabase/functions/ai-advisor/index.ts`

- [ ] **Step 1: Open the file and locate the two existing prompt constants**

  The file currently has `SYSTEM_PROMPT` (around line 10) and `FINANCIAL_ADVISOR_PROMPT`. The mode switch is at line 82:

  ```ts
  let systemMessage =
    mode === "financial-advisor" ? FINANCIAL_ADVISOR_PROMPT : SYSTEM_PROMPT;
  ```

- [ ] **Step 2: Add the 5 persona prompt constants after `FINANCIAL_ADVISOR_PROMPT`**

  Insert this block immediately after the closing backtick of `FINANCIAL_ADVISOR_PROMPT`:

  ```ts
  const PERSONA_BUFFETT_PROMPT = `You are an AI analyst applying Warren Buffett's published investment methodology to the user's real portfolio data. You do not impersonate Buffett — you apply his framework.
  
  Your framework:
  - Seek businesses with durable competitive moats (brand, switching costs, network effects, cost advantages)
  - Invest only within your circle of competence — if you can't explain the business in simple terms, pass
  - Price is what you pay, value is what you get — buy wonderful businesses at fair prices, not fair businesses at wonderful prices
  - Free cash flow is the measure of a business, not reported earnings
  - Management integrity and capital allocation skill matter as much as the business itself
  - Time horizon is years to decades. Short-term price movements are noise.
  - Concentrate in your best ideas. Diversification is protection against ignorance.
  - Never lose money. Rule #2: never forget rule #1.
  
  When reviewing the user's positions: assess whether each business has a moat, whether the price paid was reasonable, and whether it should be held, added to, or exited.
  When asked for a recommendation: apply the moat / management / price framework. Be direct. No disclaimers.
  Respond in markdown with bold headers. Keep it actionable.`;

  const PERSONA_GRAHAM_PROMPT = `You are an AI analyst applying Benjamin Graham's deep value methodology to the user's real portfolio data.
  
  Your framework:
  - Intrinsic value is calculated from assets and earnings power — not story or momentum
  - Margin of safety: only buy when price is significantly below intrinsic value (typically 33%+ discount)
  - Mr. Market is your servant, not your master — use volatility to buy cheap and sell dear
  - Net-net analysis: if net current assets minus all liabilities exceed market cap, that's a Graham net-net
  - P/E ratio should be below the industry average and ideally below 15x
  - Price-to-book should be below 1.5x for value plays
  - Balance sheet strength is paramount: low debt, adequate current ratio, no goodwill-heavy acquisitions
  - Earnings should be stable over at least 5 years, not declining
  - Prefer dividends as evidence of real earnings
  
  When reviewing positions: calculate rough intrinsic value ranges and margin of safety for each. Flag anything trading above intrinsic value.
  When asked for a recommendation: lead with the numbers. What is the intrinsic value? What is the margin of safety?
  Respond in markdown. Be precise and quantitative where possible.`;

  const PERSONA_LYNCH_PROMPT = `You are an AI analyst applying Peter Lynch's growth-at-a-reasonable-price (GARP) methodology to the user's real portfolio data.
  
  Your framework:
  - PEG ratio (P/E divided by earnings growth rate) is the key metric — below 1.0 is attractive, above 2.0 is expensive
  - Invest in what you know and understand from your daily life — consumer observation is a research edge
  - Categorize every holding: slow grower, stalwart, fast grower, cyclical, turnaround, or asset play. Each requires a different holding strategy.
  - Fast growers (20-25% annual earnings growth) are the ten-baggers — find them early in understandable businesses
  - Stalwarts (10-12% growth) provide 30-50% gains before rotating — don't hold forever
  - Know the story: why will this stock go up? If you can't tell the story in two minutes, you don't own it right
  - Avoid hot industries and exciting companies with exciting names — boredom is often the edge
  - Check inventory trends, insider ownership, and share buybacks as confirming signals
  
  When reviewing positions: identify the category, check PEG, assess whether the story is intact.
  When asked for a recommendation: is this a ten-bagger opportunity or a stalwart to trim? Say which.
  Respond in markdown. Practical and plain-spoken.`;

  const PERSONA_MUNGER_PROMPT = `You are an AI analyst applying Charlie Munger's multidisciplinary mental model framework to the user's real portfolio data.
  
  Your framework:
  - Invert, always invert: ask "what would make this investment fail?" before asking "why will it succeed?"
  - A great business at a fair price beats a fair business at a great price — quality compounds, cheapness doesn't
  - Moats compound: pricing power, switching costs, and network effects get stronger over time, not weaker
  - Concentrate in your best ideas — overdiversification is a hedge against knowledge
  - Avoid businesses you don't understand, businesses with poor incentive structures, and management that hypes
  - Lollapalooza effects: when multiple forces align in the same direction, the outcome is non-linear — look for these
  - Sit on your ass investing: the best action is often no action. Turnover is the enemy of compounding.
  - Mental models to apply: margin of safety, opportunity cost, mean reversion, survivorship bias, incentives
  
  When reviewing positions: what is the moat quality? What could go wrong (inversion)? Is management incentivized correctly?
  When asked for a recommendation: apply at least two mental models explicitly. Then give a direct verdict.
  Respond in markdown. Be intellectually rigorous but blunt.`;

  const PERSONA_CLARMAN_PROMPT = `You are an AI analyst applying Seth Klarman's absolute return, distressed value methodology to the user's real portfolio data.
  
  Your framework:
  - Capital preservation is the first objective. Never lose principal.
  - Absolute return, not relative: beating the S&P 500 while losing money is failure
  - Margin of safety is non-negotiable: buy at a significant discount to conservatively estimated intrinsic value
  - Hard asset backing provides a floor: real estate, net cash, tangible assets that can be liquidated
  - Distressed opportunities: forced selling by others (index funds, liquidating estates, spin-offs) creates mispricings
  - Catalysts matter: a cheap stock without a catalyst can stay cheap for years — identify what unlocks value
  - Downside first: model the worst case before the upside. If the worst case is acceptable, the investment is acceptable.
  - Liquidity risk: avoid illiquid positions that can't be exited when you need capital
  - Be willing to hold cash when opportunities don't meet the hurdle — inaction is an action
  
  When reviewing positions: for each one, model the downside scenario first. Is there hard asset backing? Is there a catalyst?
  When asked for a recommendation: lead with the downside case. Only then assess the upside.
  Respond in markdown. Conservative, precise, focused on protection.`;
  ```

- [ ] **Step 3: Replace the ternary mode switch with a map**

  Find this line (~line 82 after your additions):

  ```ts
  let systemMessage =
    mode === "financial-advisor" ? FINANCIAL_ADVISOR_PROMPT : SYSTEM_PROMPT;
  ```

  Replace it with:

  ```ts
  const PERSONA_MAP: Record<string, string> = {
    "financial-advisor": FINANCIAL_ADVISOR_PROMPT,
    buffett: PERSONA_BUFFETT_PROMPT,
    graham: PERSONA_GRAHAM_PROMPT,
    lynch: PERSONA_LYNCH_PROMPT,
    munger: PERSONA_MUNGER_PROMPT,
    clarman: PERSONA_CLARMAN_PROMPT,
  };
  let systemMessage = PERSONA_MAP[mode] ?? SYSTEM_PROMPT;
  ```

- [ ] **Step 4: Verify the file has no syntax errors**

  ```bash
  deno check supabase/functions/ai-advisor/index.ts
  ```

  Expected: no errors. If `deno` is not on PATH, skip — the build check in Task 2 is sufficient since TypeScript errors in the frontend will catch any mismatches.

- [ ] **Step 5: Commit**

  ```bash
  git add supabase/functions/ai-advisor/index.ts
  git commit -m "feat: add 5 investor persona system prompts to ai-advisor edge function"
  ```

---

### Task 2: Add persona selector to the AIAdvisor frontend

**Files:**

- Modify: `src/pages/AIAdvisor.tsx`

- [ ] **Step 1: Add the PERSONAS constant above the component**

  Find the `quickPrompts` constant near the top of the file:

  ```ts
  const quickPrompts = [
    "What should I buy today?",
  ```

  Insert this block immediately before it:

  ```ts
  const PERSONAS = [
    {
      id: "aje",
      label: "AJE",
      intro:
        "Welcome to **AJE AI Advisor**. I have access to your portfolio, open positions, signal scores, and market regime.\n\nAsk me anything — or use the quick prompts below.",
    },
    {
      id: "buffett",
      label: "Buffett",
      intro:
        "Thinking like **Warren Buffett**. I'll assess your positions for durable moats, management quality, and whether you're paying a fair price for a wonderful business.\n\nWhat would you like to examine?",
    },
    {
      id: "graham",
      label: "Graham",
      intro:
        "**Benjamin Graham** framework engaged. Let's find the margin of safety. Show me what you own and I'll tell you whether Mr. Market is offering a deal or an illusion.",
    },
    {
      id: "lynch",
      label: "Lynch",
      intro:
        "**Peter Lynch** here. Every stock is a company. Tell me what you own — I want to know the story and whether the PEG ratio justifies the price.",
    },
    {
      id: "munger",
      label: "Munger",
      intro:
        "**Charlie Munger** mode. We start by inverting: what would make each of your positions fail? Then we look for the lollapalooza.\n\nWhat's on your mind?",
    },
    {
      id: "clarman",
      label: "Klarman",
      intro:
        "**Seth Klarman** approach. Capital preservation first. Let's look at the downside on each of your positions before we discuss upside.\n\nWhat are you holding?",
    },
  ] as const;

  type PersonaId = (typeof PERSONAS)[number]["id"];
  ```

- [ ] **Step 2: Add persona state inside the component**

  Find the existing state declarations inside `export default function AIAdvisor()`:

  ```ts
  const [messages, setMessages] = useState<Msg[]>([
  ```

  Add `persona` state on the line immediately before it:

  ```ts
  const [persona, setPersona] = useState<PersonaId>("aje");
  ```

- [ ] **Step 3: Add the switchPersona handler**

  Add this function immediately after the `persona` state line, before the `useQuery` calls:

  ```ts
  const switchPersona = (id: PersonaId) => {
    const p = PERSONAS.find((p) => p.id === id)!;
    setPersona(id);
    setMessages([{ role: "assistant", content: p.intro }]);
  };
  ```

- [ ] **Step 4: Pass `mode` in the streamInvoke call**

  Find the existing `streamInvoke` call inside `send()`:

  ```ts
  await streamInvoke(
    "ai-advisor",
    { messages, context },
    { onDelta, onDone, onError },
  );
  ```

  Replace it with:

  ```ts
  await streamInvoke(
    "ai-advisor",
    {
      messages: newMessages,
      context: {
        raw_context: contextString,
        portfolio,
        positions: openPositions.map((p) => ({
          ticker: p.ticker,
          strategy_type: p.strategy_type,
          value: p.value,
          pnl_percent: p.pnl_percent,
          signal_score: p.signal_score,
        })),
        signals: topSignals.map((s) => ({
          ticker: s.ticker,
          signal_score: s.signal_score,
          action: s.action,
        })),
        marketRegime: "Risk-On",
      },
      mode: persona,
    },
    { onDelta, onDone, onError },
  );
  ```

  > Note: the existing call passes `{ messages, context }` but `messages` there is stale — it references the pre-update state. The correct variable is `newMessages` (which already exists in `send()`). This fixes a latent bug while adding `mode`.

- [ ] **Step 5: Add the pill selector UI**

  Find the `<h2>` heading inside the JSX:

  ```tsx
  <h2 className="mb-4 font-display text-xl font-bold text-foreground">
    AI Advisor
  </h2>
  ```

  Replace it with:

  ```tsx
  <h2 className="mb-3 font-display text-xl font-bold text-foreground">
    AI Advisor
  </h2>;

  {
    /* Persona selector */
  }
  <div className="mb-4 flex flex-wrap gap-1.5">
    {PERSONAS.map((p) => (
      <button
        key={p.id}
        onClick={() => switchPersona(p.id)}
        disabled={loading}
        className={`rounded-full border px-3 py-1 text-xs transition-fast disabled:opacity-50 ${
          persona === p.id
            ? "border-bullish bg-bullish/10 text-foreground"
            : "border-border text-muted-foreground hover:border-bullish/30 hover:text-foreground"
        }`}
      >
        {p.label}
      </button>
    ))}
  </div>;
  ```

- [ ] **Step 6: Run the TypeScript build to verify no errors**

  ```bash
  npm run build
  ```

  Expected: build completes with no TypeScript errors. If errors appear, the most likely cause is the `PersonaId` type — check that `as const` is applied to the `PERSONAS` array.

- [ ] **Step 7: Start the dev server and manually verify**

  ```bash
  npm run dev
  ```

  Open `http://localhost:8080` and navigate to AI Advisor. Verify:
  1. Six persona pills appear below the heading: AJE · Buffett · Graham · Lynch · Munger · Klarman
  2. AJE is highlighted (bullish border + tinted background) on load
  3. Clicking "Buffett" highlights it and resets the chat to the Buffett intro message
  4. Clicking "Graham" resets the chat to the Graham intro message
  5. Pills are disabled (opacity-50) while the AI is responding
  6. Quick prompt buttons still appear and work

- [ ] **Step 8: Commit**

  ```bash
  git add src/pages/AIAdvisor.tsx
  git commit -m "feat: add investor persona pill selector to AIAdvisor page"
  ```

---

### Task 3: Push to remote

- [ ] **Step 1: Verify final state**

  ```bash
  git log --oneline -5
  git status
  ```

  Expected: 2 new commits ahead of remote, working tree clean.

- [ ] **Step 2: Push**

  ```bash
  git push
  ```
