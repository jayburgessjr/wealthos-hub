-- Add budget threshold columns to households table
ALTER TABLE public.households
ADD COLUMN IF NOT EXISTS expected_monthly_income numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS subscription_budget numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS bills_budget numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS expenses_budget numeric NOT NULL DEFAULT 0;