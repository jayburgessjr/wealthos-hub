-- Fix the security definer view by setting it to security invoker
ALTER VIEW public.monthly_financial_summary SET (security_invoker = true);