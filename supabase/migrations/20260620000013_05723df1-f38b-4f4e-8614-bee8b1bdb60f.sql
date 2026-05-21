-- Add payment_account_id to expenses table
ALTER TABLE public.expenses 
ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.bank_accounts(id);

-- Add payment_account_id to income_entries table
ALTER TABLE public.income_entries 
ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.bank_accounts(id);

-- Add payment_account_id to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS payment_account_id uuid REFERENCES public.bank_accounts(id);