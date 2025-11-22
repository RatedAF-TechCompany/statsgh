-- Fix Security Definer View issue
-- The author_profiles view was created with default SECURITY INVOKER
-- Drop and recreate as regular view without security definer
DROP VIEW IF EXISTS public.author_profiles;

CREATE VIEW public.author_profiles AS
SELECT 
  id,
  full_name,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.author_profiles TO authenticated, anon;