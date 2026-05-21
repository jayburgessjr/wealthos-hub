-- Allow members to create debts in their household
CREATE POLICY "Members can insert debts in their household"
ON public.debts
FOR INSERT
WITH CHECK (household_id = get_user_household_id(auth.uid()));

-- Allow members to create goals in their household
CREATE POLICY "Members can insert goals in their household"
ON public.goals
FOR INSERT
WITH CHECK (household_id = get_user_household_id(auth.uid()));

-- Allow members to create subscriptions in their household
CREATE POLICY "Members can insert subscriptions in their household"
ON public.subscriptions
FOR INSERT
WITH CHECK (household_id = get_user_household_id(auth.uid()));