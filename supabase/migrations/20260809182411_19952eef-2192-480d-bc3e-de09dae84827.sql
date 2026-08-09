ALTER TABLE public.tweet_queue
  ADD COLUMN IF NOT EXISTS headline TEXT,
  ADD COLUMN IF NOT EXISTS event_fingerprint TEXT,
  ADD COLUMN IF NOT EXISTS primary_number TEXT;

CREATE INDEX IF NOT EXISTS tweet_queue_event_fp_idx ON public.tweet_queue (event_fingerprint);
CREATE INDEX IF NOT EXISTS tweet_queue_url_idx ON public.tweet_queue (url);

CREATE TABLE IF NOT EXISTS public.tweet_decisions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID,
  headline TEXT,
  canonical_url TEXT,
  event_fingerprint TEXT,
  tweet_text TEXT,
  status TEXT NOT NULL,
  reason TEXT,
  substantive_numbers JSONB NOT NULL DEFAULT '[]'::jsonb,
  score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.tweet_decisions TO authenticated;
GRANT ALL ON public.tweet_decisions TO service_role;

ALTER TABLE public.tweet_decisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and editors can read tweet decisions"
ON public.tweet_decisions FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE INDEX IF NOT EXISTS tweet_decisions_article_idx ON public.tweet_decisions (article_id);
CREATE INDEX IF NOT EXISTS tweet_decisions_created_idx ON public.tweet_decisions (created_at DESC);