// @vitest-environment node
// Regression guard: every non-desk edge function must authenticate through _shared/auth, use no wildcard CORS,
// never put raw error text in a response, and meter/cap every OpenAI call.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const FUNCTIONS = resolve(__dirname, '../../../supabase/functions');
const CONFIG = resolve(__dirname, '../../../supabase/config.toml');

/** How each non-desk function authenticates. A NEW function directory fails until it is classified here. */
const CLASS: Record<string, 'ai' | 'data' | 'cron-or-user' | 'user' | 'own-auth'> = {
  'ai-advisor': 'ai',
  'weekly-briefing': 'ai',
  'generate-signals': 'ai',
  'screen-assets': 'data',
  'get-financial-news': 'data',
  'get-market-data': 'data',
  'get-ticker-context': 'data',
  'get-congress-trades': 'data',
  'get-earnings-calendar': 'data',
  'get-price-data': 'data',
  'check-alerts': 'cron-or-user',
  'stripe-checkout': 'user',
  // send-household-invite verifies the JWT itself (auth.getUser) and enforces household ownership; only CORS/405 are shared.
  'send-household-invite': 'own-auth',
};

/** Functions that verify credentials in code and legitimately run with gateway verify_jwt = false. */
const VERIFY_JWT_FALSE_ALLOWED = ['desk-mark-positions', 'desk-run-agent', 'desk-scorecard', 'check-alerts', 'stripe-webhook'];

const EXCLUDED = (d: string) => d === '_shared' || d.startsWith('desk-') || d === 'stripe-webhook';

const dirs = readdirSync(FUNCTIONS).filter((d) => statSync(join(FUNCTIONS, d)).isDirectory() && !EXCLUDED(d));
const source = (dir: string) =>
  readdirSync(join(FUNCTIONS, dir))
    .filter((f) => f.endsWith('.ts'))
    .map((f) => readFileSync(join(FUNCTIONS, dir, f), 'utf8'))
    .join('\n');

describe('every non-desk function is classified', () => {
  it('has no unclassified function directory and no stale classification', () => {
    expect(dirs.sort()).toEqual(Object.keys(CLASS).sort());
  });
});

describe.each(dirs)('%s', (dir) => {
  const src = source(dir);
  const kind = CLASS[dir];

  it('has an entry point', () => {
    expect(existsSync(join(FUNCTIONS, dir, 'index.ts'))).toBe(true);
  });

  it('authenticates through the shared helper (or verifies the JWT itself for own-auth)', () => {
    if (kind === 'own-auth') {
      expect(src).toMatch(/auth\.getUser\(/);
      expect(src).toMatch(/_shared\/auth\.ts/);
      expect(src).toMatch(/preflight\(/);
      return;
    }
    expect(src).toMatch(/_shared\/auth\.ts/);
    expect(src).toMatch(kind === 'cron-or-user' ? /requireCronOrUser\(/ : /requireUser\(/);
  });

  it('uses no wildcard CORS', () => {
    expect(src).not.toMatch(/Allow-Origin["']?\s*:\s*["']\*["']/);
    expect(src).not.toMatch(/Allow-Origin[^\n]*\*/);
  });

  it('never puts raw error text in a response body', () => {
    expect(src).not.toMatch(/error:\s*[^,}\n]*\.message/);
    expect(src).not.toMatch(/error:\s*String\(/);
    expect(src).not.toMatch(/details:\s*String\(/);
    expect(src).not.toMatch(/error:\s*e instanceof Error/);
  });

  it('meters usage for AI and data functions', () => {
    if (kind === 'ai' || kind === 'data' || kind === 'cron-or-user') expect(src).toMatch(/consumeUsage\(/);
  });

  it('caps every OpenAI call with max_tokens and meters it', () => {
    if (!/api\.openai\.com/.test(src)) return;
    expect(src).toMatch(/max_tokens/);
    expect(src).toMatch(/consumeUsage\(/);
    expect(src).toMatch(/"ai"|'ai'/);
  });

  it('does not rely on the gateway alone (no bare Bearer-prefix check)', () => {
    expect(src).not.toMatch(/startsWith\(\s*["']Bearer /);
  });
});

describe('config.toml', () => {
  const toml = readFileSync(CONFIG, 'utf8');
  const off = [...toml.matchAll(/\[functions\.([\w-]+)\]\s*\n\s*verify_jwt\s*=\s*false/g)].map((m) => m[1]);

  it('disables gateway JWT verification only for allowlisted, code-verified functions', () => {
    for (const fn of off) expect(VERIFY_JWT_FALSE_ALLOWED).toContain(fn);
  });
  it('lists every required verify_jwt = false entry', () => {
    for (const fn of ['check-alerts', 'stripe-webhook', 'desk-mark-positions', 'desk-run-agent', 'desk-scorecard']) {
      expect(off).toContain(fn);
    }
  });
});

describe('shared auth modules stay Vitest-importable', () => {
  for (const f of ['auth.ts', 'limits.ts', 'validate.ts', 'html.ts']) {
    it(`_shared/${f} has no npm: specifier and no Deno.* access`, () => {
      const src = readFileSync(join(FUNCTIONS, '_shared', f), 'utf8').replace(/\/\/.*$/gm, '');
      expect(src).not.toMatch(/npm:/);
      expect(src).not.toMatch(/\bDeno\./);
      expect(src).not.toMatch(/https?:\/\/[^"'\s]+\.ts/);
    });
  }
  it('auth-deno.ts is the only place that touches Deno', () => {
    const src = readFileSync(join(FUNCTIONS, '_shared', 'auth-deno.ts'), 'utf8');
    expect(src).toMatch(/Deno\.env/);
  });
});

describe('ai-advisor dispatch seam', () => {
  it('modes.ts owns the registry and contains no auth, limits or validation logic', () => {
    const src = readFileSync(join(FUNCTIONS, 'ai-advisor', 'modes.ts'), 'utf8');
    expect(src).toMatch(/export const MODE_REGISTRY/);
    expect(src).not.toMatch(/requireUser|consumeUsage|validateChat|corsHeaders/);
  });
});
