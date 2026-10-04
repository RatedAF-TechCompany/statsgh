CREATE TABLE public.data_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL CHECK (char_length(message) BETWEEN 3 AND 200),
  link_url text CHECK (link_url IS NULL OR char_length(link_url) <= 500),
  is_active boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.data_alerts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.data_alerts TO authenticated;
GRANT ALL ON public.data_alerts TO service_role;
ALTER TABLE public.data_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active alerts" ON public.data_alerts FOR SELECT TO anon, authenticated USING (is_active = true);
CREATE POLICY "Admins and editors read all alerts" ON public.data_alerts FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "Admins and editors insert alerts" ON public.data_alerts FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "Admins and editors update alerts" ON public.data_alerts FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "Admins and editors delete alerts" ON public.data_alerts FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER data_alerts_updated BEFORE UPDATE ON public.data_alerts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();