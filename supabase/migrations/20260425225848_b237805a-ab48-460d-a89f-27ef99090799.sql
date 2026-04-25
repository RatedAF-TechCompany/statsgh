
ALTER TABLE public.newsroom_articles
  ADD COLUMN IF NOT EXISTS source_published_at TIMESTAMPTZ;

ALTER TABLE public.newsroom_sources
  ADD COLUMN IF NOT EXISTS trust_pub_date BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_newsroom_articles_source_pub_status
  ON public.newsroom_articles (source_published_at, processing_status);

CREATE INDEX IF NOT EXISTS idx_articles_source_published_at
  ON public.articles (source_published_at);
