-- Add optional advanced debt/financial fields to bills table
ALTER TABLE public.bills
ADD COLUMN IF NOT EXISTS credit_limit numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS apr numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS monthly_fees numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS yearly_fees numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS late_fees numeric DEFAULT NULL,
ADD COLUMN IF NOT EXISTS ideal_payment numeric DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.bills.credit_limit IS 'Credit limit for revolving accounts (credit cards, lines of credit)';
COMMENT ON COLUMN public.bills.apr IS 'Annual Percentage Rate as a decimal (e.g., 0.1999 for 19.99%)';
COMMENT ON COLUMN public.bills.monthly_fees IS 'Recurring monthly service or maintenance fees';
COMMENT ON COLUMN public.bills.yearly_fees IS 'Annual fees (amortized monthly in calculations)';
COMMENT ON COLUMN public.bills.late_fees IS 'Typical penalty amount if payment is missed';
COMMENT ON COLUMN public.bills.ideal_payment IS 'User preferred payment amount per month';