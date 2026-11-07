// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { adaptCoachStream, fetchWithRetry, type CoachStreamDeps } from '../../../supabase/functions/_shared/strategy/stream';

const enc = new TextEncoder();
const line = (o: unknown) => `data: ${JSON.stringify(o)}\n\n`;
const content = (c: string) => line({ choices: [{ delta: { content: c } }] });
const tool = (index: number, args: string, name?: string) =>
  line({ choices: [{ delta: { tool_calls: [{ index, function: { ...(name ? { name } : {}), arguments: args } }] } }] });
const finish = (r = 'stop') => line({ choices: [{ delta: {}, finish_reason: r }] });

function upstream(chunks: string[], opts: { dieAfter?: boolean; noFinish?: boolean } = {}) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(c) {
      if (i < chunks.length) c.enqueue(enc.encode(chunks[i++]));
      else if (opts.dieAfter) c.error(new Error('socket reset'));
      else c.close();
    },
  });
}

async function drain(s: ReadableStream<Uint8Array>): Promise<string> {
  const r = s.getReader();
  const d = new TextDecoder();
  let out = '';
  for (;;) {
    const { done, value } = await r.read();
    if (done) return out;
    out += d.decode(value);
  }
}

const validArgs = JSON.stringify({ change_reason: 'x', profile: { primary_goal: 'g', risk_tolerance: 'moderate' }, summary: 's' });

const firstApply = (d: { applyUpdate: unknown }) => (d.applyUpdate as { mock: { calls: unknown[][] } }).mock.calls[0][0];

const mkDeps = (over: Partial<CoachStreamDeps> = {}) => {
  const d = {
    saveReply: vi.fn(async () => undefined),
    applyUpdate: vi.fn(async () => ({ version: 3, applied: 2, proposed: 1, skipped: 0 })),
    profile: null,
    onTokens: vi.fn(),
    logWarn: vi.fn(),
    logError: vi.fn(),
    ...over,
  } satisfies CoachStreamDeps;
  return d;
};

describe('adaptCoachStream', () => {
  it('re-emits content in the OpenAI chunk shape and ends with DONE', async () => {
    const d = mkDeps();
    const out = await drain(adaptCoachStream(upstream([content('Hel'), content('lo'), finish(), 'data: [DONE]\n\n']), d));
    expect(out).toContain(`data: ${JSON.stringify({ choices: [{ delta: { content: 'Hel' } }] })}\n\n`);
    expect(out.trim().endsWith('data: [DONE]')).toBe(true);
    expect(d.saveReply).toHaveBeenCalledWith('Hello');
    expect(d.applyUpdate).not.toHaveBeenCalled();
    expect(out).not.toContain('strategy_event');
    expect(d.onTokens).toHaveBeenCalledWith(5);
  });

  it('accumulates tool-call args across chunks, never forwards them, emits applied', async () => {
    const d = mkDeps();
    const half = Math.floor(validArgs.length / 2);
    const out = await drain(
      adaptCoachStream(upstream([content('Plan'), tool(0, validArgs.slice(0, half), 'update_strategy'), tool(0, validArgs.slice(half)), finish('tool_calls'), 'data: [DONE]\n\n']), d),
    );
    expect(out).not.toContain('tool_calls');
    expect(out).not.toContain('primary_goal');
    expect(out).toContain('"strategy_event":{"type":"applied","version":3,"applied":2,"proposed":1,"skipped":0}');
    expect(d.applyUpdate).toHaveBeenCalledTimes(1);
    expect(firstApply(d)).toMatchObject({ change_reason: 'x', summary: 's' });
    expect(d.saveReply).toHaveBeenCalledWith('Plan');
  });

  it('malformed args: rejected event, RPC not called, prose still saved', async () => {
    const d = mkDeps();
    const out = await drain(adaptCoachStream(upstream([content('Hi'), tool(0, '{"change_reason": "x", ', 'update_strategy'), finish('tool_calls')]), d));
    expect(out).toContain('"strategy_event":{"type":"rejected","reason":"invalid_output"}');
    expect(d.applyUpdate).not.toHaveBeenCalled();
    expect(d.saveReply).toHaveBeenCalledWith('Hi');
    expect(d.logError).toHaveBeenCalled();
  });

  it('schema-invalid or incomplete payloads are rejected with zero writes', async () => {
    const d1 = mkDeps();
    const o1 = await drain(adaptCoachStream(upstream([tool(0, JSON.stringify({ change_reason: 'x', user_id: 'evil', summary: 's' }), 'update_strategy'), finish('tool_calls')]), d1));
    expect(o1).toContain('rejected');
    expect(d1.applyUpdate).not.toHaveBeenCalled();
    const items = JSON.stringify({ change_reason: 'x', items: [{ key: 'a', section: 'gap', title: 't' }] });
    const d2 = mkDeps();
    const o2 = await drain(adaptCoachStream(upstream([tool(0, items, 'update_strategy'), finish('tool_calls')]), d2));
    expect(o2).toContain('rejected');
    expect(d2.applyUpdate).not.toHaveBeenCalled();
    expect(d2.saveReply).toHaveBeenCalledWith('I updated your plan.');
  });

  it('RPC failure means rejected', async () => {
    const d = mkDeps({ applyUpdate: vi.fn(async () => { throw new Error('constraint'); }) });
    const out = await drain(adaptCoachStream(upstream([tool(0, validArgs, 'update_strategy'), finish('tool_calls')]), d));
    expect(out).toContain('rejected');
  });

  it('two tool calls: first honoured, second ignored', async () => {
    const d = mkDeps();
    const second = JSON.stringify({ change_reason: 'second', summary: 'other' });
    await drain(adaptCoachStream(upstream([tool(0, validArgs, 'update_strategy'), tool(1, second, 'update_strategy'), finish('tool_calls')]), d));
    expect(d.applyUpdate).toHaveBeenCalledTimes(1);
    expect(firstApply(d)).toMatchObject({ change_reason: 'x' });
    expect(d.logWarn).toHaveBeenCalled();
  });

  it('client cancel mid-stream still persists the reply and applies the update', async () => {
    const d = mkDeps();
    const s = adaptCoachStream(upstream([content('A'), content('B'), tool(0, validArgs, 'update_strategy'), finish('tool_calls')]), d);
    const r = s.getReader();
    await r.read();
    await r.cancel();
    await vi.waitFor(() => expect(d.saveReply).toHaveBeenCalledWith('AB'));
    expect(d.applyUpdate).toHaveBeenCalledTimes(1);
  });

  it('upstream death before a finish marker persists and applies nothing', async () => {
    const d = mkDeps();
    const s = adaptCoachStream(upstream([content('partial'), tool(0, validArgs, 'update_strategy')], { dieAfter: true }), d);
    await expect(drain(s)).rejects.toThrow();
    expect(d.saveReply).not.toHaveBeenCalled();
    expect(d.applyUpdate).not.toHaveBeenCalled();
    const d2 = mkDeps();
    await expect(drain(adaptCoachStream(upstream([content('partial')]), d2))).rejects.toThrow();
    expect(d2.saveReply).not.toHaveBeenCalled();
  });
});

describe('fetchWithRetry', () => {
  const noJitter = { random: () => 0 };
  it('retries 429/5xx twice with 500 then 1500 ms, then returns the last response', async () => {
    const sleep = vi.fn(async (_ms: number) => undefined);
    const f = vi.fn(async (): Promise<Response> => new Response('x', { status: 503 }));
    const res = await fetchWithRetry(f, { sleep, ...noJitter });
    expect(res.status).toBe(503);
    expect(f).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([500, 1500]);
  });
  it('retries network errors and succeeds', async () => {
    const f = vi.fn().mockRejectedValueOnce(new Error('net')).mockResolvedValueOnce(new Response('ok'));
    const res = await fetchWithRetry(f, { sleep: async () => undefined, ...noJitter });
    expect(res.status).toBe(200);
    expect(f).toHaveBeenCalledTimes(2);
  });
  it('does not retry 4xx or success', async () => {
    const f = vi.fn(async () => new Response('x', { status: 400 }));
    expect((await fetchWithRetry(f, { sleep: async () => undefined })).status).toBe(400);
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('throws the network error after exhausting retries', async () => {
    const f = vi.fn().mockRejectedValue(new Error('down'));
    await expect(fetchWithRetry(f, { sleep: async () => undefined, ...noJitter })).rejects.toThrow('down');
    expect(f).toHaveBeenCalledTimes(3);
  });
});
