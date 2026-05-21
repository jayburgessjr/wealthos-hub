-- Create expense_type enum
CREATE TYPE public.expense_type AS ENUM ('bill_payment', 'subscription', 'general');

-- Add expense_type column to expenses table
ALTER TABLE public.expenses 
ADD COLUMN expense_type public.expense_type NOT NULL DEFAULT 'general';

-- Backfill existing expenses
-- If linked_bill_id is present, it's a bill payment
UPDATE public.expenses 
SET expense_type = 'bill_payment' 
WHERE linked_bill_id IS NOT NULL;

-- If linked_subscription_id is present, it's a subscription
UPDATE public.expenses 
SET expense_type = 'subscription' 
WHERE linked_subscription_id IS NOT NULL;

-- Function to automatically categorize expenses
CREATE OR REPLACE FUNCTION public.categorize_expense()
RETURNS TRIGGER AS $$
BEGIN
  -- If linked_bill_id is provided, set type to bill_payment
  IF NEW.linked_bill_id IS NOT NULL THEN
    NEW.expense_type := 'bill_payment';
  -- If linked_subscription_id is provided, set type to subscription
  ELSIF NEW.linked_subscription_id IS NOT NULL THEN
    NEW.expense_type := 'subscription';
  -- If no type is specified (or it's general) and no links, keep as general.
  -- But if user explicitly sets a type, we should probably respect it? 
  -- The requirement says "auto-tag". 
  -- Let's ensure if it is linked, it forces the type.
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to run before insert or update
CREATE TRIGGER set_expense_type
BEFORE INSERT OR UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.categorize_expense();
