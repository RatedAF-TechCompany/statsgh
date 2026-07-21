
CREATE TABLE IF NOT EXISTS public.rejected_articles_international (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID,
  headline TEXT,
  reason_international_nexus TEXT,
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.rejected_articles_international TO authenticated;
GRANT ALL ON public.rejected_articles_international TO service_role;
ALTER TABLE public.rejected_articles_international ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_editor_read_international_rejects" ON public.rejected_articles_international
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

CREATE TABLE IF NOT EXISTS public.tweets_missing_urls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID,
  tweet_text TEXT,
  url_provided TEXT,
  reason TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tweets_missing_urls TO authenticated;
GRANT ALL ON public.tweets_missing_urls TO service_role;
ALTER TABLE public.tweets_missing_urls ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_editor_read_missing_urls" ON public.tweets_missing_urls
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
