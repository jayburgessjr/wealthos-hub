-- Add linked_bill_id and image_path to goals table
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS linked_bill_id UUID REFERENCES public.bills(id) ON DELETE SET NULL;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS image_path TEXT;
ALTER TABLE public.goals ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add index for linked_bill_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_goals_linked_bill_id ON public.goals(linked_bill_id);

-- Create bidirectional sync: when goal monthly_contribution changes, update linked bill amount
CREATE OR REPLACE FUNCTION public.sync_bill_from_goal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.linked_bill_id IS NOT NULL 
     AND OLD.monthly_contribution IS DISTINCT FROM NEW.monthly_contribution THEN
    UPDATE public.bills
    SET amount = NEW.monthly_contribution,
        updated_at = now()
    WHERE id = NEW.linked_bill_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_bill_from_goal_trigger ON public.goals;
CREATE TRIGGER sync_bill_from_goal_trigger
  AFTER UPDATE ON public.goals
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_bill_from_goal();

-- Create sync: when linked bill amount changes, update goal monthly_contribution
CREATE OR REPLACE FUNCTION public.sync_goal_from_bill()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.amount IS DISTINCT FROM NEW.amount THEN
    UPDATE public.goals
    SET monthly_contribution = NEW.amount,
        updated_at = now()
    WHERE linked_bill_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_goal_from_bill_trigger ON public.bills;
CREATE TRIGGER sync_goal_from_bill_trigger
  AFTER UPDATE ON public.bills
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_goal_from_bill();