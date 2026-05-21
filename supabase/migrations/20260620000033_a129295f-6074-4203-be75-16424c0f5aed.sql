-- 1. Create weekly_summaries table
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    notes TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create monthly_summaries table
CREATE TABLE IF NOT EXISTS public.monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    month TEXT NOT NULL,
    notes TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Enable RLS
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;

-- 4. Add RLS policies for weekly_summaries using existing helper function
CREATE POLICY "Users can view weekly summaries for their household"
    ON public.weekly_summaries FOR SELECT
    USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can insert weekly summaries for their household"
    ON public.weekly_summaries FOR INSERT
    WITH CHECK (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can update weekly summaries for their household"
    ON public.weekly_summaries FOR UPDATE
    USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can delete weekly summaries for their household"
    ON public.weekly_summaries FOR DELETE
    USING (household_id = get_user_household_id(auth.uid()));

-- 5. Add RLS policies for monthly_summaries
CREATE POLICY "Users can view monthly summaries for their household"
    ON public.monthly_summaries FOR SELECT
    USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can insert monthly summaries for their household"
    ON public.monthly_summaries FOR INSERT
    WITH CHECK (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can update monthly summaries for their household"
    ON public.monthly_summaries FOR UPDATE
    USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can delete monthly summaries for their household"
    ON public.monthly_summaries FOR DELETE
    USING (household_id = get_user_household_id(auth.uid()));

-- 6. Add updated_at triggers using existing function
CREATE TRIGGER set_weekly_summaries_updated_at
    BEFORE UPDATE ON public.weekly_summaries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_monthly_summaries_updated_at
    BEFORE UPDATE ON public.monthly_summaries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();