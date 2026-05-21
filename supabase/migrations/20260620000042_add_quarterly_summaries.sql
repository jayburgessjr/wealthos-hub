CREATE TABLE IF NOT EXISTS public.quarterly_summaries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  period      text NOT NULL,  -- format: 'YYYY-Q1', 'YYYY-Q2', etc.
  notes       text,
  data        jsonb DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(household_id, period)
);

ALTER TABLE public.quarterly_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household_members_select_quarterly" ON public.quarterly_summaries
  FOR SELECT USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "household_members_insert_quarterly" ON public.quarterly_summaries
  FOR INSERT WITH CHECK (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "household_members_update_quarterly" ON public.quarterly_summaries
  FOR UPDATE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "household_members_delete_quarterly" ON public.quarterly_summaries
  FOR DELETE USING (
    household_id IN (
      SELECT household_id FROM public.profiles WHERE id = auth.uid()
    )
  );
