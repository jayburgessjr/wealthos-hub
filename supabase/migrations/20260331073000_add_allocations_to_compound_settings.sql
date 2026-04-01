-- Add allocations column to compound_settings if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='compound_settings' AND column_name='allocations') THEN
    ALTER TABLE public.compound_settings ADD COLUMN allocations jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;
