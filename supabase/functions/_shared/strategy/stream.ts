// Streaming adapter for the coach: forwards content deltas in the original OpenAI chunk shape, buffers tool-call
// deltas server-side (never forwarded), then persists the reply and applies one validated update_strategy call.
// Pure TypeScript with injected side effects so Vitest can drive it with fakes.
import { checkCompleteness, validateStrategyUpdate, type ProfileSnapshot, type StrategyUpdate } from "./validate.ts";

export interface ApplyOutcome {
  version: number;
  applied: number;
  proposed: number;
  skipped: number;
}

export interface CoachStreamDeps {
  /** Persist the assistant prose (coach_save_reply). May throw; failure is logged, not surfaced. */
  saveReply(text: string): Promise<void>;
  /** Apply a validated payload (apply_strategy_update). Throw or return null for any failure: zero writes. */
  applyUpdate(value: StrategyUpdate): Promise<ApplyOutcome | null>;
  /** Existing profile used for the completeness rule. */
  profile: ProfileSnapshot | null;
  onTokens?(outChars: number): void | Promise<void>;
  logWarn?(msg: string, meta?: unknown): void;
  logError?(msg: string, meta?: unknown): void;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
export const sse = (obj: unknown): Uint8Array => enc.encode(`data: ${JSON.stringify(obj)}\n\n`);
export const SSE_DONE = enc.encode("data: [DONE]\n\n");
export const FALLBACK_REPLY = "I updated your plan.";

interface ToolBuf {
  name: string;
  args: string;
}

export function adaptCoachStream(upstream: ReadableStream<Uint8Array>, deps: CoachStreamDeps): ReadableStream<Uint8Array> {
  let cancelled = false;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const out = (chunk: Uint8Array) => {
        if (cancelled) return;
        try {
          controller.enqueue(chunk);
        } catch {
          cancelled = true;
        }
      };
      let text = "";
      let chars = 0;
      const tools = new Map<number, ToolBuf>();
      let finished = false;
      let buffer = "";

      const handleLine = (line: string) => {
        const t = line.trim();
        if (!t.startsWith("data:")) return;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") {
          finished = true;
          return;
        }
        let j: { choices?: { delta?: { content?: unknown; tool_calls?: { index?: number; function?: { name?: string; arguments?: string } }[] }; finish_reason?: string | null }[] };
        try {
          j = JSON.parse(payload);
        } catch {
          return;
        }
        const ch = j?.choices?.[0];
        const delta = ch?.delta;
        if (typeof delta?.content === "string" && delta.content.length) {
          text += delta.content;
          chars += delta.content.length;
          out(sse({ choices: [{ delta: { content: delta.content } }] }));
        }
        if (Array.isArray(delta?.tool_calls)) {
          for (const tc of delta.tool_calls) {
            const idx = typeof tc.index === "number" ? tc.index : 0;
            const b = tools.get(idx) ?? { name: "", args: "" };
            if (tc.function?.name) b.name = tc.function.name;
            if (typeof tc.function?.arguments === "string") b.args += tc.function.arguments;
            tools.set(idx, b);
          }
        }
        if (ch?.finish_reason) finished = true;
      };

      try {
        const reader = upstream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buffer.indexOf("\n")) !== -1) {
            handleLine(buffer.slice(0, nl));
            buffer = buffer.slice(nl + 1);
          }
        }
        buffer += dec.decode();
        if (buffer) handleLine(buffer);
      } catch (e) {
        // upstream died: nothing persisted, nothing applied; the user can resend the same client_msg_id
        deps.logError?.("coach upstream stream failed", String(e));
        if (!cancelled) {
          try {
            controller.error(e);
          } catch {
            /* already closed */
          }
        }
        return;
      }

      if (!finished) {
        deps.logError?.("coach upstream ended without a finish marker");
        if (!cancelled) {
          try {
            controller.error(new Error("upstream ended early"));
          } catch {
            /* already closed */
          }
        }
        return;
      }

      // Flush path runs even when the client has disconnected (cancelled): the turn must not lose its reply.
      const calls = [...tools.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
      const update = calls.filter((c) => c.name === "update_strategy");
      if (update.length > 1) deps.logWarn?.("coach: extra update_strategy calls ignored", { count: update.length });
      if (calls.length > update.length) deps.logWarn?.("coach: unknown tool calls ignored");

      let event: Record<string, unknown> | null = null;
      if (update.length) {
        event = { type: "rejected", reason: "invalid_output" };
        try {
          const parsed: unknown = JSON.parse(update[0].args);
          const v = validateStrategyUpdate(parsed);
          if (!v.ok) {
            deps.logError?.("coach: invalid update_strategy output", { errors: v.errors, raw: update[0].args.slice(0, 2000) });
          } else {
            const incomplete = checkCompleteness(deps.profile, v.value);
            if (incomplete) {
              deps.logError?.("coach: update_strategy rejected", { reason: incomplete });
            } else {
              const r = await deps.applyUpdate(v.value);
              if (r) event = { type: "applied", version: r.version, applied: r.applied, proposed: r.proposed, skipped: r.skipped };
            }
          }
        } catch (e) {
          deps.logError?.("coach: update_strategy failed", { error: String(e), raw: update[0].args.slice(0, 2000) });
        }
      }

      const reply = text.trim() || (update.length ? FALLBACK_REPLY : "");
      if (reply) {
        try {
          await deps.saveReply(reply);
        } catch (e) {
          deps.logError?.("coach: saving reply failed", String(e));
        }
      }
      try {
        await deps.onTokens?.(chars);
      } catch {
        /* best effort */
      }

      if (event) out(sse({ strategy_event: event }));
      out(SSE_DONE);
      if (!cancelled) {
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}

export interface RetryOpts {
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
  delays?: number[];
}

/**
 * Retries ONLY before any response byte is read: network errors and 429/5xx statuses, at most twice
 * (500 ms then 1500 ms plus jitter). A successful or non-retryable response is returned as is.
 */
export async function fetchWithRetry(doFetch: () => Promise<Response>, opts: RetryOpts = {}): Promise<Response> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const rnd = opts.random ?? Math.random;
  const delays = opts.delays ?? [500, 1500];
  for (let attempt = 0; ; attempt++) {
    let res: Response | undefined;
    let err: unknown;
    try {
      res = await doFetch();
    } catch (e) {
      err = e;
    }
    const retryable = err !== undefined || (res !== undefined && (res.status === 429 || res.status >= 500));
    if (!retryable || attempt >= delays.length) {
      if (res) return res;
      throw err;
    }
    await res?.body?.cancel().catch(() => undefined);
    await sleep(delays[attempt] + Math.floor(rnd() * 250));
  }
}
