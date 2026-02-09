
-- Remove the public SELECT on base comments table (exposes PII)
DROP POLICY IF EXISTS "Public can view published comments" ON public.comments;

-- Recreate view as security definer (intentional: hides PII columns from public)
DROP VIEW IF EXISTS public.comments_public;

CREATE VIEW public.comments_public AS
SELECT id, article_id, name, body, created_at, parent_id
FROM public.comments
WHERE is_published = true;

GRANT SELECT ON public.comments_public TO anon, authenticated;
