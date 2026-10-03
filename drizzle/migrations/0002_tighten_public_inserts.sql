DROP POLICY IF EXISTS "Anyone can insert views" ON public.article_views;
CREATE POLICY "Anyone can insert views" ON public.article_views FOR INSERT TO anon, authenticated
  WITH CHECK (article_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_id AND a.is_published = true));

DROP POLICY IF EXISTS "Anyone can submit" ON public.expert_submissions;
CREATE POLICY "Anyone can submit" ON public.expert_submissions FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'pending' AND reviewed_by IS NULL AND published_article_id IS NULL
    AND length(content) BETWEEN 200 AND 20000 AND length(author_name) BETWEEN 1 AND 200);

DROP POLICY IF EXISTS "Authenticated users can insert audit events" ON public.audit_events;
CREATE POLICY "Users insert own audit events" ON public.audit_events FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());