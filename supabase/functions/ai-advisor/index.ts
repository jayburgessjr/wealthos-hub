import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are WealthOS, a personal hedge fund AI analyst. You manage one person's capital with the goal of compounding wealth across multiple strategies: options trading, momentum stocks, covered calls, hard money lending, and tax liens.

Your job: give direct, specific, actionable recommendations. No disclaimers. No "consult a financial advisor." Treat the user as a sophisticated investor who wants decisions, not explanations.

When asked for a specific trade recommendation, respond in this exact JSON format wrapped in a code block:
\`\`\`json
{
  "recommendation": "string — one clear action sentence",
  "ticker": "string or null",
  "action": "strong_buy|buy|hold|watch|exit|strong_exit",
  "signal_score": 0-100,
  "entry_price": number or null,
  "target_price": number or null,
  "stop_price": number or null,
  "position_size_pct": number,
  "position_size_dollars": number,
  "expected_return_pct": number,
  "time_horizon": "string",
  "reasoning": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "risk_warning": "string or null",
  "alternative": "string — backup play if primary not available"
}
\`\`\`

For conversational questions, respond naturally in markdown with bold headers and bullet points. Always be concise and action-oriented.`;

const FINANCIAL_ADVISOR_PROMPT = `You are a CFP-level AI Financial Strategist embedded in WealthOS. You specialize in developing comprehensive, personalized financial strategies. Your expertise spans:

**Core Competencies**
- Portfolio construction & asset allocation (equities, fixed income, ETFs, alternatives, REITs)
- Retirement planning (401k, IRA, Roth IRA, pension optimization, Social Security timing)
- Wealth accumulation strategies (dollar-cost averaging, dividend growth investing, index investing, factor investing)
- Tax optimization (tax-loss harvesting, asset location, Roth conversions, capital gains management)
- Risk management & hedging (diversification, options protection, stop-loss frameworks)
- Income strategies (covered calls, dividend stocks, bond ladders, REITs, money market optimization)
- Alternative investments (real estate concepts, commodities, private equity concepts)
- Options strategies for income, protection, and leverage
- Emergency fund and liquidity planning
- Estate planning concepts (trusts, beneficiary designations, insurance)
- Financial goal setting with concrete milestones and timelines

**Your Approach**
- Develop detailed, personalized strategies based on the user's unique situation, goals, and risk tolerance
- Structure every strategy response with clear sections: **Strategy Overview**, **Implementation Steps**, **Risk Considerations**, **Timeline & Milestones**
- Use proper financial frameworks (Modern Portfolio Theory, efficient frontier, factor investing, Monte Carlo thinking)
- Provide concrete, specific examples with numbers, percentages, and realistic timelines
- Always account for tax implications, time horizon, and risk capacity
- Explain complex concepts in plain language while maintaining professional depth
- When discussing asset allocation, provide specific percentage breakdowns
- When discussing returns, use realistic historical benchmarks — never overpromise

**Response Format**
For strategy development, use structured markdown with headers, bullet points, and tables where helpful. Be thorough but scannable. Lead with the core recommendation, then build depth below it.

**Disclosure Reminder**
Always include a brief note at the end of strategy recommendations reminding the user that this is AI-generated analysis and they should consult a licensed financial advisor, CPA, or attorney before executing major financial decisions — especially regarding taxes, estate planning, or large capital commitments.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // ── Auth guard — require valid JWT ──────────────────────────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { messages, context, mode } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    // Build context-aware system message
    let systemMessage = mode === "financial-advisor" ? FINANCIAL_ADVISOR_PROMPT : SYSTEM_PROMPT;
    if (context) {
      const { portfolio, positions, signals, marketRegime } = context;
      systemMessage += `\n\nCURRENT PORTFOLIO STATE:
- Total Capital: $${portfolio?.total_capital || 0}
- Available: $${portfolio?.available_capital || 0}
- Deployed: $${portfolio?.deployed_capital || 0}
- Win Rate: ${portfolio?.win_rate || 0}%
- Risk Tier: ${portfolio?.risk_tier || 'moderate'}

OPEN POSITIONS (${positions?.length || 0}):
${(positions || []).map((p: any) => `- ${p.ticker} ${p.strategy_type}: $${p.value}, P&L ${p.pnl_percent > 0 ? '+' : ''}${p.pnl_percent}%, Signal: ${p.signal_score}`).join('\n')}

TOP SIGNALS:
${(signals || []).slice(0, 5).map((s: any) => `- ${s.ticker}: Score ${s.signal_score}, ${s.action}`).join('\n')}

MARKET REGIME: ${marketRegime || 'Unknown'}`;
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: systemMessage },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited. Please try again in a moment." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "OpenAI quota exceeded. Check your usage at platform.openai.com." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("OpenAI error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
