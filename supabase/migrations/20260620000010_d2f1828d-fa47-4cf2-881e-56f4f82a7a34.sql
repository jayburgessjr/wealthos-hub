-- Subscriptions table and policies (best-in-class)

-- Ensure pgcrypto for gen_random_uuid
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto; EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- Create subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) > 0),
  amount DECIMAL(12,2) NOT NULL CHECK (amount >= 0),
  next_date DATE NOT NULL,
  category_id UUID NULL REFERENCES public.categories(id) ON DELETE SET NULL,
  confirmed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Read: any member of the household may read
DO $$ BEGIN
  CREATE POLICY "Subscriptions select in household"
    ON public.subscriptions FOR SELECT
    USING (household_id = public.get_user_household_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Manage: owners manage by default (principle of least privilege)
DO $$ BEGIN
  CREATE POLICY "Subscriptions insert by owner"
    ON public.subscriptions FOR INSERT
    WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Subscriptions update by owner"
    ON public.subscriptions FOR UPDATE
    USING (public.has_household_role(auth.uid(), household_id, 'owner'))
    WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Subscriptions delete by owner"
    ON public.subscriptions FOR DELETE
    USING (public.has_household_role(auth.uid(), household_id, 'owner'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger (assumes public.update_updated_at_column() exists)
CREATE OR REPLACE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Performance indexes
CREATE INDEX IF NOT EXISTS subscriptions_household_next_date_idx ON public.subscriptions (household_id, next_date);
CREATE INDEX IF NOT EXISTS expenses_household_date_idx ON public.expenses (household_id, date);
CREATE INDEX IF NOT EXISTS income_entries_household_date_idx ON public.income_entries (household_id, date);
CREATE INDEX IF NOT EXISTS bills_household_due_date_idx ON public.bills (household_id, due_date);
CREATE INDEX IF NOT EXISTS credit_scores_household_date_idx ON public.credit_scores (household_id, date DESC);