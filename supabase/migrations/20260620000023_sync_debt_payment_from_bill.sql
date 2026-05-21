-- Keep debts.monthly_payment and bills.amount aligned when sync_to_bill is enabled
-- Direction 1: When a bill amount changes, push to linked debts
CREATE OR REPLACE FUNCTION public.fn_sync_debt_payment_from_bill()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.amount IS DISTINCT FROM OLD.amount) THEN
    UPDATE public.debts d
    SET monthly_payment = NEW.amount
    WHERE d.payment_bill_id = NEW.id
      AND COALESCE(d.sync_to_bill, true) = true
      AND (d.monthly_payment IS DISTINCT FROM NEW.amount);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_debt_payment_from_bill ON public.bills;
CREATE TRIGGER tr_sync_debt_payment_from_bill
AFTER UPDATE OF amount ON public.bills
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_debt_payment_from_bill();

-- Direction 2: When a debt monthly_payment changes, optionally push to linked bill
CREATE OR REPLACE FUNCTION public.fn_sync_bill_amount_from_debt()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.monthly_payment IS DISTINCT FROM OLD.monthly_payment) THEN
    UPDATE public.bills b
    SET amount = NEW.monthly_payment
    WHERE b.id = NEW.payment_bill_id
      AND NEW.payment_bill_id IS NOT NULL
      AND COALESCE(NEW.sync_to_bill, true) = true
      AND (b.amount IS DISTINCT FROM NEW.monthly_payment);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_sync_bill_amount_from_debt ON public.debts;
CREATE TRIGGER tr_sync_bill_amount_from_debt
AFTER UPDATE OF monthly_payment ON public.debts
FOR EACH ROW
EXECUTE FUNCTION public.fn_sync_bill_amount_from_debt();

