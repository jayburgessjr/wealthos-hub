-- Create email_preferences table
CREATE TABLE public.email_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  daily_email_enabled boolean NOT NULL DEFAULT true,
  email_time time NOT NULL DEFAULT '19:30:00',
  timezone text NOT NULL DEFAULT 'America/New_York',
  weekly_email_enabled boolean NOT NULL DEFAULT false,
  last_daily_email_sent timestamp with time zone,
  last_weekly_email_sent timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view their own email preferences
CREATE POLICY "Users can view their own email preferences"
ON public.email_preferences
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own email preferences
CREATE POLICY "Users can insert their own email preferences"
ON public.email_preferences
FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Users can update their own email preferences
CREATE POLICY "Users can update their own email preferences"
ON public.email_preferences
FOR UPDATE
USING (user_id = auth.uid());

-- Users can delete their own email preferences
CREATE POLICY "Users can delete their own email preferences"
ON public.email_preferences
FOR DELETE
USING (user_id = auth.uid());

-- Create trigger for updated_at
CREATE TRIGGER update_email_preferences_updated_at
BEFORE UPDATE ON public.email_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable pg_cron and pg_net extensions for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;