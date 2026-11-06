// OpenAI Chat Completions adapter for the research agent. Forces a function call so the output is structured JSON.
// The model has no order tools; its output is validated by validateThesis() before anything is stored.
import type { Llm, LlmRequest, LlmResult } from "./agents.ts";

export class OpenAiLlm implements Llm {
  constructor(private apiKey: string, private opts: { model?: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {}) {}

  async generate(req: LlmRequest): Promise<LlmResult> {
    const f = this.opts.fetchImpl ?? fetch;
    const sleep = this.opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
    const model = this.opts.model ?? "gpt-4o";
    const body = {
      model,
      max_tokens: 1500,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content: req.user },
      ],
      tools: [{ type: "function", function: { name: req.toolName, description: "Submit the structured thesis for this signal.", parameters: req.schema } }],
      tool_choice: { type: "function", function: { name: req.toolName } },
    };
    let last = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await f("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });
      if (res.status === 429 || res.status >= 500) { last = `status ${res.status}`; await sleep(1000 * 2 ** attempt); continue; }
      if (!res.ok) throw new Error(`OpenAI API ${res.status}`);
      const j = (await res.json()) as {
        choices?: { message?: { tool_calls?: { type?: string; function?: { name?: string; arguments?: string } }[] } }[];
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      const call = j.choices?.[0]?.message?.tool_calls?.find((c) => c.function?.name === req.toolName);
      if (!call?.function?.arguments) throw new Error("Model did not return the thesis function call.");
      let output: unknown;
      try {
        output = JSON.parse(call.function.arguments);
      } catch {
        throw new Error("Model returned malformed thesis JSON.");
      }
      return { output, model, inputTokens: j.usage?.prompt_tokens, outputTokens: j.usage?.completion_tokens };
    }
    throw new Error(`OpenAI API unavailable (${last})`);
  }
}
