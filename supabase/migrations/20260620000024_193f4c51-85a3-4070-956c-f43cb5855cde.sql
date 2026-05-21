-- Allow members to update bills in their household
CREATE POLICY "Members can update bills in their household"
ON public.bills
FOR UPDATE
USING (household_id = get_user_household_id(auth.uid()))
WITH CHECK (household_id = get_user_household_id(auth.uid()));