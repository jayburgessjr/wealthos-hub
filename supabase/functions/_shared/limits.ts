// Single source of truth for edge-function cost and size limits, plus the usage-counter helpers.
// Pure TypeScript (no npm: specifiers, no Deno.*) so Vitest can import it.
// Product premise: no tiers. One uniform cap per user, per UTC day.
import { errorResponse, type Env } from "./auth.ts";

export const AI_DAILY_CAP = 150; // AI calls per user per UTC day, all AI functions combined
export const DATA_DAILY_CAP = 2000; // market-data proxy calls per user per UTC day

export const MAX_TOKENS = { chat: 1200, briefing: 1800, signals: 2500 } as const;

export const MAX_MESSAGES = 20;
export const MAX_MESSAGE_CHARS = 4000;
export const MAX_TOTAL_CHARS = 24000;
export const MAX_CONTEXT_BYTES = 16384;
export const MAX_POSITIONS = 50;
export const MAX_SIGNALS = 10;
export const MAX_SIGNAL_TICKERS = 25;

export const BODY_CAP_BYTES = { default: 65536, chat: 98304 } as const;

export type Bucket = "ai" | "data";

export function capFor(bucket: Bucket): number {
  return bucket === "ai" ? AI_DAILY_CAP : DATA_DAILY_CAP;
}

/** Seconds from `now` until the next UTC midnight (the counter rollover). */
export function secondsUntilUtcMidnight(now: Date = new Date()): number {
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(1, Math.ceil((next - now.getTime()) / 1000));
}

// Minimal structural type for a Supabase client (only rpc is needed here).
export interface RpcClient {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
}

export type UsageResult = "ok" | "limit" | "error";

/**
 * Atomically counts one call for the authenticated caller (uid comes from the JWT inside the RPC) and
 * compares the returned daily total with the cap. Any error fails CLOSED.
 */
export async function consumeUsage(client: RpcClient, bucket: Bucket, fn: string, cap: number = capFor(bucket)): Promise<UsageResult> {
  try {
    const { data, error } = await client.rpc("consume_usage", { p_bucket: bucket, p_fn: fn });
    if (error) {
      console.error("consume_usage failed", error);
      return "error";
    }
    const total = typeof data === "number" ? data : Number(data);
    if (!Number.isFinite(total)) return "error";
    return total > cap ? "limit" : "ok";
  } catch (e) {
    console.error("consume_usage threw", e);
    return "error";
  }
}

/** Response for a non-ok UsageResult: 429 with Retry-After for "limit", 503 (fail closed) for "error". */
export function usageResponse(req: Request, env: Env, result: Exclude<UsageResult, "ok">, now: Date = new Date()): Response {
  if (result === "limit") {
    return errorResponse(req, env, 429, undefined, { "Retry-After": String(secondsUntilUtcMidnight(now)) });
  }
  return errorResponse(req, env, 503);
}

/** Best-effort token bookkeeping. Never throws and never fails the request. */
export async function recordTokens(client: RpcClient, bucket: Bucket, fn: string, tokensIn: number, tokensOut: number): Promise<void> {
  try {
    const { error } = await client.rpc("record_usage_tokens", {
      p_bucket: bucket,
      p_fn: fn,
      p_in: Math.max(0, Math.floor(tokensIn)),
      p_out: Math.max(0, Math.floor(tokensOut)),
    });
    if (error) console.error("record_usage_tokens failed", error);
  } catch (e) {
    console.error("record_usage_tokens threw", e);
  }
}

export const estimateTokens = (chars: number): number => Math.ceil(Math.max(0, chars) / 4);

/**
 * Passes an OpenAI SSE stream through untouched while counting the generated characters.
 * `onDone(chars)` runs once when the stream ends (flush); it is not called if the client disconnects.
 */
export function tapOpenAIStream(body: ReadableStream<Uint8Array>, onDone: (outputChars: number) => void | Promise<void>): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let buffer = "";
  let chars = 0;
  const scan = (final: boolean) => {
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1 || (final && buffer.length > 0)) {
      const line = idx === -1 ? buffer : buffer.slice(0, idx);
      buffer = idx === -1 ? "" : buffer.slice(idx + 1);
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const delta = JSON.parse(payload)?.choices?.[0]?.delta?.content;
        if (typeof delta === "string") chars += delta.length;
      } catch {
        // non-JSON line; ignore
      }
    }
  };
  return body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        scan(false);
        controller.enqueue(chunk);
      },
      async flush() {
        buffer += decoder.decode();
        scan(true);
        await onDone(chars);
      },
    }),
  );
}
