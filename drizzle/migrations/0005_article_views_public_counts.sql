GRANT INSERT ON public.article_views TO anon, authenticated;
GRANT SELECT (id, article_id, viewed_at) ON public.article_views TO anon;
GRANT SELECT ON public.article_views TO authenticated;
GRANT ALL ON public.article_views TO service_role;
DROP POLICY IF EXISTS "Public can read view counts" ON public.article_views;
CREATE POLICY "Public can read view counts" ON public.article_views FOR SELECT TO anon USING (true);