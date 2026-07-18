CREATE TABLE public.tweet_schedule_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  tweet_text TEXT,
  tweet_id TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tweet_schedule_log TO authenticated;
GRANT ALL ON public.tweet_schedule_log TO service_role;

ALTER TABLE public.tweet_schedule_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view tweet schedule log"
ON public.tweet_schedule_log FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX tweet_schedule_log_created_at_idx ON public.tweet_schedule_log (created_at DESC);
CREATE INDEX tweet_schedule_log_article_id_idx ON public.tweet_schedule_log (article_id);