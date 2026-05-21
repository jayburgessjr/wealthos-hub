-- Add notes column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS notes text;

-- Add notes column to bank_accounts table
ALTER TABLE public.bank_accounts 
ADD COLUMN IF NOT EXISTS notes text;