-- Add notes column to households table for saving copilot plans
ALTER TABLE public.households ADD COLUMN notes TEXT;

-- Update RLS - owners can already update their household, so no new policies needed