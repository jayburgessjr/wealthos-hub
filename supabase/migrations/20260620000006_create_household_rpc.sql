-- Create a secure RPC to create a household and perform related setup in one call
-- - Inserts new household
-- - Sets caller's profile.household_id
-- - Upserts owner role in user_roles
-- - Seeds a few default categories

CREATE OR REPLACE FUNCTION public.create_household(name TEXT, monthly_income NUMERIC)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid UUID := auth.uid();
  hid UUID;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 1) Create household
  INSERT INTO public.households (name, monthly_income)
  VALUES (
    COALESCE(NULLIF(name, ''), 'Household'),
    COALESCE(monthly_income, 0)
  )
  RETURNING id INTO hid;

  -- 2) Associate the user profile to household
  UPDATE public.profiles
  SET household_id = hid
  WHERE id = uid;

  -- 3) Ensure the caller is the owner for this household
  INSERT INTO public.user_roles (user_id, household_id, role)
  VALUES (uid, hid, 'owner')
  ON CONFLICT (user_id, household_id)
  DO UPDATE SET role = EXCLUDED.role;

  -- 4) Seed default categories (keeps it small; user can edit later)
  INSERT INTO public.categories (household_id, name, type, monthly_limit, icon)
  VALUES
    (hid, 'Rent', 'fixed', 1500, '🏠'),
    (hid, 'Utilities', 'fixed', 200, '💡'),
    (hid, 'Groceries', 'variable', 600, '🛒'),
    (hid, 'Transportation', 'variable', 300, '🚗');

  RETURN hid;
END;
$$;

-- Allow authenticated users (not anon) to call this function
GRANT EXECUTE ON FUNCTION public.create_household(TEXT, NUMERIC) TO authenticated;

-- Ensure INSERTs to categories pass RLS when owner role has been added
DO $$ BEGIN
  CREATE POLICY "Owners can create categories"
    ON public.categories FOR INSERT
    WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

