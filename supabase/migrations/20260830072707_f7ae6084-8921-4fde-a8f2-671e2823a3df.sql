-- ============================================================
-- 1. CANONICAL NEWS EVENT REGISTRY
-- ============================================================
CREATE TABLE IF NOT EXISTS public.news_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint text NOT NULL UNIQUE,
  primary_entity text,
  action text,
  primary_statistic text,
  normalised_statistic text,
  period text,
  category text,
  headline text,
  first_article_id uuid,
  first_published_at timestamptz NOT NULL DEFAULT now(),
  last_updated_at timestamptz NOT NULL DEFAULT now(),
  update_count integer NOT NULL DEFAULT 0,
  article_count integer NOT NULL DEFAULT 1,
  tweeted boolean NOT NULL DEFAULT false,
  tweeted_at timestamptz,
  tweet_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.news_events TO authenticated;
GRANT ALL ON public.news_events TO service_role;
ALTER TABLE public.news_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read news_events" ON public.news_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_news_events_first_published
  ON public.news_events (first_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_events_entity_cat
  ON public.news_events (primary_entity, category);

-- ============================================================
-- 2. EVENT IDENTITY ON ARTICLES
-- ============================================================
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS event_fingerprint text,
  ADD COLUMN IF NOT EXISTS editorial_category text;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_articles_event_fingerprint
  ON public.articles (event_fingerprint)
  WHERE event_fingerprint IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_articles_event_id ON public.articles (event_id);

-- ============================================================
-- 3. PERMANENT REJECTION AUDIT TRAIL
-- ============================================================
CREATE TABLE IF NOT EXISTS public.publication_rejections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage text NOT NULL,
  code text NOT NULL,
  reason text,
  headline text,
  source_url text,
  source_name text,
  event_fingerprint text,
  article_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.publication_rejections TO authenticated;
GRANT ALL ON public.publication_rejections TO service_role;
ALTER TABLE public.publication_rejections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read publication_rejections" ON public.publication_rejections
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_pub_rejections_created
  ON public.publication_rejections (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pub_rejections_code
  ON public.publication_rejections (code);

-- ============================================================
-- 4. TWEET QUEUE HARDENING
-- ============================================================
ALTER TABLE public.tweet_queue
  ADD COLUMN IF NOT EXISTS event_id uuid,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by text;

DELETE FROM public.tweet_queue a
USING public.tweet_queue b
WHERE a.ctid < b.ctid AND a.article_id = b.article_id;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tweet_queue_article
  ON public.tweet_queue (article_id);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tweet_queue_event_fp
  ON public.tweet_queue (event_fingerprint)
  WHERE event_fingerprint IS NOT NULL;

-- ============================================================
-- 5. ATOMIC CLAIM HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.claim_news_event(
  p_fingerprint text,
  p_primary_entity text,
  p_action text,
  p_primary_statistic text,
  p_normalised_statistic text,
  p_period text,
  p_category text,
  p_headline text
) RETURNS TABLE (event_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_existing_stat text;
BEGIN
  INSERT INTO public.news_events (
    fingerprint, primary_entity, action, primary_statistic,
    normalised_statistic, period, category, headline
  ) VALUES (
    p_fingerprint, p_primary_entity, p_action, p_primary_statistic,
    p_normalised_statistic, p_period, p_category, p_headline
  )
  ON CONFLICT (fingerprint) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NOT NULL THEN
    RETURN QUERY SELECT v_id, 'claimed'::text;
    RETURN;
  END IF;

  SELECT id, normalised_statistic INTO v_id, v_existing_stat
  FROM public.news_events WHERE fingerprint = p_fingerprint;

  RETURN QUERY SELECT v_id, 'duplicate'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_event_update(
  p_event_id uuid, p_normalised_statistic text, p_headline text
) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.news_events
  SET update_count = update_count + 1,
      last_updated_at = now(),
      normalised_statistic = COALESCE(p_normalised_statistic, normalised_statistic),
      headline = COALESCE(p_headline, headline)
  WHERE id = p_event_id;
$$;

CREATE OR REPLACE FUNCTION public.claim_next_tweet(p_worker text)
RETURNS TABLE (
  id uuid, article_id uuid, tweet_text text, url text,
  headline text, event_fingerprint text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT q.id INTO v_id
  FROM public.tweet_queue q
  WHERE q.posted = false
    AND q.halt_reason IS NULL
    AND q.claimed_at IS NULL
  ORDER BY q.generated_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_id IS NULL THEN RETURN; END IF;

  UPDATE public.tweet_queue
  SET claimed_at = now(), claimed_by = p_worker
  WHERE public.tweet_queue.id = v_id;

  RETURN QUERY
  SELECT q.id, q.article_id, q.tweet_text, q.url, q.headline, q.event_fingerprint
  FROM public.tweet_queue q WHERE q.id = v_id;
END;
$$;

-- release stale claims (worker died mid-post)
CREATE OR REPLACE FUNCTION public.release_stale_tweet_claims()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  UPDATE public.tweet_queue
  SET claimed_at = NULL, claimed_by = NULL
  WHERE posted = false AND claimed_at IS NOT NULL AND claimed_at < now() - interval '30 minutes';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

-- ============================================================
-- 6. REMOVE THE PARALLEL PUBLICATION PATH
-- ============================================================
DO $$
BEGIN
  PERFORM cron.unschedule('editorial-publish-gate-job');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
