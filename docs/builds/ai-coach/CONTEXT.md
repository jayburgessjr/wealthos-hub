# CONTEXT: AI Coach (build packet)

Objective: AI coach as the front door: interview from $1, personal plan (wealth, invest, income, opportunities, gaps, prioritized actions), earn-more ladder track, beginner-safe, never promises returns, not a registered adviser.
Authority: `ARCHITECTURE.md` (frozen). `PRIOR_DESIGN.md` is background only.
Scope built (branch feat/ai-coach): migration `supabase/migrations/20261112000000_ai_coach.sql`; `supabase/functions/_shared/strategy/{validate,stream,context,prompt}.ts`; `supabase/functions/ai-advisor/{coach,modes,handler}.ts` (+ `MAX_TOKENS.coach`, `pro` flag in `_shared/validate.ts`); `src/lib/{coachTypes,coachDb,earnTrack,streamInvoke}.ts`; `src/hooks/{useCoachPlan,useCoachChat}.ts`; `src/components/coach/*`; `src/data/sandboxPlan.ts`; FinancialAdvisor (Coach), HomeDashboard, WealthDashboard, WealthPanel, InvestPanel, NextBestMove, WealthLadder, App (`/coach` alias).
Out of scope (separate later PR): household AI repoint (`householdAiService.ts`, `household-budget` mode, household pages).
Non-negotiables: user JWT client only (no service role), RLS default deny on `user_id = auth.uid()`, invoker RPCs, zero writes on malformed model output, SSE chunk shape unchanged, demo path makes zero DB or network calls, no em dashes in copy, single accent (`primary`), `types.ts` never hand-edited.
Tests: `src/test/coach/*` (validate, stream, handler, prompts, earnTrack, ui, home), `src/test/coach-db/*` (pglite, loads real migration).
