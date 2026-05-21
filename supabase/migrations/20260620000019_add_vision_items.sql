-- Vision items table for household vision board
DO $$ BEGIN CREATE EXTENSION IF NOT EXISTS pgcrypto; EXCEPTION WHEN OTHERS THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.vision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  title TEXT,
  note TEXT,
  tags TEXT[] NOT NULL DEFAULT '{}',
  pinned BOOLEAN NOT NULL DEFAULT false,
  favorite BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  linked_goal_id UUID NULL REFERENCES public.goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.vision_items ENABLE ROW LEVEL SECURITY;

-- Selection policy: any household member can read
DO $$ BEGIN
  CREATE POLICY "Vision select in household"
    ON public.vision_items FOR SELECT
    USING (household_id = public.get_user_household_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Insert/update: user must be in household; for insert user_id must be auth.uid()
DO $$ BEGIN
  CREATE POLICY "Vision insert by member"
    ON public.vision_items FOR INSERT
    WITH CHECK (
      household_id = public.get_user_household_id(auth.uid())
      AND user_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Vision update by member"
    ON public.vision_items FOR UPDATE
    USING (household_id = public.get_user_household_id(auth.uid()))
    WITH CHECK (household_id = public.get_user_household_id(auth.uid()));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Delete: owner or creator can delete
DO $$ BEGIN
  CREATE POLICY "Vision delete by owner or self"
    ON public.vision_items FOR DELETE
    USING (
      public.has_household_role(auth.uid(), household_id, 'owner') OR user_id = auth.uid()
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- updated_at trigger
CREATE TRIGGER update_vision_items_updated_at
  BEFORE UPDATE ON public.vision_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX IF NOT EXISTS vision_items_household_idx ON public.vision_items (household_id);
CREATE INDEX IF NOT EXISTS vision_items_household_sort_idx ON public.vision_items (household_id, pinned DESC, order_index ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS vision_items_tags_gin ON public.vision_items USING GIN (tags);

