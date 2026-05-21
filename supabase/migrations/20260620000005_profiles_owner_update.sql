-- Allow owners to update profiles in their household (e.g., remove member)

DO $$ BEGIN
  CREATE POLICY "Owners can manage profiles in their household"
    ON public.profiles FOR UPDATE
    USING (public.has_household_role(auth.uid(), household_id, 'owner'))
    WITH CHECK (
      household_id = public.get_user_household_id(auth.uid()) OR household_id IS NULL
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

