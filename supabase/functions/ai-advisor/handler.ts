// ai-advisor request handler. Kept out of index.ts so Vitest can import it (index.ts pulls Deno-only imports).
// Dispatch seam: handle -> authenticate -> validateChat -> resolveMode -> enforceLimit -> buildSystemPrompt -> callOpenAI.
import {
  corsHeaders,
  errorResponse,
  fetchT,
  isResponse,
  preflight,
  readJsonBody,
  requireUser,
  type AuthDeps,
  type AuthedUser,
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
import { renderContext, validateChat, type ValidChat } from "../_shared/validate.ts";
import { MODE_NAMES, resolveMode, type ModeDef } from "./modes.ts";

export const FN_NAME = "ai-advisor";

export interface AdvisorDeps {
  auth: AuthDeps;
}

export const buildSystemPrompt = (mode: ModeDef, context: ValidChat["context"], pro = false): string =>
  mode.systemPrompt + (pro && mode.advanced ? mode.advanced : "") + renderContext(context);

export async function authenticate(req: Request, deps: AdvisorDeps): Promise<Response | { auth: AuthedUser; body: unknown }> {
  const pre = preflight(req, deps.auth.env);
  if (pre) return pre;
  const auth = await requireUser(req, deps.auth);
  if (isResponse(auth)) return auth;
  const body = await readJsonBody(req, deps.auth.env, BODY_CAP_BYTES.chat);
  if (!body.ok) return body.response;
  return { auth, body: body.body };
}

export async function callOpenAI(
  req: Request,
  deps: AdvisorDeps,
  auth: AuthedUser,
  chat: ValidChat,
  mode: ModeDef,
): Promise<Response> {
  const env = deps.auth.env;
  const key = env("OPENAI_API_KEY");
  if (!key) return errorResponse(req, env, 500, "OPENAI_API_KEY is not configured");

  const system = buildSystemPrompt(mode, chat.context, chat.pro);
  const messages = [{ role: "system", content: system }, ...chat.messages];

  let response: Response;
  try {
    response = await fetchT(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "gpt-4o", messages, stream: true, max_tokens: mode.maxTokens ?? MAX_TOKENS.chat }),
      },
      60000,
    );
  } catch (e) {
    return errorResponse(req, env, 502, e);
  }

  if (!response.ok) {
    const t = await response.text().catch(() => "");
    return errorResponse(req, env, response.status === 429 ? 429 : 502, `OpenAI ${response.status}: ${t}`);
  }
  if (!response.body) return errorResponse(req, env, 502, "OpenAI returned no body");

  const inChars = messages.reduce((n, m) => n + m.content.length, 0);
  const body = tapOpenAIStream(response.body, (outChars) =>
    recordTokens(auth.client, "ai", FN_NAME, estimateTokens(inChars), estimateTokens(outChars)),
  );
  return new Response(body, { headers: { ...corsHeaders(req, env), "Content-Type": "text/event-stream" } });
}

export async function handle(req: Request, deps: AdvisorDeps): Promise<Response> {
  const env = deps.auth.env;
  try {
    const a = await authenticate(req, deps);
    if (isResponse(a)) return a;

    // Modes with a `run` hook own their request shape (coach); auth and usage limits still come first.
    const peek = (a.body as { mode?: unknown } | null)?.mode;
    const own = typeof peek === "string" ? resolveMode(peek) : undefined;
    if (own?.run) {
      const g = await consumeUsage(a.auth.client, "ai", FN_NAME, AI_DAILY_CAP);
      if (g !== "ok") return usageResponse(req, env, g);
      return await own.run(req, deps, a.auth, a.body, own);
    }

    const v = validateChat(a.body, MODE_NAMES);
    if (!v.ok) return errorResponse(req, env, 400, `validateChat: ${v.reason}`);

    const mode = resolveMode(v.value.mode);

    const gate = await consumeUsage(a.auth.client, "ai", FN_NAME, AI_DAILY_CAP);
    if (gate !== "ok") return usageResponse(req, env, gate);

    return await callOpenAI(req, deps, a.auth, v.value, mode);
  } catch (e) {
    return errorResponse(req, env, 500, e);
  }
}
