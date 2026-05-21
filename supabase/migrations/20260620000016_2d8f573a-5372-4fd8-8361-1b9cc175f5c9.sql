-- Add linked_bill_id and linked_subscription_id to expenses table
-- This allows expenses to be linked to recurring bills or subscriptions

ALTER TABLE public.expenses
ADD COLUMN IF NOT EXISTS linked_bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS linked_subscription_id uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL;

-- Add indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_expenses_linked_bill ON public.expenses(linked_bill_id) WHERE linked_bill_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_linked_subscription ON public.expenses(linked_subscription_id) WHERE linked_subscription_id IS NOT NULL;