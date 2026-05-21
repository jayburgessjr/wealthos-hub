-- ============================================
-- VISION ITEMS TABLE
-- ============================================
CREATE TABLE public.vision_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  title TEXT,
  note TEXT,
  tags TEXT[] DEFAULT '{}',
  pinned BOOLEAN NOT NULL DEFAULT false,
  favorite BOOLEAN NOT NULL DEFAULT false,
  order_index INTEGER NOT NULL DEFAULT 0,
  linked_goal_id UUID REFERENCES public.goals(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for vision_items
CREATE INDEX idx_vision_items_household ON public.vision_items(household_id);
CREATE INDEX idx_vision_items_order ON public.vision_items(household_id, pinned DESC, order_index, created_at DESC);
CREATE INDEX idx_vision_items_tags ON public.vision_items USING GIN(tags);

-- Enable RLS
ALTER TABLE public.vision_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vision_items
CREATE POLICY "Users can view vision items in their household"
  ON public.vision_items FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Users can insert vision items in their household"
  ON public.vision_items FOR INSERT
  WITH CHECK (household_id = get_user_household_id(auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can update vision items in their household"
  ON public.vision_items FOR UPDATE
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Owners or creators can delete vision items"
  ON public.vision_items FOR DELETE
  USING (
    user_id = auth.uid() OR 
    has_household_role(auth.uid(), household_id, 'owner')
  );

-- Trigger for updated_at
CREATE TRIGGER update_vision_items_updated_at
  BEFORE UPDATE ON public.vision_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DEBTS TABLE
-- ============================================
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  total_balance NUMERIC NOT NULL DEFAULT 0,
  current_balance NUMERIC NOT NULL DEFAULT 0,
  monthly_payment NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC DEFAULT 0,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  payment_bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  sync_to_bill BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for debts
CREATE INDEX idx_debts_household ON public.debts(household_id);
CREATE INDEX idx_debts_payment_bill_id ON public.debts(payment_bill_id);
CREATE INDEX idx_debts_active ON public.debts(household_id, is_active);

-- Enable RLS
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for debts
CREATE POLICY "Users can view debts in their household"
  ON public.debts FOR SELECT
  USING (household_id = get_user_household_id(auth.uid()));

CREATE POLICY "Owners can insert debts"
  ON public.debts FOR INSERT
  WITH CHECK (has_household_role(auth.uid(), household_id, 'owner'));

CREATE POLICY "Owners can update debts"
  ON public.debts FOR UPDATE
  USING (has_household_role(auth.uid(), household_id, 'owner'));

CREATE POLICY "Owners can delete debts"
  ON public.debts FOR DELETE
  USING (has_household_role(auth.uid(), household_id, 'owner'));

-- Trigger for updated_at
CREATE TRIGGER update_debts_updated_at
  BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- BIDIRECTIONAL SYNC TRIGGERS (Debts <-> Bills)
-- ============================================

-- Sync debt monthly_payment when linked bill amount changes
CREATE OR REPLACE FUNCTION public.sync_debt_from_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    UPDATE public.debts
    SET monthly_payment = NEW.amount,
        updated_at = now()
    WHERE payment_bill_id = NEW.id
      AND sync_to_bill = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_debt_from_bill_trigger
  AFTER UPDATE OF amount ON public.bills
  FOR EACH ROW EXECUTE FUNCTION public.sync_debt_from_bill();

-- Sync bill amount when debt monthly_payment changes
CREATE OR REPLACE FUNCTION public.sync_bill_from_debt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_bill_id IS NOT NULL 
     AND NEW.sync_to_bill = true
     AND OLD.monthly_payment IS DISTINCT FROM NEW.monthly_payment THEN
    UPDATE public.bills
    SET amount = NEW.monthly_payment,
        updated_at = now()
    WHERE id = NEW.payment_bill_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_bill_from_debt_trigger
  AFTER UPDATE OF monthly_payment ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.sync_bill_from_debt();

-- ============================================
-- ENABLE REALTIME FOR NEW TABLES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.vision_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.debts;