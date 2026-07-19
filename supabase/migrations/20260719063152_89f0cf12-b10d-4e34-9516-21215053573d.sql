
CREATE TABLE IF NOT EXISTS public.articles_rejected_scoring (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL,
  headline text,
  score int NOT NULL DEFAULT 0,
  reason text,
  rejected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ars_article ON public.articles_rejected_scoring(article_id);
CREATE INDEX IF NOT EXISTS idx_ars_rejected_at ON public.articles_rejected_scoring(rejected_at DESC);
GRANT SELECT ON public.articles_rejected_scoring TO authenticated;
GRANT ALL ON public.articles_rejected_scoring TO service_role;
ALTER TABLE public.articles_rejected_scoring ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read scoring rejects" ON public.articles_rejected_scoring;
CREATE POLICY "Admins read scoring rejects" ON public.articles_rejected_scoring
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.articles_rejected_ai (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL,
  reason text,
  rejected_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_arai_article ON public.articles_rejected_ai(article_id);
CREATE INDEX IF NOT EXISTS idx_arai_rejected_at ON public.articles_rejected_ai(rejected_at DESC);
GRANT SELECT ON public.articles_rejected_ai TO authenticated;
GRANT ALL ON public.articles_rejected_ai TO service_role;
ALTER TABLE public.articles_rejected_ai ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read ai rejects" ON public.articles_rejected_ai;
CREATE POLICY "Admins read ai rejects" ON public.articles_rejected_ai
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.tweet_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL UNIQUE,
  tweet_text text NOT NULL,
  url text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  scheduled_hour int,
  posted boolean NOT NULL DEFAULT false,
  posted_at timestamptz,
  twitter_id text,
  halt_reason text
);
CREATE INDEX IF NOT EXISTS idx_tq_pending ON public.tweet_queue(generated_at ASC) WHERE posted = false AND halt_reason IS NULL;
GRANT SELECT ON public.tweet_queue TO authenticated;
GRANT ALL ON public.tweet_queue TO service_role;
ALTER TABLE public.tweet_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read tweet queue" ON public.tweet_queue;
CREATE POLICY "Admins read tweet queue" ON public.tweet_queue
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE IF NOT EXISTS public.daily_twitter_metrics (
  day date PRIMARY KEY,
  articles_published int NOT NULL DEFAULT 0,
  articles_passed_keyword_gate int NOT NULL DEFAULT 0,
  articles_rejected_at_keyword int NOT NULL DEFAULT 0,
  articles_rejected_at_ai int NOT NULL DEFAULT 0,
  tweets_generated int NOT NULL DEFAULT 0,
  tweets_posted int NOT NULL DEFAULT 0,
  avg_engagement numeric,
  total_cost_daily numeric,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_twitter_metrics TO authenticated;
GRANT ALL ON public.daily_twitter_metrics TO service_role;
ALTER TABLE public.daily_twitter_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins read daily twitter metrics" ON public.daily_twitter_metrics;
CREATE POLICY "Admins read daily twitter metrics" ON public.daily_twitter_metrics
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Unschedule deprecated tweet cron jobs
DO $$
DECLARE j text;
BEGIN
  FOR j IN
    SELECT jobname FROM cron.job
    WHERE jobname IN (
      'scheduled-tweet-poster-morning',
      'scheduled-tweet-poster-evening',
      'scheduled-tweet-poster-job',
      'hourly-tweet-statsgh-job',
      'hourly-tweet-scheduler-job',
      'hourly-tweet-poster-job',
      'daily-batch-tweet-filter-job',
      'tweet-article-job',
      'tweet-batch-generator-job',
      'tweet-metrics-rollup-job'
    )
  LOOP
    PERFORM cron.unschedule(j);
  END LOOP;
END $$;

SELECT cron.schedule(
  'tweet-batch-generator-job',
  '0 0,6,12,18 * * *',
  $$ SELECT net.http_post(
    url := 'https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/tweet-batch-generator',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'tweet-hourly-poster-job',
  '5 * * * *',
  $$ SELECT net.http_post(
    url := 'https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/tweet-hourly-poster',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);

SELECT cron.schedule(
  'tweet-metrics-rollup-job',
  '10 0 * * *',
  $$ SELECT net.http_post(
    url := 'https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/tweet-metrics-rollup',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ); $$
);
