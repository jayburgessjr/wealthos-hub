-- Drop and recreate the monthly_financial_summary view with additional KPIs
DROP VIEW IF EXISTS public.monthly_financial_summary;

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
),
-- Get total monthly debt payments from all active debts (not month-specific, recurring obligation)
total_debt_obligations AS (
  SELECT 
    household_id,
    SUM(monthly_payment) as total_debt_payments
  FROM public.debts
  WHERE is_active = true
  GROUP BY 1
),
household_assets AS (
  SELECT 
    household_id,
    SUM(current_balance) as total_liquid_assets
  FROM public.bank_accounts
  WHERE is_active = true
  GROUP BY 1
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
  -- Burn Rate: expenses / income * 100
  CASE 
    WHEN COALESCE(i.total_income, 0) > 0 
    THEN ROUND((COALESCE(e.total_expenses, 0) / COALESCE(i.total_income, 0)) * 100, 1)
    ELSE 0 
  END as burn_rate_pct,
  -- Savings Rate: (income - expenses) / income * 100
  CASE 
    WHEN COALESCE(i.total_income, 0) > 0 
    THEN ROUND(((COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0)) / COALESCE(i.total_income, 0)) * 100, 1)
    ELSE 0 
  END as savings_rate_pct,
  -- Debt-to-Income Ratio: debt payments / income * 100
  CASE 
    WHEN COALESCE(i.total_income, 0) > 0 
    THEN ROUND((COALESCE(d.total_debt_payments, 0) / COALESCE(i.total_income, 0)) * 100, 1)
    ELSE 0 
  END as dti_ratio_pct,
  -- Monthly debt payments for reference
  COALESCE(d.total_debt_payments, 0) as debt_payments,
  -- Liquid assets (for emergency fund calculation)
  COALESCE(a.total_liquid_assets, 0) as liquid_assets,
  -- Emergency Fund Months: liquid assets / monthly expenses
  CASE 
    WHEN COALESCE(e.total_expenses, 0) > 0 
    THEN ROUND(COALESCE(a.total_liquid_assets, 0) / COALESCE(e.total_expenses, 0), 1)
    ELSE 0 
  END as emergency_fund_months,
  -- Financial Runway: liquid assets / net burn (if negative cash flow)
  CASE 
    WHEN (COALESCE(e.total_expenses, 0) - COALESCE(i.total_income, 0)) > 0 
    THEN ROUND(COALESCE(a.total_liquid_assets, 0) / (COALESCE(e.total_expenses, 0) - COALESCE(i.total_income, 0)), 1)
    ELSE NULL -- NULL means infinite runway (positive or zero cash flow)
  END as runway_months
FROM monthly_income i
FULL OUTER JOIN monthly_expenses e ON i.household_id = e.household_id AND i.month = e.month
LEFT JOIN total_debt_obligations d ON COALESCE(i.household_id, e.household_id) = d.household_id
LEFT JOIN household_assets a ON COALESCE(i.household_id, e.household_id) = a.household_id;

-- Grant access to authenticated users
GRANT SELECT ON public.monthly_financial_summary TO authenticated;