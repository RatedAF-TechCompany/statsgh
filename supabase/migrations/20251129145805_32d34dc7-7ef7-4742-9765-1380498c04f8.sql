-- Add author_id column to articles table to track ownership
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS author_id uuid REFERENCES auth.users(id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_articles_author_id ON public.articles(author_id);

-- Drop existing RLS policies on articles
DROP POLICY IF EXISTS "Admins and Editors can delete articles" ON public.articles;
DROP POLICY IF EXISTS "Admins and Editors can insert articles" ON public.articles;
DROP POLICY IF EXISTS "Admins and Editors can update any article" ON public.articles;
DROP POLICY IF EXISTS "Anyone can view published articles" ON public.articles;
DROP POLICY IF EXISTS "Contributors can update their own drafts" ON public.articles;

-- CREATE NEW RLS POLICIES WITH PROPER ROLE-BASED PERMISSIONS

-- SELECT policies (viewing articles)
CREATE POLICY "Anyone can view published articles"
ON public.articles
FOR SELECT
USING (is_published = true);

CREATE POLICY "Authenticated users can view all articles"
ON public.articles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role) OR 
  has_role(auth.uid(), 'contributor'::app_role) OR
  has_role(auth.uid(), 'viewer'::app_role)
);

-- INSERT policies (creating articles)
CREATE POLICY "Admins and Editors can insert any article"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'editor'::app_role)
);

CREATE POLICY "Contributors can insert their own articles"
ON public.articles
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'contributor'::app_role) AND 
  author_id = auth.uid()
);

-- UPDATE policies (editing articles)
CREATE POLICY "Admins can update any article"
ON public.articles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors can update any article"
ON public.articles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "Contributors can update their own drafts"
ON public.articles
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'contributor'::app_role) AND 
  author_id = auth.uid() AND 
  status = 'draft'
);

-- DELETE policies (deleting articles)
CREATE POLICY "Admins can delete any article"
ON public.articles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Editors can delete any article"
ON public.articles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'editor'::app_role));