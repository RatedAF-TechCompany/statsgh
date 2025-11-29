-- Fix security definer view issue by recreating author_profiles view with SECURITY INVOKER
-- This ensures the view respects RLS policies on the underlying profiles table

DROP VIEW IF EXISTS public.author_profiles;

CREATE VIEW public.author_profiles 
WITH (security_invoker = true) AS
SELECT 
  id,
  full_name,
  created_at
FROM public.profiles;