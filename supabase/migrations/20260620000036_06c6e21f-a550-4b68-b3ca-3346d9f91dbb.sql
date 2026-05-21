-- 1. Create Expense Type Enum
DO $$ BEGIN
  CREATE TYPE public.expense_type AS ENUM (
    'one_off',
    'recurring',
    'bill_payment',
    'subscription'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. Modify Expenses Table
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS expense_type expense_type DEFAULT 'one_off',
  ADD COLUMN IF NOT EXISTS transaction_date DATE DEFAULT CURRENT_DATE,
  ADD COLUMN IF NOT EXISTS posted_date DATE;

-- Add indexes for reporting
CREATE INDEX IF NOT EXISTS idx_expenses_transaction_date ON public.expenses(transaction_date);
CREATE INDEX IF NOT EXISTS idx_expenses_type ON public.expenses(expense_type);
CREATE INDEX IF NOT EXISTS idx_expenses_household_date ON public.expenses(household_id, transaction_date);

-- 3. Create Bill Payments Allocation Table
CREATE TABLE IF NOT EXISTS public.bill_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  expense_id UUID NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL CHECK (amount > 0),
  allocated_at TIMESTAMPTZ DEFAULT NOW(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bill_id, expense_id)
);

ALTER TABLE public.bill_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bill payments in their household"
  ON public.bill_payments FOR SELECT
  USING (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Members can insert bill payments in their household"
  ON public.bill_payments FOR INSERT
  WITH CHECK (household_id = public.get_user_household_id(auth.uid()));

CREATE POLICY "Owners can manage bill payments"
  ON public.bill_payments FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'));

CREATE POLICY "Members can update bill payments in their household"
  ON public.bill_payments FOR UPDATE
  USING (household_id = public.get_user_household_id(auth.uid()));

-- 4. Upgrade Subscriptions
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS next_renewal_date DATE;

-- Update next_renewal_date from existing next_date
UPDATE public.subscriptions 
SET next_renewal_date = next_date 
WHERE next_renewal_date IS NULL AND next_date IS NOT NULL;

-- 5. Create Monthly Financial Summary View
CREATE OR REPLACE VIEW public.monthly_financial_summary AS
WITH monthly_income AS (
  SELECT 
    household_id,
    to_char(date, 'YYYY-MM') as month,
    SUM(amount) as total_income
  FROM public.income_entries
  GROUP BY 1, 2
),
monthly_expenses AS (
  SELECT 
    household_id,
    to_char(COALESCE(transaction_date, date), 'YYYY-MM') as month,
    SUM(amount) as total_expenses,
    SUM(CASE WHEN expense_type = 'bill_payment' THEN amount ELSE 0 END) as fixed_costs,
    SUM(CASE WHEN expense_type = 'one_off' THEN amount ELSE 0 END) as discretionary_spend,
    SUM(CASE WHEN expense_type = 'recurring' THEN amount ELSE 0 END) as recurring_costs,
    SUM(CASE WHEN expense_type = 'subscription' THEN amount ELSE 0 END) as subscription_costs
  FROM public.expenses
  GROUP BY 1, 2
)
SELECT 
  COALESCE(i.household_id, e.household_id) as household_id,
  COALESCE(i.month, e.month) as month,
  COALESCE(i.total_income, 0) as income,
  COALESCE(e.total_expenses, 0) as expenses,
  (COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0)) as net_cash_flow,
  COALESCE(e.fixed_costs, 0) as fixed_costs,
  COALESCE(e.discretionary_spend, 0) as discretionary_spend,
  COALESCE(e.recurring_costs, 0) as recurring_costs,
  COALESCE(e.subscription_costs, 0) as subscription_costs,
  CASE 
    WHEN COALESCE(i.total_income, 0) > 0 
    THEN ROUND((COALESCE(e.total_expenses, 0) / COALESCE(i.total_income, 0)) * 100, 1)
    ELSE 0 
  END as burn_rate_pct
FROM monthly_income i
FULL OUTER JOIN monthly_expenses e ON i.household_id = e.household_id AND i.month = e.month;

-- Grant access to authenticated users (view respects underlying RLS)
GRANT SELECT ON public.monthly_financial_summary TO authenticated;

-- 6. Create helper function to get bill payment totals
CREATE OR REPLACE FUNCTION public.get_bill_paid_amount(bill_uuid UUID)
RETURNS DECIMAL(12,2)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM public.bill_payments
  WHERE bill_id = bill_uuid
$$;

-- 7. Create helper function to calculate bill status
CREATE OR REPLACE FUNCTION public.get_bill_status(bill_uuid UUID)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE 
      WHEN COALESCE(SUM(bp.amount), 0) >= b.amount THEN 'paid'
      WHEN COALESCE(SUM(bp.amount), 0) > 0 THEN 'partial'
      ELSE 'unpaid'
    END
  FROM public.bills b
  LEFT JOIN public.bill_payments bp ON bp.bill_id = b.id
  WHERE b.id = bill_uuid
  GROUP BY b.id, b.amount
$$;