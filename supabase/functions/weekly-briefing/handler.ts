// weekly-briefing request handler (separate from index.ts so Vitest can import it).
import {
  corsHeaders,
  errorResponse,
  fetchT,
  isResponse,
  preflight,
  readJsonBody,
  requireUser,
  type AuthDeps,
} from "../_shared/auth.ts";
import {
  AI_DAILY_CAP,
  BODY_CAP_BYTES,
  MAX_TOKENS,
  consumeUsage,
  estimateTokens,
  recordTokens,
  tapOpenAIStream,
  usageResponse,
} from "../_shared/limits.ts";
import { validateBriefing, type ValidBriefing } from "../_shared/validate.ts";

export const FN_NAME = "weekly-briefing";

export interface BriefingDeps {
  auth: AuthDeps;
  now?: () => Date;
}

const SYSTEM_PROMPT = `You are AJE Weekly Analyst. Generate a structured Monday morning briefing for an active investor. Format it in clean markdown with these exact sections:

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

const n = (x: number | undefined) => (x === undefined ? 0 : x);

export function buildUserMessage(v: ValidBriefing, now: Date): string {
  const { portfolio, positions, signals } = v.context;
  return `Generate my weekly briefing for the week of ${v.weekOf ?? now.toDateString()}.

PORTFOLIO SNAPSHOT:
- Total Capital: $${n(portfolio?.total_capital)}
- Available: $${n(portfolio?.available_capital)}
- Deployed: $${n(portfolio?.deployed_capital)}
- Total P&L: $${n(portfolio?.total_pnl)} (${n(portfolio?.total_pnl_pct)}%)
- Win Rate: ${n(portfolio?.win_rate)}%

OPEN POSITIONS (${positions.length}):
${positions.map((p) => `- ${p.ticker} (${p.strategy_type ?? "n/a"}): $${n(p.value)}, P&L ${n(p.pnl_percent) > 0 ? "+" : ""}${n(p.pnl_percent)}%, Signal Score: ${n(p.signal_score)}`).join("\n") || "None"}

TOP SIGNALS:
${signals.slice(0, 5).map((s) => `- ${s.ticker}: Score ${n(s.signal_score)}, Action: ${s.action ?? "n/a"}, Entry $${n(s.entry_price)}, Target $${n(s.target_price)}`).join("\n") || "None available"}`;
}

export async function handle(req: Request, deps: BriefingDeps): Promise<Response> {
  const env = deps.auth.env;
  try {
    const pre = preflight(req, env);
    if (pre) return pre;
    const auth = await requireUser(req, deps.auth);
    if (isResponse(auth)) return auth;
    const body = await readJsonBody(req, env, BODY_CAP_BYTES.default);
    if (!body.ok) return body.response;

    const v = validateBriefing(body.body);
    if (!v.ok) return errorResponse(req, env, 400, `validateBriefing: ${v.reason}`);

    const gate = await consumeUsage(auth.client, "ai", FN_NAME, AI_DAILY_CAP);
    if (gate !== "ok") return usageResponse(req, env, gate);

    const key = env("OPENAI_API_KEY");
    if (!key) return errorResponse(req, env, 500, "OPENAI_API_KEY is not configured");

    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(v.value, (deps.now ?? (() => new Date()))()) },
    ];

    let response: Response;
    try {
      response = await fetchT(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-4o", messages, stream: true, max_tokens: MAX_TOKENS.briefing }),
        },
        30000,
      );
    } catch (e) {
      return errorResponse(req, env, 502, e);
    }
    if (!response.ok) {
      const t = await response.text().catch(() => "");
      return errorResponse(req, env, response.status === 429 ? 429 : 502, `OpenAI ${response.status}: ${t}`);
    }
    if (!response.body) return errorResponse(req, env, 502, "OpenAI returned no body");

    const inChars = messages.reduce((c, m) => c + m.content.length, 0);
    const stream = tapOpenAIStream(response.body, (outChars) =>
      recordTokens(auth.client, "ai", FN_NAME, estimateTokens(inChars), estimateTokens(outChars)),
    );
    return new Response(stream, { headers: { ...corsHeaders(req, env), "Content-Type": "text/event-stream" } });
  } catch (e) {
    return errorResponse(req, env, 500, e);
  }
}
