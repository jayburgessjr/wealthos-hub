-- ─────────────────────────────────────────────────────────────────────────
-- Defense-in-depth RLS + SECURITY DEFINER + search_path hardening.
--
-- Generated from the 2026-05-23 live security & performance advisor scan.
-- Addresses these advisor findings:
--   • ERROR  security_definer_view (1) — monthly_financial_summary
--   • WARN   rls_policy_always_true (1) — households "Users can create households"
--   • WARN   function_search_path_mutable (7) — handle_updated_at,
--            categorize_expense, update_holdings_updated_at,
--            fn_sync_debt_payment_from_bill, fn_sync_bill_amount_from_debt,
--            set_task_position, is_admin
--   • WARN   anon_security_definer_function_executable (10) — internal
--            trigger / helper functions exposed via /rest/v1/rpc to anon
--   • WARN   auth_rls_initplan (124) — auth.uid() not wrapped in (select …)
--   • WARN   multiple_permissive_policies — debts/bill_payments/categories/goals
--
-- Apply order matters: dedupe before the bulk rewrite so the rewrite has
-- fewer policies to touch and we don't recreate dropped policies.
-- ─────────────────────────────────────────────────────────────────────────


-- ═════════════════════════════════════════════════════════════════════════
-- Section 1.  Tighten the households INSERT policy.
--   Was: WITH CHECK (true). An anon Postgres role with INSERT grant could
--   create households. Section 2 revokes that grant; this is belt-and-braces.
-- ═════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Users can create households" ON public.households;

CREATE POLICY "Users can create households"
  ON public.households FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);


-- ═════════════════════════════════════════════════════════════════════════
-- Section 2.  Revoke anon grants on the public schema.
--   Every production feature is post-login. Auth flows use the auth schema,
--   not public. If a future feature needs anon read, grant it explicitly.
-- ═════════════════════════════════════════════════════════════════════════

REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES    FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM anon;

-- Re-affirm the standard Supabase grants for the authenticated role.
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO authenticated;


-- ═════════════════════════════════════════════════════════════════════════
-- Section 3.  monthly_financial_summary view → SECURITY INVOKER.
--   Postgres 15+ supports view-level security_invoker. With this set, the
--   underlying tables' RLS policies are evaluated against the querying user,
--   not the view creator. The view definition is unchanged.
-- ═════════════════════════════════════════════════════════════════════════

ALTER VIEW public.monthly_financial_summary SET (security_invoker = true);


-- ═════════════════════════════════════════════════════════════════════════
-- Section 4.  Pin search_path on functions that didn't have it.
--   A SECURITY DEFINER function without a fixed search_path can be hijacked
--   by a malicious schema entry shadowing a referenced object.
-- ═════════════════════════════════════════════════════════════════════════

ALTER FUNCTION public.handle_updated_at()                  SET search_path = public, pg_catalog;
ALTER FUNCTION public.categorize_expense()                 SET search_path = public, pg_catalog;
ALTER FUNCTION public.update_holdings_updated_at()         SET search_path = public, pg_catalog;
ALTER FUNCTION public.fn_sync_debt_payment_from_bill()     SET search_path = public, pg_catalog;
ALTER FUNCTION public.fn_sync_bill_amount_from_debt()      SET search_path = public, pg_catalog;
ALTER FUNCTION public.set_task_position()                  SET search_path = public, pg_catalog;
ALTER FUNCTION public.is_admin()                           SET search_path = public, pg_catalog;


-- ═════════════════════════════════════════════════════════════════════════
-- Section 5.  Revoke EXECUTE on internal-only SECURITY DEFINER functions.
--
--   These are trigger functions or dev helpers that should never be callable
--   via /rest/v1/rpc by any user role. They run on the appropriate trigger
--   path under the table owner's identity. Revoking from PUBLIC and
--   authenticated removes them from the REST surface.
--
--   Functions kept executable by `authenticated` (used in RLS chains or
--   RPC by frontend): create_household, get_user_household_id,
--   has_household_role, is_admin, is_household_member, get_bill_paid_amount,
--   get_bill_status.
-- ═════════════════════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.handle_new_user()                FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_bill_from_goal()            FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_goal_from_bill()            FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_debt_payment_from_bill() FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_sync_bill_amount_from_debt()  FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at()              FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_task_position()              FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_holdings_updated_at()     FROM PUBLIC, authenticated;
REVOKE EXECUTE ON FUNCTION public.categorize_expense()             FROM PUBLIC, authenticated;


-- ═════════════════════════════════════════════════════════════════════════
-- Section 6.  Dedupe multiple_permissive_policies on the four heaviest
-- tables: debts (20 findings), bill_payments / categories / goals (15 each).
--
-- Pattern: keep one policy per (cmd, role). All four tables follow the
-- "members read + insert + update, owners delete" access shape — that's
-- consistent with the existing app behavior (a member-collaborative
-- household-finance model with owner-only destructive actions).
--
-- Policies use (select auth.uid()) to also clear the auth_rls_initplan
-- finding for these tables in the same pass.
-- ═════════════════════════════════════════════════════════════════════════

-- ─────── debts ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "debts_owner"                                  ON public.debts;
DROP POLICY IF EXISTS "Debts insert by owner"                        ON public.debts;
DROP POLICY IF EXISTS "Debts update by owner"                        ON public.debts;
DROP POLICY IF EXISTS "Debts select in household"                    ON public.debts;
DROP POLICY IF EXISTS "Debts delete by owner"                        ON public.debts;
DROP POLICY IF EXISTS "Members can insert debts in their household"  ON public.debts;
DROP POLICY IF EXISTS "Members can update debts in their household"  ON public.debts;

CREATE POLICY "debts_select_member" ON public.debts FOR SELECT TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "debts_insert_member" ON public.debts FOR INSERT TO authenticated
  WITH CHECK (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "debts_update_member" ON public.debts FOR UPDATE TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())))
  WITH CHECK (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "debts_delete_owner" ON public.debts FOR DELETE TO authenticated
  USING (public.has_household_role((select auth.uid()), household_id, 'owner'::public.app_role));


-- ─────── bill_payments ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners can manage bill payments"                       ON public.bill_payments;
DROP POLICY IF EXISTS "Users can view bill payments in their household"       ON public.bill_payments;
DROP POLICY IF EXISTS "Members can insert bill payments in their household"   ON public.bill_payments;
DROP POLICY IF EXISTS "Members can update bill payments in their household"   ON public.bill_payments;

CREATE POLICY "bill_payments_select_member" ON public.bill_payments FOR SELECT TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "bill_payments_insert_member" ON public.bill_payments FOR INSERT TO authenticated
  WITH CHECK (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "bill_payments_update_member" ON public.bill_payments FOR UPDATE TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())))
  WITH CHECK (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "bill_payments_delete_owner" ON public.bill_payments FOR DELETE TO authenticated
  USING (public.has_household_role((select auth.uid()), household_id, 'owner'::public.app_role));


-- ─────── categories ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners can manage categories"                       ON public.categories;
DROP POLICY IF EXISTS "Owners can create categories"                       ON public.categories;
DROP POLICY IF EXISTS "Users can view categories in their household"       ON public.categories;
DROP POLICY IF EXISTS "Members can update categories in their household"   ON public.categories;

CREATE POLICY "categories_select_member" ON public.categories FOR SELECT TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "categories_insert_owner" ON public.categories FOR INSERT TO authenticated
  WITH CHECK (public.has_household_role((select auth.uid()), household_id, 'owner'::public.app_role));

CREATE POLICY "categories_update_member" ON public.categories FOR UPDATE TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())))
  WITH CHECK (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "categories_delete_owner" ON public.categories FOR DELETE TO authenticated
  USING (public.has_household_role((select auth.uid()), household_id, 'owner'::public.app_role));


-- ─────── goals ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Owners can manage goals"                       ON public.goals;
DROP POLICY IF EXISTS "Users can view goals in their household"       ON public.goals;
DROP POLICY IF EXISTS "Members can insert goals in their household"   ON public.goals;
DROP POLICY IF EXISTS "Members can update goals in their household"   ON public.goals;

CREATE POLICY "goals_select_member" ON public.goals FOR SELECT TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "goals_insert_member" ON public.goals FOR INSERT TO authenticated
  WITH CHECK (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "goals_update_member" ON public.goals FOR UPDATE TO authenticated
  USING (household_id = public.get_user_household_id((select auth.uid())))
  WITH CHECK (household_id = public.get_user_household_id((select auth.uid())));

CREATE POLICY "goals_delete_owner" ON public.goals FOR DELETE TO authenticated
  USING (public.has_household_role((select auth.uid()), household_id, 'owner'::public.app_role));


-- ═════════════════════════════════════════════════════════════════════════
-- Section 7.  Rewrite all remaining policies that reference auth.uid(),
-- auth.role(), or auth.jwt() directly. Wrapping in (select …) lets the
-- planner cache the value per query instead of re-evaluating per row.
--
-- This is a dynamic DROP+CREATE loop so every flagged policy is rewritten
-- without enumerating each one. The function reads pg_policies, builds the
-- equivalent CREATE POLICY statement with the auth.<fn>() calls wrapped,
-- and executes it. Policies already deduped in Section 6 are excluded.
-- ═════════════════════════════════════════════════════════════════════════

DO $migration$
DECLARE
  pol         RECORD;
  rewritten_qual  TEXT;
  rewritten_check TEXT;
  roles_clause    TEXT;
  cmd_clause      TEXT;
  using_clause    TEXT;
  check_clause    TEXT;
  full_sql        TEXT;
BEGIN
  FOR pol IN
    SELECT
      p.schemaname,
      p.tablename,
      p.policyname,
      p.cmd,
      p.permissive,
      p.roles,
      p.qual,
      p.with_check
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        COALESCE(p.qual,       '') ~ 'auth\.(uid|jwt|role)\(\)' OR
        COALESCE(p.with_check, '') ~ 'auth\.(uid|jwt|role)\(\)'
      )
      AND NOT (
        COALESCE(p.qual,       '') ~ '\(\s*select\s+auth\.' OR
        COALESCE(p.with_check, '') ~ '\(\s*select\s+auth\.'
      )
  LOOP
    rewritten_qual  := regexp_replace(pol.qual,       'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');
    rewritten_check := regexp_replace(pol.with_check, 'auth\.(uid|jwt|role)\(\)', '(select auth.\1())', 'g');

    -- Build the roles clause. pg_policies.roles is a name[] like {public}.
    SELECT string_agg(quote_ident(r), ', ')
      INTO roles_clause
      FROM unnest(pol.roles) AS r;

    cmd_clause := CASE pol.cmd
                    WHEN 'ALL'    THEN 'ALL'
                    WHEN 'SELECT' THEN 'SELECT'
                    WHEN 'INSERT' THEN 'INSERT'
                    WHEN 'UPDATE' THEN 'UPDATE'
                    WHEN 'DELETE' THEN 'DELETE'
                    ELSE pol.cmd
                  END;

    using_clause := CASE WHEN rewritten_qual  IS NOT NULL THEN ' USING ('      || rewritten_qual  || ')' ELSE '' END;
    check_clause := CASE WHEN rewritten_check IS NOT NULL THEN ' WITH CHECK (' || rewritten_check || ')' ELSE '' END;

    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);

    full_sql := format(
      'CREATE POLICY %I ON %I.%I AS %s FOR %s TO %s%s%s',
      pol.policyname,
      pol.schemaname,
      pol.tablename,
      CASE WHEN pol.permissive = 'PERMISSIVE' THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END,
      cmd_clause,
      roles_clause,
      using_clause,
      check_clause
    );

    EXECUTE full_sql;
  END LOOP;
END
$migration$;


-- ═════════════════════════════════════════════════════════════════════════
-- Section 8.  Out-of-band reminders (not applied via SQL).
--
--   • Enable "Leaked password protection" (HaveIBeenPwned check) in
--     Supabase Dashboard → Authentication → Policies. The advisor flagged
--     this as disabled. There is no SQL toggle.
--
--   • The 54 unindexed FK and 39 unused-index advisor findings are NOT
--     addressed here. They are scale-time hygiene, not security. Defer
--     until post-launch when query stats reflect real production traffic.
-- ═════════════════════════════════════════════════════════════════════════
