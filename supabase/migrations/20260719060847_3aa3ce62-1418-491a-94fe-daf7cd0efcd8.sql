
CREATE TABLE public.daily_tweet_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  tweet_text TEXT NOT NULL,
  url TEXT,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  scheduled_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  tweet_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_daily_tweet_queue_unposted ON public.daily_tweet_queue (generated_at) WHERE posted_at IS NULL;
GRANT SELECT ON public.daily_tweet_queue TO authenticated;
GRANT ALL ON public.daily_tweet_queue TO service_role;
ALTER TABLE public.daily_tweet_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view daily tweet queue" ON public.daily_tweet_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.tweet_rejections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL,
  reject_reason TEXT,
  rejected_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tweet_rejections_rejected_at ON public.tweet_rejections (rejected_at DESC);
GRANT SELECT ON public.tweet_rejections TO authenticated;
GRANT ALL ON public.tweet_rejections TO service_role;
ALTER TABLE public.tweet_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view tweet rejections" ON public.tweet_rejections
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
