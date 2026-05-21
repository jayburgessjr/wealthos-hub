-- Add sync_to_bill column to debts for keeping payment and bill amount aligned
ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS sync_to_bill BOOLEAN NOT NULL DEFAULT true;

