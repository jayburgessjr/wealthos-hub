-- Add is_auto_pay to subscriptions table
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_auto_pay boolean NOT NULL DEFAULT false;