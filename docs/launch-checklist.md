# AJE Launch Checklist

Pre-launch verification steps that live outside the codebase. Generated from the 2026-05-23 security audit. Apply each in the Supabase / Netlify / Sentry dashboards.

---

## 1. Supabase Auth rate limits

Dashboard → Project `magpawmyuqyzgczewxsl` → Authentication → Rate Limits.

The free-tier defaults are tuned for early development, not for a 1000-user launch. Verify and tighten each of these before opening signups:

- [ ] **Email signups per hour, per IP** — default 30/hour. At launch, drop to **10/hour per IP** to slow signup spam. Raise back if legitimate traffic gets throttled.
- [ ] **Email OTP / magic links per hour, per IP** — default 4/hour. Keep at **4/hour**; this is the right ceiling for password recovery.
- [ ] **Password reset emails per hour, per email address** — default 4/hour. Keep at **4/hour**.
- [ ] **SMS OTP per hour, per phone** (if SMS auth ever enabled) — default 4/hour. Keep at **4/hour**.
- [ ] **Token refresh per 5 minutes, per user** — default 1800. Lower to **600** unless you have multi-device session reasons to keep high.
- [ ] **Anonymous sign-ins per hour, per IP** — default 30/hour. If anonymous auth isn't used, set to **0** to disable entirely.

Document the chosen values here once applied so they're recoverable after a project restore.

---

## 1b. Supabase Auth — leaked password protection

Dashboard → Authentication → Policies → Password Strength.

The live advisor reported this is currently **disabled**. There is no SQL toggle.

- [ ] Enable **Check for leaked passwords** (HaveIBeenPwned integration). Free, no downstream cost.
- [ ] Set minimum password length to **10** if not already.
- [ ] Set character requirements (upper / lower / digit / symbol) to whatever the brand allows.

## 2. Supabase Auth — session & token policy

Dashboard → Authentication → Sessions.

- [ ] **JWT expiry** — set to **3600 seconds (1 hour)**. Default is 3600; verify it has not been raised.
- [ ] **Refresh token rotation** — must be **enabled**.
- [ ] **Refresh token reuse interval** — set to **10 seconds**.
- [ ] **Inactivity timeout** — set to **7 days**. Forces re-auth on long-idle clients.

---

## 3. Supabase Auth — providers

Dashboard → Authentication → Providers.

- [ ] Disable any provider you do not actively use (Google, GitHub, Apple, etc.). Disabled providers can't be exploited.
- [ ] **Site URL** matches the production domain exactly. No localhost / Netlify preview URLs left over.
- [ ] **Redirect URLs** — only the production domain + any auth-callback paths. Remove dev-only entries.
- [ ] **Email confirmations** — must be **required**.

---

## 4. Supabase Storage

Dashboard → Storage.

- [ ] Every bucket has a deliberate public/private setting. Default to **private** unless the asset is public marketing material.
- [ ] Each non-public bucket has an RLS policy keyed on `auth.uid()`.
- [ ] File size limits set per bucket (default unlimited is a DOS risk).

---

## 5. Apply the RLS hardening migration

The audit produced `supabase/migrations/20260523120000_harden_rls_defense_in_depth.sql`. It is checked in but not yet applied. The migration has 8 sections covering 19 advisor findings + 124 `auth_rls_initplan` rewrites + dedupe on 4 heavy tables.

**Strongly recommend applying to a Supabase branch first.**

- [ ] In the Supabase dashboard, create a new branch from production.
- [ ] `supabase db push --linked` against the branch.
- [ ] Re-run `mcp__supabase__get_advisors` for type=security on the branch. Confirm the ERROR-level `security_definer_view` finding clears and the 7 `function_search_path_mutable` warnings clear. The 3 `signals service_role` always-true warnings will remain — they are intentional.
- [ ] Re-run advisors for type=performance. Confirm `auth_rls_initplan` drops from 124 → 0 and `multiple_permissive_policies` drops on debts/bill_payments/categories/goals.
- [ ] Smoke-test the branch: log in, create a household, view dashboard, edit a debt, delete a goal. Confirm no `permission denied for table` or `function does not exist` errors.
- [ ] Merge the branch into production via the Supabase dashboard branching UI.
- [ ] After merge, re-run advisors against production to confirm the same delta.

**If you must apply directly to production** (no branch):

- [ ] Take a backup snapshot first (Dashboard → Backups → Create snapshot).
- [ ] `supabase db push` against the production project.
- [ ] Same smoke tests as above.

---

## 6. Sentry

`@sentry/react` is wired but disabled in production until the DSN is set.

- [ ] Create a Sentry project (React, browser SDK).
- [ ] Add `VITE_SENTRY_DSN=...` to **Netlify env vars** (not committed `.env`).
- [ ] Trigger a test error in production after deploy and confirm it lands in Sentry.
- [ ] Configure Sentry alert rules — at minimum, page on any new-issue burst above 10 events/min.

---

## 7. Netlify / hosting

- [ ] HSTS header enabled (Netlify → Site config → Headers).
- [ ] Content-Security-Policy reviewed (especially `connect-src` for Supabase + Sentry domains).
- [ ] Branch deploys excluded from search engines (`robots` header on preview contexts).
- [ ] Environment variables match `.env.example` keys and contain real values for production.

---

## 8. Git history (after this audit)

The previous `.env` content (only public VITE\_\* values) is still in git history. No real secret leaks, but worth scrubbing as habit before launch.

- [ ] After all teams confirm no local branches depend on the old file path, run BFG / `git filter-repo` to remove `.env` from history.
- [ ] Force-push (single coordinated push) and instruct anyone with a clone to re-clone.

---

## 9. Post-launch monitoring (week 1)

- [ ] Watch Supabase advisors panel daily for new findings (especially after each migration).
- [ ] Watch Sentry for new-issue spikes during peak traffic.
- [ ] Watch Supabase Auth rate-limit hit counts to know which throttles are actually firing — tune up or down accordingly.

---

## 10. Deferred work (not blockers, schedule after launch)

These items showed up in the live advisor but are explicitly **not** in the pending migration. Track separately:

- [ ] **54 unindexed foreign keys** (advisor INFO). Heaviest: `debts`, `expenses`, `bill_payments`, `bills`, `idea_comments`. Add covering indexes when production query stats show real-world hot paths.
- [ ] **39 unused indexes** (advisor INFO). Heaviest: `expenses`, `tasks`, `trade_ideas`. Review for removal after ~4 weeks of production stats.
- [ ] **Remaining `multiple_permissive_policies`** beyond the 4 heavy tables fixed in the migration (~110 findings on lighter tables). Worth a structural pass, not a launch blocker.
- [ ] **Vite 8 upgrade** to clear the last 2 `npm audit` findings (esbuild dev-server-only). Breaking change, requires testing.
- [ ] **History scrub** of the previous `.env` commit — only contained public VITE\_\* values but worth removing for hygiene.
