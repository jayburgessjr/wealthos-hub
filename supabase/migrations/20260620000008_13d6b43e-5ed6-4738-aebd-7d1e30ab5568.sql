-- Add only the missing foreign key constraint for bills.payment_account_id
-- Other constraints already exist from the types.ts relationships

DO $$
BEGIN
  -- bills.payment_account_id -> bank_accounts.id (if not exists)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'bills_payment_account_id_fkey'
  ) THEN
    ALTER TABLE public.bills 
      ADD CONSTRAINT bills_payment_account_id_fkey 
      FOREIGN KEY (payment_account_id) 
      REFERENCES public.bank_accounts(id) 
      ON DELETE SET NULL;
  END IF;
END
$$;