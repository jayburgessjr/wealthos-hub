-- Income sources and entries, bank accounts, credit scores

-- Enums (simple text columns for flexibility in v0)

-- Income sources
CREATE TABLE IF NOT EXISTS public.income_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'salary',
  expected_amount DECIMAL(12,2),
  frequency TEXT,
  expected_day INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  tax_status TEXT DEFAULT 'taxable',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.income_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Users can view sources in household"
  ON public.income_sources FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can manage their income sources"
  ON public.income_sources FOR ALL
  USING (user_id = auth.uid());

CREATE TRIGGER update_income_sources_updated_at
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

CREATE POLICY IF NOT EXISTS "Users can view entries in household"
  ON public.income_entries FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can manage their income entries"
  ON public.income_entries FOR ALL
  USING (user_id = auth.uid());

CREATE TRIGGER update_income_entries_updated_at
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

CREATE POLICY IF NOT EXISTS "Users can view accounts in household"
  ON public.bank_accounts FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY IF NOT EXISTS "Owners can manage accounts"
  ON public.bank_accounts FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

CREATE TRIGGER update_bank_accounts_updated_at
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

CREATE POLICY IF NOT EXISTS "Users can view credit scores in household"
  ON public.credit_scores FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY IF NOT EXISTS "Users can manage their credit scores"
  ON public.credit_scores FOR ALL
  USING (user_id = auth.uid());

