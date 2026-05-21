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
CREATE POLICY IF NOT EXISTS "Users can view bills in their household"
  ON public.bills FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY IF NOT EXISTS "Owners can manage bills"
  ON public.bills FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

-- updated_at trigger
CREATE TRIGGER update_bills_updated_at
  BEFORE UPDATE ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
