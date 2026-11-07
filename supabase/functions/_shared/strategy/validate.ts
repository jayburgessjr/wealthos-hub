// Hand-written, dependency-free validator for the coach's `update_strategy` tool call.
// Pure TypeScript (no npm:, no Deno.*) so Vitest can import it. Unknown keys are rejected, never stripped.
// The JSON schema constant below is the single source for the OpenAI tool definition.

export const SECTIONS = ["wealth", "invest", "opportunity", "gap", "income"] as const;
export const TRACKS = ["general", "save", "debt", "invest", "earn", "protect"] as const;
export const RISKS = ["conservative", "moderate", "aggressive"] as const;
export const EFFORTS = ["low", "medium", "high"] as const;
export type Section = (typeof SECTIONS)[number];
export type Track = (typeof TRACKS)[number];

export const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;
export const MAX_ITEMS = 30;
export const MAX_ACTIONS = 20;
export const MAX_REMOVALS = 20;

export interface StrategyProfile {
  primary_goal?: string;
  time_horizon_years?: number;
  risk_tolerance?: (typeof RISKS)[number];
  age?: number;
  annual_income?: number;
  monthly_savings?: number;
  net_worth_estimate?: number;
  notes?: string;
  monthly_income?: number;
  income_sources?: string;
  emergency_fund_months?: number;
  debts_summary?: string;
  existing_accounts?: string;
}
export interface StrategyItemIn {
  key: string;
  section: Section;
  title: string;
  body?: string;
  metrics?: Record<string, string | number>;
  impact?: number;
}
export interface StrategyActionIn {
  key: string;
  title: string;
  detail?: string;
  priority: number;
  track?: Track;
  due_hint?: string;
  item_key?: string;
}
export interface StrategyRemoveIn {
  kind: "item" | "action";
  section?: Section;
  key: string;
}
export interface StrategyUpdate {
  change_reason: string;
  profile?: StrategyProfile;
  summary?: string;
  items?: StrategyItemIn[];
  actions?: StrategyActionIn[];
  remove_keys?: StrategyRemoveIn[];
}

export type StrategyResult = { ok: true; value: StrategyUpdate; errors?: undefined } | { ok: false; errors: string[]; value?: undefined };

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

// ── Safety backstop (the prompt is the primary control) ─────────────────────
// A negated mention ("not guaranteed", "never risk-free") is allowed so honest disclaimers do not reject a plan.
const DENY_TEXT: RegExp[] = [
  /(?<!\bnot\s)(?<!\bnever\s)(?<!\bno\s)(?<!n't\s)\bguarantee(?:d|s)?\b/i,
  /(?<!\bnot\s)(?<!\bnever\s)(?<!n't\s)\brisk[\s-]?free\b/i,
  /\bcan(?:'|’)?t\s+lose\b/i,
  /\bcannot\s+lose\b/i,
  /\bdouble\s+your\s+money\b/i,
];
const DENY_METRIC_KEY = /^(expected_return.*|target_price|entry_price|stop_price|ticker|price_target)$/i;

export const denyListHit = (text: string): boolean => DENY_TEXT.some((re) => re.test(text));

// ── Field readers (push errors, return undefined on problems) ───────────────
class Ctx {
  errors: string[] = [];
  err(path: string, msg: string) {
    this.errors.push(`${path}: ${msg}`);
  }
  unknownKeys(o: Record<string, unknown>, allowed: readonly string[], path: string) {
    for (const k of Object.keys(o)) if (!allowed.includes(k)) this.err(path, `unknown key "${k}"`);
  }
  /** optional string; null counts as absent (strict tool schemas send null for optional fields) */
  str(o: Record<string, unknown>, k: string, path: string, min: number, max: number, required = false): string | undefined {
    const v = o[k];
    if (v === undefined || v === null) {
      if (required) this.err(`${path}.${k}`, "required");
      return undefined;
    }
    if (typeof v !== "string") {
      this.err(`${path}.${k}`, "must be a string");
      return undefined;
    }
    const t = v.trim();
    if (t.length < min || t.length > max) {
      this.err(`${path}.${k}`, `length must be ${min}..${max}`);
      return undefined;
    }
    return t;
  }
  num(o: Record<string, unknown>, k: string, path: string, lo: number, hi: number, int = false, required = false): number | undefined {
    const v = o[k];
    if (v === undefined || v === null) {
      if (required) this.err(`${path}.${k}`, "required");
      return undefined;
    }
    if (typeof v !== "number" || !Number.isFinite(v) || v < lo || v > hi || (int && !Number.isInteger(v))) {
      this.err(`${path}.${k}`, `must be ${int ? "an integer" : "a number"} in ${lo}..${hi}`);
      return undefined;
    }
    return v;
  }
  oneOf<T extends string>(o: Record<string, unknown>, k: string, path: string, list: readonly T[], required = false): T | undefined {
    const v = o[k];
    if (v === undefined || v === null) {
      if (required) this.err(`${path}.${k}`, "required");
      return undefined;
    }
    if (typeof v !== "string" || !list.includes(v as T)) {
      this.err(`${path}.${k}`, `must be one of ${list.join("|")}`);
      return undefined;
    }
    return v as T;
  }
  key(o: Record<string, unknown>, k: string, path: string, required = true): string | undefined {
    const v = o[k];
    if (v === undefined || v === null) {
      if (required) this.err(`${path}.${k}`, "required");
      return undefined;
    }
    if (typeof v !== "string" || !KEY_RE.test(v)) {
      this.err(`${path}.${k}`, "must match ^[a-z0-9][a-z0-9_-]{0,63}$");
      return undefined;
    }
    return v;
  }
  text(path: string, t: string | undefined) {
    if (t && denyListHit(t)) this.err(path, "contains guaranteed-return language");
  }
}

const PROFILE_KEYS = [
  "primary_goal", "time_horizon_years", "risk_tolerance", "age", "annual_income", "monthly_savings", "net_worth_estimate",
  "notes", "monthly_income", "income_sources", "emergency_fund_months", "debts_summary", "existing_accounts",
] as const;

function readProfile(c: Ctx, raw: unknown): StrategyProfile | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObj(raw)) {
    c.err("profile", "must be an object");
    return undefined;
  }
  c.unknownKeys(raw, PROFILE_KEYS, "profile");
  const p: StrategyProfile = {};
  const set = <K extends keyof StrategyProfile>(k: K, v: StrategyProfile[K] | undefined) => {
    if (v !== undefined) p[k] = v;
  };
  set("primary_goal", c.str(raw, "primary_goal", "profile", 1, 300));
  set("time_horizon_years", c.num(raw, "time_horizon_years", "profile", 1, 60, true));
  set("risk_tolerance", c.oneOf(raw, "risk_tolerance", "profile", RISKS));
  set("age", c.num(raw, "age", "profile", 16, 110, true));
  set("annual_income", c.num(raw, "annual_income", "profile", 0, 1e12));
  set("monthly_savings", c.num(raw, "monthly_savings", "profile", 0, 1e12));
  set("net_worth_estimate", c.num(raw, "net_worth_estimate", "profile", 0, 1e12));
  set("notes", c.str(raw, "notes", "profile", 1, 1000));
  set("monthly_income", c.num(raw, "monthly_income", "profile", 0, 1e12));
  set("income_sources", c.str(raw, "income_sources", "profile", 1, 300));
  set("emergency_fund_months", c.num(raw, "emergency_fund_months", "profile", 0, 120));
  set("debts_summary", c.str(raw, "debts_summary", "profile", 1, 400));
  set("existing_accounts", c.str(raw, "existing_accounts", "profile", 1, 400));
  return p;
}

function readMetrics(c: Ctx, raw: unknown, path: string): Record<string, string | number> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!isObj(raw)) {
    c.err(path, "must be an object");
    return undefined;
  }
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === null || v === undefined) continue; // strict schemas send null for unused metrics
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(k)) c.err(path, `bad metric key "${k}"`);
    else if (DENY_METRIC_KEY.test(k)) c.err(path, `metric "${k}" is not allowed (no prices, tickers or return forecasts)`);
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.length <= 80) {
      if (denyListHit(v)) c.err(path, `metric "${k}" contains guaranteed-return language`);
      out[k] = v;
    } else c.err(path, `metric "${k}" must be a number or string <= 80`);
  }
  if (Object.keys(out).length > 8) c.err(path, "at most 8 metrics");
  if (out.effort !== undefined && !EFFORTS.includes(out.effort as (typeof EFFORTS)[number])) c.err(path, "effort must be low|medium|high");
  if (out.monthly_gain_estimate !== undefined && (typeof out.monthly_gain_estimate !== "number" || out.monthly_gain_estimate < 0 || out.monthly_gain_estimate > 1e9)) {
    c.err(path, "monthly_gain_estimate must be a number 0..1e9");
  }
  if (out.time_to_first_dollar !== undefined && typeof out.time_to_first_dollar !== "string") c.err(path, "time_to_first_dollar must be a string");
  return Object.keys(out).length ? out : undefined;
}

export function validateStrategyUpdate(raw: unknown): StrategyResult {
  const c = new Ctx();
  if (!isObj(raw)) return { ok: false, errors: ["payload must be an object"] };
  c.unknownKeys(raw, ["change_reason", "profile", "summary", "items", "actions", "remove_keys"], "payload");

  const change_reason = c.str(raw, "change_reason", "payload", 1, 300, true);
  const profile = readProfile(c, raw.profile);
  const summary = c.str(raw, "summary", "payload", 1, 1500);
  c.text("summary", summary);

  let items: StrategyItemIn[] | undefined;
  if (raw.items !== undefined && raw.items !== null) {
    if (!Array.isArray(raw.items)) c.err("items", "must be an array");
    else if (raw.items.length > MAX_ITEMS) c.err("items", `at most ${MAX_ITEMS}`);
    else {
      items = [];
      const seen = new Set<string>();
      raw.items.forEach((it, i) => {
        const path = `items[${i}]`;
        if (!isObj(it)) return c.err(path, "must be an object");
        c.unknownKeys(it, ["key", "section", "title", "body", "metrics", "impact"], path);
        const key = c.key(it, "key", path);
        const section = c.oneOf(it, "section", path, SECTIONS, true);
        const title = c.str(it, "title", path, 1, 160, true);
        const body = c.str(it, "body", path, section === "income" ? 1 : 0, 1200, section === "income");
        const metrics = readMetrics(c, it.metrics, `${path}.metrics`);
        const impact = c.num(it, "impact", path, 1, 5, true);
        c.text(`${path}.title`, title);
        c.text(`${path}.body`, body);
        if (key && section) {
          const id = `${section}:${key}`;
          if (seen.has(id)) c.err(path, `duplicate item ${id}`);
          seen.add(id);
        }
        if (key && section && title) {
          const v: StrategyItemIn = { key, section, title };
          if (body !== undefined) v.body = body;
          if (metrics) v.metrics = metrics;
          if (impact !== undefined) v.impact = impact;
          items!.push(v);
        }
      });
    }
  }

  let actions: StrategyActionIn[] | undefined;
  if (raw.actions !== undefined && raw.actions !== null) {
    if (!Array.isArray(raw.actions)) c.err("actions", "must be an array");
    else if (raw.actions.length > MAX_ACTIONS) c.err("actions", `at most ${MAX_ACTIONS}`);
    else {
      actions = [];
      const seen = new Set<string>();
      raw.actions.forEach((a, i) => {
        const path = `actions[${i}]`;
        if (!isObj(a)) return c.err(path, "must be an object");
        c.unknownKeys(a, ["key", "title", "detail", "priority", "track", "due_hint", "item_key"], path);
        const key = c.key(a, "key", path);
        const title = c.str(a, "title", path, 1, 160, true);
        const detail = c.str(a, "detail", path, 0, 800);
        const priority = c.num(a, "priority", path, 1, 5, true, true);
        const track = c.oneOf(a, "track", path, TRACKS);
        const due_hint = c.str(a, "due_hint", path, 0, 80);
        const item_key = c.key(a, "item_key", path, false);
        c.text(`${path}.title`, title);
        c.text(`${path}.detail`, detail);
        if (key) {
          if (seen.has(key)) c.err(path, `duplicate action ${key}`);
          seen.add(key);
        }
        if (key && title && priority !== undefined) {
          const v: StrategyActionIn = { key, title, priority, track: track ?? "general" };
          if (detail !== undefined) v.detail = detail;
          if (due_hint !== undefined) v.due_hint = due_hint;
          if (item_key !== undefined) v.item_key = item_key;
          actions!.push(v);
        }
      });
    }
  }

  let remove_keys: StrategyRemoveIn[] | undefined;
  if (raw.remove_keys !== undefined && raw.remove_keys !== null) {
    if (!Array.isArray(raw.remove_keys)) c.err("remove_keys", "must be an array");
    else if (raw.remove_keys.length > MAX_REMOVALS) c.err("remove_keys", `at most ${MAX_REMOVALS}`);
    else {
      remove_keys = [];
      raw.remove_keys.forEach((r, i) => {
        const path = `remove_keys[${i}]`;
        if (!isObj(r)) return c.err(path, "must be an object");
        c.unknownKeys(r, ["kind", "section", "key"], path);
        const kind = c.oneOf(r, "kind", path, ["item", "action"] as const, true);
        const section = c.oneOf(r, "section", path, SECTIONS, kind === "item");
        const key = c.key(r, "key", path);
        if (kind && key) {
          const v: StrategyRemoveIn = { kind, key };
          if (section) v.section = section;
          remove_keys!.push(v);
        }
      });
    }
  }

  const hasProfile = !!profile && Object.keys(profile).length > 0;
  if (!hasProfile && summary === undefined && !items?.length && !actions?.length && !remove_keys?.length && c.errors.length === 0) {
    c.err("payload", "must change at least one of profile, summary, items, actions, remove_keys");
  }
  if (c.errors.length || change_reason === undefined) return { ok: false, errors: c.errors.length ? c.errors : ["invalid"] };

  const value: StrategyUpdate = { change_reason };
  if (hasProfile) value.profile = profile;
  if (summary !== undefined) value.summary = summary;
  if (items?.length) value.items = items;
  if (actions?.length) value.actions = actions;
  if (remove_keys?.length) value.remove_keys = remove_keys;
  return { ok: true, value };
}

export interface ProfileSnapshot {
  primary_goal?: string | null;
  time_horizon_years?: number | null;
  risk_tolerance?: string | null;
}

/**
 * Beginner completeness: items and actions need primary_goal plus at least ONE of horizon or risk (after merging
 * the payload into the existing profile). Profile-only updates are always allowed during the interview.
 * Returns an error string, or null when fine.
 */
export function checkCompleteness(existing: ProfileSnapshot | null | undefined, update: StrategyUpdate): string | null {
  if (!update.items?.length && !update.actions?.length) return null;
  const goal = update.profile?.primary_goal ?? existing?.primary_goal;
  const horizon = update.profile?.time_horizon_years ?? existing?.time_horizon_years;
  const risk = update.profile?.risk_tolerance ?? existing?.risk_tolerance;
  if (!goal) return "profile incomplete: primary_goal is required before items or actions";
  if (horizon == null && !risk) return "profile incomplete: need a time horizon or a risk comfort level before items or actions";
  return null;
}

// ── OpenAI strict tool schema (all properties required; optional ones are nullable) ─────────────
const nullable = (t: Record<string, unknown>) => ({ ...t, type: [t.type as string, "null"] });
const str = (max: number) => ({ type: "string", maxLength: max });

export const STRATEGY_UPDATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["change_reason", "profile", "summary", "items", "actions", "remove_keys"],
  properties: {
    change_reason: str(300),
    profile: {
      type: ["object", "null"],
      additionalProperties: false,
      required: [...PROFILE_KEYS],
      properties: {
        primary_goal: nullable(str(300)),
        time_horizon_years: { type: ["integer", "null"], minimum: 1, maximum: 60 },
        risk_tolerance: { type: ["string", "null"], enum: [...RISKS, null] },
        age: { type: ["integer", "null"], minimum: 16, maximum: 110 },
        annual_income: { type: ["number", "null"], minimum: 0 },
        monthly_savings: { type: ["number", "null"], minimum: 0 },
        net_worth_estimate: { type: ["number", "null"], minimum: 0 },
        notes: nullable(str(1000)),
        monthly_income: { type: ["number", "null"], minimum: 0 },
        income_sources: nullable(str(300)),
        emergency_fund_months: { type: ["number", "null"], minimum: 0, maximum: 120 },
        debts_summary: nullable(str(400)),
        existing_accounts: nullable(str(400)),
      },
    },
    summary: nullable(str(1500)),
    items: {
      type: ["array", "null"],
      maxItems: MAX_ITEMS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "section", "title", "body", "metrics", "impact"],
        properties: {
          key: { type: "string", pattern: KEY_RE.source },
          section: { type: "string", enum: [...SECTIONS] },
          title: str(160),
          body: str(1200),
          metrics: {
            type: ["object", "null"],
            additionalProperties: false,
            required: ["amount", "target_pct", "monthly_gain_estimate", "effort", "time_to_first_dollar"],
            properties: {
              amount: { type: ["number", "null"] },
              target_pct: { type: ["number", "null"] },
              monthly_gain_estimate: { type: ["number", "null"] },
              effort: { type: ["string", "null"], enum: [...EFFORTS, null] },
              time_to_first_dollar: nullable(str(80)),
            },
          },
          impact: { type: ["integer", "null"], minimum: 1, maximum: 5 },
        },
      },
    },
    actions: {
      type: ["array", "null"],
      maxItems: MAX_ACTIONS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "title", "detail", "priority", "track", "due_hint", "item_key"],
        properties: {
          key: { type: "string", pattern: KEY_RE.source },
          title: str(160),
          detail: nullable(str(800)),
          priority: { type: "integer", minimum: 1, maximum: 5 },
          track: { type: ["string", "null"], enum: [...TRACKS, null] },
          due_hint: nullable(str(80)),
          item_key: nullable(str(64)),
        },
      },
    },
    remove_keys: {
      type: ["array", "null"],
      maxItems: MAX_REMOVALS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["kind", "section", "key"],
        properties: {
          kind: { type: "string", enum: ["item", "action"] },
          section: { type: ["string", "null"], enum: [...SECTIONS, null] },
          key: str(64),
        },
      },
    },
  },
} as const;

export const STRATEGY_TOOL = {
  type: "function",
  function: {
    name: "update_strategy",
    description:
      "Record what you learned about the user and/or create or revise their plan. Call with profile only while interviewing. Never include prices, tickers or return forecasts.",
    strict: true,
    parameters: STRATEGY_UPDATE_JSON_SCHEMA,
  },
} as const;
