-- Add frequency column to subscriptions table
ALTER TABLE public.subscriptions 
ADD COLUMN frequency text NOT NULL DEFAULT 'monthly';

-- Add comment for documentation
COMMENT ON COLUMN public.subscriptions.frequency IS 'Billing frequency: monthly or annual';