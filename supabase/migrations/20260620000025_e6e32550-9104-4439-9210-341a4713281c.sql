-- Allow members to update debts in their household
CREATE POLICY "Members can update debts in their household"
ON public.debts
FOR UPDATE
USING (household_id = get_user_household_id(auth.uid()))
WITH CHECK (household_id = get_user_household_id(auth.uid()));

-- Allow members to update bank accounts in their household
CREATE POLICY "Members can update bank accounts in their household"
ON public.bank_accounts
FOR UPDATE
USING (household_id = get_user_household_id(auth.uid()))
WITH CHECK (household_id = get_user_household_id(auth.uid()));

-- Allow members to update goals in their household
CREATE POLICY "Members can update goals in their household"
ON public.goals
FOR UPDATE
USING (household_id = get_user_household_id(auth.uid()))
WITH CHECK (household_id = get_user_household_id(auth.uid()));

-- Allow members to update subscriptions in their household
CREATE POLICY "Members can update subscriptions in their household"
ON public.subscriptions
FOR UPDATE
USING (household_id = get_user_household_id(auth.uid()))
WITH CHECK (household_id = get_user_household_id(auth.uid()));

-- Allow members to update categories in their household
CREATE POLICY "Members can update categories in their household"
ON public.categories
FOR UPDATE
USING (household_id = get_user_household_id(auth.uid()))
WITH CHECK (household_id = get_user_household_id(auth.uid()));