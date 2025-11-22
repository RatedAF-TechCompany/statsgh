-- Fix 1: Restrict profiles table access to prevent email harvesting
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policy: users can only view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Create a public view for author information (without emails)
CREATE OR REPLACE VIEW public.author_profiles AS
SELECT 
  id,
  full_name,
  created_at
FROM public.profiles;

-- Grant access to the view
GRANT SELECT ON public.author_profiles TO authenticated, anon;