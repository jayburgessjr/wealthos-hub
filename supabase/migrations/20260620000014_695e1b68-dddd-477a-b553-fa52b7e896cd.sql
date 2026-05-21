-- Enable REPLICA IDENTITY FULL for real-time updates
ALTER TABLE public.expenses REPLICA IDENTITY FULL;
ALTER TABLE public.income_entries REPLICA IDENTITY FULL;
ALTER TABLE public.bills REPLICA IDENTITY FULL;
ALTER TABLE public.subscriptions REPLICA IDENTITY FULL;
ALTER TABLE public.categories REPLICA IDENTITY FULL;
ALTER TABLE public.goals REPLICA IDENTITY FULL;
ALTER TABLE public.bank_accounts REPLICA IDENTITY FULL;
ALTER TABLE public.credit_scores REPLICA IDENTITY FULL;
ALTER TABLE public.income_sources REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.income_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bills;
ALTER PUBLICATION supabase_realtime ADD TABLE public.subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
ALTER PUBLICATION supabase_realtime ADD TABLE public.goals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.bank_accounts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.credit_scores;
ALTER PUBLICATION supabase_realtime ADD TABLE public.income_sources;