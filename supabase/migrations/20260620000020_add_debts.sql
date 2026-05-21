-- Debts table: track outstanding balances and tie to a monthly payment bill
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  current_balance DECIMAL(12,2) NOT NULL DEFAULT 0,
  monthly_payment DECIMAL(12,2) NOT NULL DEFAULT 0,
  interest_rate NUMERIC(5,3), -- optional APR e.g., 19.99
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_bill_id UUID NULL REFERENCES public.bills(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Debts select in household"
    ON public.debts FOR SELECT
    USING (household_id = public.get_user_household_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Debts insert by owner"
    ON public.debts FOR INSERT
    WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Debts update by owner"
    ON public.debts FOR UPDATE
    USING (public.has_household_role(auth.uid(), household_id, 'owner'))
    WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Debts delete by owner"
    ON public.debts FOR DELETE
    USING (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS debts_household_active_idx ON public.debts (household_id, is_active);

