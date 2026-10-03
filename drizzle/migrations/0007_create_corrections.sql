CREATE TABLE public.corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES public.articles(id) ON DELETE CASCADE,
  article_title text NOT NULL,
  article_url text NOT NULL,
  what_was_wrong text NOT NULL,
  what_was_fixed text NOT NULL,
  corrected_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.corrections TO anon;
GRANT SELECT ON public.corrections TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.corrections TO authenticated;
GRANT ALL ON public.corrections TO service_role;

ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can read corrections"
  ON public.corrections FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Admins and editors can manage corrections"
  ON public.corrections FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));