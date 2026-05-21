-- Add household_id to AJE's existing profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_household_id ON public.profiles(household_id);
