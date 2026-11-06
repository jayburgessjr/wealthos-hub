// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { OpenAiLlm } from "../../../supabase/functions/_shared/desk/pipeline/llm.ts";
import { THESIS_SCHEMA, THESIS_TOOL } from "../../../supabase/functions/_shared/desk/pipeline/agents.ts";

const req = { system: "sys", user: "usr", toolName: THESIS_TOOL, schema: THESIS_SCHEMA as unknown as Record<string, unknown> };
const reply = (args: string, status = 200) =>
  new Response(JSON.stringify({ choices: [{ message: { tool_calls: [{ type: "function", function: { name: THESIS_TOOL, arguments: args } }] } }], usage: { prompt_tokens: 11, completion_tokens: 7 } }), { status });

describe("OpenAI research adapter", () => {
  it("forces the thesis function call and parses its arguments", async () => {
    const f = vi.fn(async () => reply('{"direction":"long","confidence":0.6}'));
    const out = await new OpenAiLlm("sk-test", { fetchImpl: f as unknown as typeof fetch }).generate(req);
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.openai.com/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe("gpt-4o");
    expect(body.tool_choice).toEqual({ type: "function", function: { name: THESIS_TOOL } });
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(out).toMatchObject({ output: { direction: "long", confidence: 0.6 }, model: "gpt-4o", inputTokens: 11, outputTokens: 7 });
  });
  it("honours a model override", async () => {
    const f = vi.fn(async () => reply("{}"));
    const out = await new OpenAiLlm("k", { model: "gpt-4.1", fetchImpl: f as unknown as typeof fetch }).generate(req);
    expect(out.model).toBe("gpt-4.1");
  });
  it("retries 429 and 5xx with backoff, then gives up", async () => {
    const sleep = vi.fn(async () => {});
    const f = vi.fn(async () => new Response("{}", { status: 503 }));
    await expect(new OpenAiLlm("k", { fetchImpl: f as unknown as typeof fetch, sleep }).generate(req)).rejects.toThrow(/unavailable/);
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(3);
  });
  it("fails closed on a missing function call or malformed JSON, and never echoes the key", async () => {
    const none = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: {} }] }), { status: 200 }));
    await expect(new OpenAiLlm("sk-secret", { fetchImpl: none as unknown as typeof fetch }).generate(req)).rejects.toThrow(/function call/);
    const bad = vi.fn(async () => reply("{not json"));
    await expect(new OpenAiLlm("sk-secret", { fetchImpl: bad as unknown as typeof fetch }).generate(req)).rejects.toThrow(/malformed/);
    const denied = vi.fn(async () => new Response("{}", { status: 401 }));
    await expect(new OpenAiLlm("sk-secret", { fetchImpl: denied as unknown as typeof fetch }).generate(req)).rejects.toThrow(/^OpenAI API 401$/);
  });
});
