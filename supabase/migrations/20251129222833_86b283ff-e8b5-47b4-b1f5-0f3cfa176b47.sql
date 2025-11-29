-- Update RLS policy for contributors to allow editing of published articles
DROP POLICY IF EXISTS "Contributors can update their own drafts" ON public.articles;

CREATE POLICY "Contributors can update their own articles"
ON public.articles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'contributor'::app_role) AND
  author_id = auth.uid()
);