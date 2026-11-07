// Coach mode for ai-advisor. Owns its request shape: { message, client_msg_id, hints? }. History and plan state are
// read from the database for the caller (user JWT client, RLS applies). No service role anywhere in this path.
// Type-only imports from handler.ts/modes.ts keep this free of import cycles.
import { errorResponse, corsHeaders, fetchT, jsonResponse, logError, logWarn, type AuthedUser } from "../_shared/auth.ts";
import { BODY_CAP_BYTES, MAX_TOKENS, estimateTokens, recordTokens } from "../_shared/limits.ts";
import { COACH_MESSAGE_MAX, renderStrategyContext, sanitizeHints, trimHistory, type ActionRow, type Hints, type ItemRow, type StrategyRow } from "../_shared/strategy/context.ts";
import { adaptCoachStream, fetchWithRetry } from "../_shared/strategy/stream.ts";
import { STRATEGY_TOOL, type StrategyUpdate } from "../_shared/strategy/validate.ts";
import type { AdvisorDeps } from "./handler.ts";
import type { ModeDef } from "./modes.ts";

const FN = "ai-advisor";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CoachBody {
  message: string;
  client_msg_id: string;
  hints: Hints;
}

/** Unknown keys (user_id, messages, context, ...) are ignored. */
export function validateCoachBody(body: unknown): { ok: true; value: CoachBody; reason?: undefined } | { ok: false; reason: string; value?: undefined } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, reason: "body must be an object" };
  const b = body as Record<string, unknown>;
  if (typeof b.message !== "string") return { ok: false, reason: "message" };
  // eslint-disable-next-line no-control-regex
  const message = b.message.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").trim();
  if (message.length < 1 || message.length > COACH_MESSAGE_MAX) return { ok: false, reason: "message length" };
  if (typeof b.client_msg_id !== "string" || !UUID_RE.test(b.client_msg_id)) return { ok: false, reason: "client_msg_id" };
  return { ok: true, value: { message, client_msg_id: b.client_msg_id.toLowerCase(), hints: sanitizeHints(b.hints) } };
}

interface Row<T> {
  data: T | null;
  error: unknown;
}

export async function runCoach(req: Request, deps: AdvisorDeps, auth: AuthedUser, rawBody: unknown, mode: ModeDef): Promise<Response> {
  const env = deps.auth.env;
  try {
    if (JSON.stringify(rawBody ?? null).length > BODY_CAP_BYTES.default) return errorResponse(req, env, 413);
    const v = validateCoachBody(rawBody);
    if (!v.ok) return errorResponse(req, env, 400, `validateCoach: ${v.reason}`);
    const { message, client_msg_id, hints } = v.value;

    const key = env("OPENAI_API_KEY");
    if (!key) return errorResponse(req, env, 500, "OPENAI_API_KEY is not configured");

    const client = auth.client;
    const begin = await client.rpc("coach_begin_turn", { p_client_msg_id: client_msg_id, p_content: message });
    if (begin.error) return errorResponse(req, env, 500, begin.error);
    const status = (begin.data as { status?: string } | null)?.status;
    if (status === "rate_limited") return errorResponse(req, env, 429, undefined, { "Retry-After": "60" });
    if (status === "replayed") return jsonResponse(req, env, { replayed: true });
    if (status !== "new" && status !== "retry") return errorResponse(req, env, 500, `unexpected coach_begin_turn status: ${String(status)}`);

    // Context from the database, scoped to the caller by RLS.
    const [msgs, strat, items, actions] = await Promise.all([
      client.from("strategy_messages").select("role,content").order("created_at", { ascending: false }).limit(30) as PromiseLike<Row<{ role: "user" | "assistant"; content: string }[]>>,
      client.from("user_strategy").select("*").maybeSingle() as PromiseLike<Row<StrategyRow>>,
      client
        .from("strategy_items")
        .select("section,ai_key,title,body,edited_by_user,source,pending_ai_proposal")
        .is("archived_at", null)
        .order("section")
        .limit(150) as PromiseLike<Row<ItemRow[]>>,
      client
        .from("strategy_actions")
        .select("ai_key,title,priority,track,status,edited_by_user,source")
        .is("archived_at", null)
        .order("priority")
        .limit(60) as PromiseLike<Row<ActionRow[]>>,
    ]);
    if (msgs.error || strat.error || items.error || actions.error) {
      return errorResponse(req, env, 500, msgs.error ?? strat.error ?? items.error ?? actions.error);
    }

    const history = trimHistory([...(msgs.data ?? [])].reverse());
    if (!history.length || history[history.length - 1].role !== "user") return errorResponse(req, env, 500, "coach history is missing the current turn");

    const useHints = !strat.data?.onboarding_hints_used && Object.keys(hints).length > 0 ? hints : {};
    const system =
      mode.systemPrompt + renderStrategyContext({ strategy: strat.data, items: items.data ?? [], actions: actions.data ?? [] }, useHints);
    const messages = [{ role: "system", content: system }, ...history];

    let response: Response;
    try {
      response = await fetchWithRetry(() =>
        fetchT(
          "https://api.openai.com/v1/chat/completions",
          {
            method: "POST",
            headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "gpt-4o",
              messages,
              stream: true,
              max_tokens: mode.maxTokens ?? MAX_TOKENS.coach,
              tools: [STRATEGY_TOOL],
              tool_choice: "auto",
            }),
          },
          60000,
        ),
      );
    } catch (e) {
      return errorResponse(req, env, 502, e);
    }
    if (!response.ok) {
      const t = await response.text().catch(() => "");
      return errorResponse(req, env, response.status === 429 ? 429 : 502, `OpenAI ${response.status}: ${t}`);
    }
    if (!response.body) return errorResponse(req, env, 502, "OpenAI returned no body");

    if (Object.keys(useHints).length > 0) {
      // best effort: hints are only used for the first turns of a fresh plan
      void Promise.resolve(client.from("user_strategy").upsert({ user_id: auth.user.id, onboarding_hints_used: true }, { onConflict: "user_id" })).catch(() => undefined);
    }

    const inChars = messages.reduce((n, m) => n + m.content.length, 0);
    const body = adaptCoachStream(response.body, {
      profile: strat.data,
      saveReply: async (text) => {
        const r = await client.rpc("coach_save_reply", { p_client_msg_id: client_msg_id, p_content: text });
        if (r.error) throw new Error(String((r.error as { message?: string }).message ?? "coach_save_reply failed"));
      },
      applyUpdate: async (value: StrategyUpdate) => {
        const r = await client.rpc("apply_strategy_update", { p_update: value });
        if (r.error) throw new Error(String((r.error as { message?: string }).message ?? "apply_strategy_update failed"));
        const d = r.data as { version?: number; applied?: number; proposed?: number; skipped?: number } | null;
        if (!d || typeof d.version !== "number") return null;
        return { version: d.version, applied: d.applied ?? 0, proposed: d.proposed ?? 0, skipped: d.skipped ?? 0 };
      },
      onTokens: (outChars) => recordTokens(client, "ai", FN, estimateTokens(inChars), estimateTokens(outChars)),
      logWarn,
      logError,
    });
    return new Response(body, { headers: { ...corsHeaders(req, env), "Content-Type": "text/event-stream" } });
  } catch (e) {
    return errorResponse(req, env, 500, e);
  }
}
