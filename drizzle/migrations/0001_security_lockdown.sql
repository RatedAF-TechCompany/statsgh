-- Private tables: remove public reads, admin-only
DROP POLICY IF EXISTS "Anyone can view alerts" ON public.alerts;
DROP POLICY IF EXISTS "Anyone can read bog_scan_items" ON public.bog_scan_items;
DROP POLICY IF EXISTS "Anyone can read bog_scan_runs" ON public.bog_scan_runs;
DROP POLICY IF EXISTS "Anyone can read dashboard_updates" ON public.dashboard_updates;
DROP POLICY IF EXISTS "Anyone can view settings" ON public.site_settings;
DROP POLICY IF EXISTS "Journalists publicly readable" ON public.journalists;
DROP POLICY IF EXISTS "Authenticated users can view their own audit events" ON public.audit_events;

CREATE POLICY "Admins read bog_scan_items" ON public.bog_scan_items FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins read bog_scan_runs" ON public.bog_scan_runs FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins read dashboard_updates" ON public.dashboard_updates FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Admins can manage alerts" ON public.alerts;
CREATE POLICY "Admins can manage alerts" ON public.alerts FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "Admins can manage settings" ON public.site_settings;
CREATE POLICY "Admins can manage settings" ON public.site_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Revoke anon table access on private tables
REVOKE ALL ON public.alerts, public.bog_scan_items, public.bog_scan_runs, public.dashboard_updates, public.site_settings, public.journalists, public.audit_events FROM anon;

-- Public byline lookup without exposing the journalists table
CREATE OR REPLACE FUNCTION public.get_journalist_byline(p_name text)
RETURNS TABLE(byline_name text, specialization text, bio text, photo_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT j.byline_name, j.specialization, j.bio, j.photo_url
  FROM public.journalists j WHERE j.byline_name = p_name AND j.is_active = true LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.get_journalist_byline(text) TO anon, authenticated;

-- article_views: anon insert only, no select
REVOKE ALL ON public.article_views FROM anon;
GRANT INSERT ON public.article_views TO anon;

-- Expert submissions: anon may only insert (public form), never read
REVOKE ALL ON public.expert_submissions FROM anon;
GRANT INSERT ON public.expert_submissions TO anon;

-- Article relations: admin/editor writes, explicit checks
DROP POLICY IF EXISTS "Editors can manage article indicators" ON public.article_indicators;
CREATE POLICY "Editors can manage article indicators" ON public.article_indicators FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
DROP POLICY IF EXISTS "Editors can manage article sources" ON public.article_sources;
CREATE POLICY "Editors can manage article sources" ON public.article_sources FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

-- Media table: admin-only writes tied to owner
DROP POLICY IF EXISTS "Authenticated users can upload media" ON public.media;
DROP POLICY IF EXISTS "Users can update own media" ON public.media;
DROP POLICY IF EXISTS "Admins delete media rows" ON public.media;
CREATE POLICY "Admins upload own media" ON public.media FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') AND uploaded_by = auth.uid());
CREATE POLICY "Admins update own media" ON public.media FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND uploaded_by = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'admin') AND uploaded_by = auth.uid());
CREATE POLICY "Admins delete media rows" ON public.media FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.media FROM anon;

-- Storage bucket 'media': public read stays; writes admin-only and owner-bound
DROP POLICY IF EXISTS "Authenticated users can upload media" ON storage.objects;
DROP POLICY IF EXISTS "Admins and editors can update media" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete media" ON storage.objects;
CREATE POLICY "Admins upload media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(),'admin') AND owner = auth.uid());
CREATE POLICY "Admins update own media" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(),'admin') AND owner = auth.uid())
  WITH CHECK (bucket_id = 'media' AND public.has_role(auth.uid(),'admin') AND owner = auth.uid());
CREATE POLICY "Admins delete own media" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'media' AND public.has_role(auth.uid(),'admin') AND owner = auth.uid());