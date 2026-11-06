// Anthropic Messages API adapter for the research agent. Forces a tool call so the output is structured JSON.
// The model has no order tools; its output is validated by validateThesis() before anything is stored.
import type { Llm, LlmRequest, LlmResult } from "./agents.ts";

export class AnthropicLlm implements Llm {
  constructor(private apiKey: string, private opts: { model?: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {}) {}

  async generate(req: LlmRequest): Promise<LlmResult> {
    const f = this.opts.fetchImpl ?? fetch;
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const model = this.opts.model ?? "claude-sonnet-5-5";
    const body = {
      model,
      max_tokens: 1500,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      tools: [{ name: req.toolName, description: "Submit the structured thesis for this signal.", input_schema: req.schema }],
      tool_choice: { type: "tool", name: req.toolName },
    };
    let last = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await f("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": this.apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) { last = `status ${res.status}`; await sleep(1000 * 2 ** attempt); continue; }
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`);
      const j = (await res.json()) as { content?: { type: string; name?: string; input?: unknown }[]; usage?: { input_tokens?: number; output_tokens?: number } };
      const tool = j.content?.find((c) => c.type === "tool_use" && c.name === req.toolName);
      if (!tool) throw new Error("Model did not return the thesis tool call.");
      return { output: tool.input, model, inputTokens: j.usage?.input_tokens, outputTokens: j.usage?.output_tokens };
    }
    throw new Error(`Anthropic API unavailable (${last})`);
  }
}
