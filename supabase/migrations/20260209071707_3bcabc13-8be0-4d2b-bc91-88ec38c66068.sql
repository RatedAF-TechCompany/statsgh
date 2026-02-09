
-- Fix function search_path mutable for update_comments_updated_at
CREATE OR REPLACE FUNCTION public.update_comments_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.created_at = OLD.created_at; -- Prevent created_at from being updated
  RETURN NEW;
END;
$function$;

-- Fix comments_public view: add SECURITY INVOKER and re-add a safe SELECT policy
-- so the view can still work for anon users
DROP VIEW IF EXISTS public.comments_public;

-- Add back a restricted SELECT policy for anon (only safe to read published comments)
-- The key insight: we still need anon to SELECT from comments for the view to work with security_invoker
DROP POLICY IF EXISTS "Admins can view all comments" ON public.comments;

-- Admin full access
CREATE POLICY "Admins can view all comments" ON public.comments
FOR SELECT USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Anon/public can only see published comments (used by security_invoker view)
CREATE POLICY "Public can view published comments" ON public.comments
FOR SELECT TO anon, authenticated
USING (is_published = true);

-- Recreate view with SECURITY INVOKER (satisfies linter)
CREATE VIEW public.comments_public
WITH (security_invoker = on) AS
SELECT id, article_id, name, body, created_at, parent_id
FROM public.comments
WHERE is_published = true;

GRANT SELECT ON public.comments_public TO anon, authenticated;
