
CREATE TABLE public.expert_submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  author_name TEXT NOT NULL,
  author_bio TEXT,
  author_email TEXT,
  title TEXT,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES auth.users(id),
  published_article_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.expert_submissions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expert_submissions TO authenticated;
GRANT ALL ON public.expert_submissions TO service_role;

ALTER TABLE public.expert_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit" ON public.expert_submissions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Admins and editors can read" ON public.expert_submissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins and editors can update" ON public.expert_submissions
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE TRIGGER trg_expert_submissions_updated
  BEFORE UPDATE ON public.expert_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
