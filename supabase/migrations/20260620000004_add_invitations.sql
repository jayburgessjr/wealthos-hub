-- Invitations table for household member invites

CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | revoked
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Owners can view/manage invites in their household
CREATE POLICY IF NOT EXISTS "Owners can manage invitations"
  ON public.invitations FOR ALL
  USING (public.has_household_role(auth.uid(), household_id, 'owner'))
  WITH CHECK (public.has_household_role(auth.uid(), household_id, 'owner'));

-- Invited user can view their own invitation
CREATE POLICY IF NOT EXISTS "Invited user can view their invitation"
  ON public.invitations FOR SELECT
  USING (
    email IN (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  );

-- Invited user can accept their own invitation
CREATE POLICY IF NOT EXISTS "Invited user can accept invitation"
  ON public.invitations FOR UPDATE
  USING (
    status = 'pending' AND email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
  )
  WITH CHECK (
    email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
  );

