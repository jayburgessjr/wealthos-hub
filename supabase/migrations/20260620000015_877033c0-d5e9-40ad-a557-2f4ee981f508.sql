-- Add is_active column to bills table for historical tracking
-- When is_active = false, the bill won't roll over to future months but stays for history

ALTER TABLE public.bills 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Add index for filtering active bills
CREATE INDEX IF NOT EXISTS idx_bills_is_active ON public.bills(is_active);