// @vitest-environment node
/* eslint-disable @typescript-eslint/no-explicit-any -- tests mutate loosely typed payloads on purpose */
import { describe, expect, it } from 'vitest';
import { checkCompleteness, validateStrategyUpdate, STRATEGY_TOOL, STRATEGY_UPDATE_JSON_SCHEMA } from '../../../supabase/functions/_shared/strategy/validate';

const full = () => ({
  change_reason: 'first plan',
  profile: { primary_goal: 'Build savings', risk_tolerance: 'conservative', monthly_income: 2000, emergency_fund_months: 0 },
  summary: 'A starter plan.',
  items: [
    { key: 'cushion', section: 'wealth', title: 'Starter cushion', body: 'Save $500', metrics: { amount: 500 }, impact: 4 },
    { key: 'side-gig', section: 'income', title: 'Weekend side work', body: 'First step: list one skill', metrics: { monthly_gain_estimate: 150, effort: 'low', time_to_first_dollar: '2 weeks' }, impact: 3 },
  ],
  actions: [{ key: 'open-sav', title: 'Open a savings account', priority: 1, track: 'earn', item_key: 'cushion' }],
  remove_keys: [{ kind: 'item', section: 'gap', key: 'old' }],
});

const bad = (mut: (p: any) => void) => {
  const p: any = full();
  mut(p);
  return validateStrategyUpdate(p);
};

describe('validateStrategyUpdate', () => {
  it('accepts a full payload and defaults track to general', () => {
    const r = validateStrategyUpdate(full());
    expect(r.ok).toBe(true);
    const r2 = bad((p) => delete p.actions[0].track);
    expect(r2.ok && r2.value.actions![0].track).toBe('general');
  });

  it('treats null optionals (strict tool schema) as absent', () => {
    const r = validateStrategyUpdate({ change_reason: 'x', profile: null, summary: 'hi', items: null, actions: null, remove_keys: null });
    expect(r.ok).toBe(true);
  });

  it.each(['user_id', 'status', 'source', 'edited_by_user'])('rejects unknown top-level key %s', (k) => {
    expect(bad((p) => (p[k] = 'x')).ok).toBe(false);
  });

  it('rejects forbidden keys inside items, actions and profile', () => {
    expect(bad((p) => (p.items[0].source = 'user')).ok).toBe(false);
    expect(bad((p) => (p.actions[0].status = 'done')).ok).toBe(false);
    expect(bad((p) => (p.profile.user_id = 'x')).ok).toBe(false);
  });

  it('rejects bad enums', () => {
    expect(bad((p) => (p.items[0].section = 'bogus')).ok).toBe(false);
    expect(bad((p) => (p.actions[0].track = 'bogus')).ok).toBe(false);
    expect(bad((p) => (p.profile.risk_tolerance = 'yolo')).ok).toBe(false);
  });

  it('rejects out of range numbers', () => {
    expect(bad((p) => (p.actions[0].priority = 0)).ok).toBe(false);
    expect(bad((p) => (p.actions[0].priority = 6)).ok).toBe(false);
    expect(bad((p) => (p.profile.emergency_fund_months = 121)).ok).toBe(false);
    expect(bad((p) => (p.profile.age = 10)).ok).toBe(false);
    expect(bad((p) => (p.items[0].impact = 9)).ok).toBe(false);
  });

  it('rejects oversize arrays', () => {
    expect(bad((p) => (p.items = Array.from({ length: 31 }, (_, i) => ({ key: `k${i}`, section: 'gap', title: 't' })))).ok).toBe(false);
    expect(bad((p) => (p.actions = Array.from({ length: 21 }, (_, i) => ({ key: `k${i}`, title: 't', priority: 1 })))).ok).toBe(false);
    expect(bad((p) => (p.remove_keys = Array.from({ length: 21 }, (_, i) => ({ kind: 'action', key: `k${i}` })))).ok).toBe(false);
  });

  it('rejects duplicate keys and bad key regex', () => {
    expect(bad((p) => p.items.push({ ...p.items[0] })).ok).toBe(false);
    expect(bad((p) => p.actions.push({ ...p.actions[0] })).ok).toBe(false);
    expect(bad((p) => (p.items[0].key = 'Bad Key')).ok).toBe(false);
    expect(bad((p) => (p.actions[0].item_key = '-x')).ok).toBe(false);
  });

  it('rejects empty and non-object payloads', () => {
    expect(validateStrategyUpdate({ change_reason: 'x' }).ok).toBe(false);
    for (const v of [null, 'str', 4, [], undefined]) expect(validateStrategyUpdate(v).ok).toBe(false);
    expect(validateStrategyUpdate({ summary: 'no reason' }).ok).toBe(false);
  });

  it('income items need a body (first step)', () => {
    expect(bad((p) => (p.items[1].body = '')).ok).toBe(false);
    expect(bad((p) => delete p.items[1].body).ok).toBe(false);
    expect(bad((p) => (p.items[0].body = '')).ok).toBe(true);
  });

  it('validates income metrics', () => {
    expect(bad((p) => (p.items[1].metrics.effort = 'extreme')).ok).toBe(false);
    expect(bad((p) => (p.items[1].metrics.monthly_gain_estimate = 'lots')).ok).toBe(false);
  });

  it('deny-list rejects guaranteed-return language anywhere in text fields', () => {
    expect(bad((p) => (p.items[0].body = 'This is a guaranteed 10% return')).ok).toBe(false);
    expect(bad((p) => (p.items[0].title = 'Risk-free growth')).ok).toBe(false);
    expect(bad((p) => (p.summary = "you can't lose")).ok).toBe(false);
    expect(bad((p) => (p.actions[0].detail = 'double your money fast')).ok).toBe(false);
    expect(bad((p) => (p.items[0].body = 'Returns are not guaranteed')).ok).toBe(true);
  });

  it('rejects price, ticker and return-forecast metrics', () => {
    for (const k of ['ticker', 'entry_price', 'target_price', 'expected_return_pct', 'expected_return']) {
      expect(bad((p) => (p.items[0].metrics = { [k]: 5 })).ok).toBe(false);
    }
  });

  it('exposes one strict tool definition', () => {
    expect(STRATEGY_TOOL.function.name).toBe('update_strategy');
    expect(STRATEGY_TOOL.function.strict).toBe(true);
    expect(STRATEGY_UPDATE_JSON_SCHEMA.properties.items.items.properties.section.enum).toContain('income');
    expect(STRATEGY_UPDATE_JSON_SCHEMA.properties.actions.items.properties.track.enum).toContain('earn');
  });
});

describe('checkCompleteness (beginner rule)', () => {
  const mk = (profile: any, extra: any = {}) => {
    const r = validateStrategyUpdate({ change_reason: 'x', profile, items: [{ key: 'a', section: 'gap', title: 't' }], ...extra });
    if (!r.ok) throw new Error(r.errors.join());
    return r.value;
  };
  it('goal plus risk is enough', () => expect(checkCompleteness(null, mk({ primary_goal: 'g', risk_tolerance: 'moderate' }))).toBeNull());
  it('goal plus horizon is enough', () => expect(checkCompleteness(null, mk({ primary_goal: 'g', time_horizon_years: 5 }))).toBeNull());
  it('goal alone rejects items', () => expect(checkCompleteness(null, mk({ primary_goal: 'g' }))).toMatch(/incomplete/));
  it('merges with the existing profile', () => expect(checkCompleteness({ primary_goal: 'g', risk_tolerance: 'moderate' }, mk({ age: 30 }))).toBeNull());
  it('profile-only updates are always fine', () => {
    const r = validateStrategyUpdate({ change_reason: 'x', profile: { age: 30 } });
    expect(r.ok && checkCompleteness(null, r.value)).toBeNull();
  });
});
