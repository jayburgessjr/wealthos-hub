import { describe, expect, it, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/components/AuthProvider', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('@/components/DemoProvider', () => ({ useDemo: () => ({ isDemoMode: true }) }));
import { computeEarnTrack } from '@/lib/earnTrack';
import { summarizePlan } from '@/hooks/useCoachPlan';
import { sandboxPlan } from '@/data/sandboxPlan';
import { computeWealthLadder } from '@/lib/wealthLadder';

const idea = { title: 'Weekend side work', body: 'List one skill', monthlyGain: 150 };

describe('computeEarnTrack', () => {
  it('no plan: prompts to tell the coach about income', () => {
    const t = computeEarnTrack({ incomeItems: [], earnActions: [], planActive: false });
    expect(t.state).toBe('no_plan');
    expect(t.headline).toBe('Tell the coach about your income');
    expect(computeEarnTrack({ incomeItems: [idea], earnActions: [], planActive: false }).state).toBe('no_plan');
    expect(computeEarnTrack({ incomeItems: [], earnActions: [], planActive: true }).state).toBe('no_plan');
  });
  it('ideas: ideas exist, nothing done', () => {
    const t = computeEarnTrack({ incomeItems: [idea], earnActions: [{ title: 'List a skill', status: 'todo' }], planActive: true });
    expect(t.state).toBe('ideas');
    expect(t.next).toEqual({ title: 'List a skill', why: 'List one skill' });
    expect(t.openCount).toBe(1);
    expect(t.doneCount).toBe(0);
  });
  it('ideas without actions still points at the first idea', () => {
    const t = computeEarnTrack({ incomeItems: [idea], earnActions: [], planActive: true });
    expect(t.state).toBe('ideas');
    expect(t.next?.title).toBe('Weekend side work');
  });
  it('in progress: some done, some open; sums illustrative gain', () => {
    const t = computeEarnTrack({
      incomeItems: [idea],
      earnActions: [{ title: 'A', status: 'done', monthlyGain: 100 }, { title: 'B', status: 'todo' }],
      planActive: true,
    });
    expect(t.state).toBe('in_progress');
    expect(t.headline).toBe('1 done, 1 to go');
    expect(t.next?.title).toBe('B');
    expect(t.monthlyGainDone).toBe(100);
  });
  it('done: everything finished; dismissed actions do not count', () => {
    const t = computeEarnTrack({
      incomeItems: [idea],
      earnActions: [{ title: 'A', status: 'done' }, { title: 'X', status: 'dismissed' }],
      planActive: true,
    });
    expect(t.state).toBe('done');
    expect(t.openCount).toBe(0);
    expect(t.doneCount).toBe(1);
  });
});

describe('summarizePlan', () => {
  it('derives the earn track and the top plan move from the plan', () => {
    const s = summarizePlan(sandboxPlan);
    expect(s.active).toBe(true);
    expect(s.topAction?.priority).toBe(1);
    expect(s.planMove?.title).toBe('List your debts with their rates');
    expect(s.earn.state).toBe('ideas');
    expect(s.earn.next?.title).toBe('List one skill you could offer');
  });
  it('no plan means no plan move and the no_plan earn state', () => {
    const s = summarizePlan({ strategy: null, items: [], actions: [] });
    expect(s.planMove).toBeNull();
    expect(s.earn.state).toBe('no_plan');
  });
});

describe('ladder logic is untouched', () => {
  it('still returns the seven stages', () => {
    expect(computeWealthLadder({ onboarding: null, hasHousehold: false, cashBalance: 0, debts: [], debtsKnown: false, emergencyMonths: null, investedAmount: 0 }).stages).toHaveLength(7);
  });
});
