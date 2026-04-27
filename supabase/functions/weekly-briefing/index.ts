import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are WealthOS Weekly Analyst. Generate a structured Monday morning briefing for an active investor. Format it in clean markdown with these exact sections:

## Week of [date]
### What Happened Last Week
[2-3 bullet points about portfolio performance]
### Market Regime This Week
[1 paragraph, direct assessment]
### Top 3 Moves This Week
1. **[TICKER]** — [one sentence action]
2. **[TICKER]** — [one sentence action]
3. **[TICKER]** — [one sentence action]
### What to Avoid
- [2-3 things to stay away from]
### Risk Level This Week
[CONSERVATIVE / MODERATE / AGGRESSIVE] — [one sentence why]`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { portfolio, positions, signals, weekOf } = await req.json();
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");

    const userMessage = `Generate my weekly briefing for the week of ${weekOf || new Date().toDateString()}.

PORTFOLIO SNAPSHOT:
- Total Capital: $${portfolio?.total_capital || 0}
- Available: $${portfolio?.available_capital || 0}
- Deployed: $${portfolio?.deployed_capital || 0}
- Total P&L: $${portfolio?.total_pnl || 0} (${portfolio?.total_pnl_pct || 0}%)
- Win Rate: ${portfolio?.win_rate || 0}%

OPEN POSITIONS (${positions?.length || 0}):
${(positions || []).map((p: any) => `- ${p.ticker} (${p.strategy_type}): $${p.value}, P&L ${p.pnl_percent > 0 ? '+' : ''}${p.pnl_percent}%, Signal Score: ${p.signal_score}`).join('\n') || 'None'}

TOP SIGNALS:
${(signals || []).slice(0, 5).map((s: any) => `- ${s.ticker}: Score ${s.signal_score}, Action: ${s.action}, Entry $${s.entry_price}, Target $${s.target_price}`).join('\n') || 'None available'}`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
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
    console.error("weekly-briefing error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
