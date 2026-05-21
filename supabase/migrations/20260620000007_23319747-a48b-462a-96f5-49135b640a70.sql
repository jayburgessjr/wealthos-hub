-- Bills table and policies

-- Create bill_payment_status enum
DO $$ BEGIN
  CREATE TYPE public.bill_payment_status AS ENUM ('unpaid', 'partial', 'paid');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Create bills table
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  frequency TEXT DEFAULT 'monthly',
  is_auto_pay BOOLEAN NOT NULL DEFAULT false,
  payment_status bill_payment_status NOT NULL DEFAULT 'unpaid',
  amount_paid DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  payment_account_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view bills in their household"
  ON public.bills FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Owners can manage bills"
  ON public.bills FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

-- updated_at trigger
CREATE OR REPLACE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Income sources
CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'salary',
  expected_amount DECIMAL(12,2),
  frequency TEXT DEFAULT 'monthly',
  expected_day INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tax_status TEXT DEFAULT 'taxable',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view sources in household"
  ON public.income_sources FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can manage their income sources"
  ON public.income_sources FOR ALL
  USING (user_id = auth.uid());

CREATE OR REPLACE TRIGGER update_income_sources_updated_at
  BEFORE UPDATE ON public.income_sources
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Income entries
CREATE TABLE IF NOT EXISTS public.income_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_id UUID REFERENCES public.income_sources(id) ON DELETE SET NULL,
  source_name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'salary',
  amount DECIMAL(12,2) NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method TEXT,
  tax_status TEXT,
  notes TEXT,
  gross_amount DECIMAL(12,2),
  net_amount DECIMAL(12,2),
  business_expenses DECIMAL(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.income_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view entries in household"
  ON public.income_entries FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can manage their income entries"
  ON public.income_entries FOR ALL
  USING (user_id = auth.uid());

CREATE OR REPLACE TRIGGER update_income_entries_updated_at
  BEFORE UPDATE ON public.income_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Bank accounts
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'checking',
  current_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  calculated_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  last_reconciled DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accounts in household"
  ON public.bank_accounts FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Owners can manage accounts"
  ON public.bank_accounts FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

CREATE OR REPLACE TRIGGER update_bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Credit scores
CREATE TABLE IF NOT EXISTS public.credit_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score BETWEEN 300 AND 850),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  bureau TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view credit scores in household"
  ON public.credit_scores FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Users can manage their credit scores"
  ON public.credit_scores FOR ALL
  USING (user_id = auth.uid());

-- Invitations table
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage invitations"
  ON public.invitations FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'))
  WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));

CREATE POLICY "Invited user can view their invitation"
  ON public.invitations FOR SELECT
  USING (
    email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "Invited user can accept invitation"
  ON public.invitations FOR UPDATE
  USING (
    status = 'pending' AND email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

-- Owners can update profiles in their household
DO $$ BEGIN
  CREATE POLICY "Owners can manage profiles in their household"
    ON public.profiles FOR UPDATE
    USING (public.has_household_role(auth.uid(), household_id, 'owner'))
    WITH CHECK (
      household_id = public.get_user_household_id(auth.uid()) OR household_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Create household RPC
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

  INSERT INTO public.households (name, monthly_income)
  VALUES (
    COALESCE(NULLIF(name, ''), 'Household'),
    COALESCE(monthly_income, 0)
  )
  RETURNING id INTO hid;

  UPDATE public.profiles
  SET household_id = hid
  WHERE id = uid;

  INSERT INTO public.user_roles (user_id, household_id, role)
  VALUES (uid, hid, 'owner')
  ON CONFLICT (user_id, household_id)
  DO UPDATE SET role = EXCLUDED.role;

  INSERT INTO public.categories (household_id, name, type, monthly_limit, icon)
  VALUES
    (hid, 'Rent', 'fixed', 1500, '🏠'),
    (hid, 'Utilities', 'fixed', 200, '💡'),
    (hid, 'Groceries', 'variable', 600, '🛒'),
    (hid, 'Transportation', 'variable', 300, '🚗');

  RETURN hid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_household(TEXT, NUMERIC) TO authenticated;

-- Ensure INSERTs to categories pass RLS when owner role has been added
DO $$ BEGIN
  CREATE POLICY "Owners can create categories"
    ON public.categories FOR INSERT
    WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add unique constraint for user_roles
DO $$ BEGIN
  ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_household_unique UNIQUE (user_id, household_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;