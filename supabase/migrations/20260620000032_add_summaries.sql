-- Create weekly_summaries table
CREATE TABLE IF NOT EXISTS public.weekly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    week_start_date DATE NOT NULL,
    notes TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create monthly_summaries table
CREATE TABLE IF NOT EXISTS public.monthly_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
    month TEXT NOT NULL, -- Format: YYYY-MM
    notes TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.weekly_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_summaries ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for weekly_summaries
CREATE POLICY "Users can view weekly summaries for their household"
    ON public.weekly_summaries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.household_id = weekly_summaries.household_id
        )
    );

CREATE POLICY "Users can insert weekly summaries for their household"
    ON public.weekly_summaries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.household_id = weekly_summaries.household_id
        )
    );

CREATE POLICY "Users can update weekly summaries for their household"
    ON public.weekly_summaries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.household_id = weekly_summaries.household_id
        )
    );

-- Add RLS policies for monthly_summaries
CREATE POLICY "Users can view monthly summaries for their household"
    ON public.monthly_summaries FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.household_id = monthly_summaries.household_id
        )
    );

CREATE POLICY "Users can insert monthly summaries for their household"
    ON public.monthly_summaries FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.household_id = monthly_summaries.household_id
        )
    );

CREATE POLICY "Users can update monthly summaries for their household"
    ON public.monthly_summaries FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.household_id = monthly_summaries.household_id
        )
    );

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_weekly_summaries_updated_at
    BEFORE UPDATE ON public.weekly_summaries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_monthly_summaries_updated_at
    BEFORE UPDATE ON public.monthly_summaries
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();
