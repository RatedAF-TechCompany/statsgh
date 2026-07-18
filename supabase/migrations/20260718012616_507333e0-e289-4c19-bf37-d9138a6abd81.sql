-- ai_rejects: cheap dedupe cache so rejected items are skipped for free forever
CREATE TABLE IF NOT EXISTS public.ai_rejects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url_hash text NOT NULL,
  title_hash text NOT NULL,
  reason text NOT NULL,
  source_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ai_rejects_url_hash_key ON public.ai_rejects(url_hash);
CREATE INDEX IF NOT EXISTS ai_rejects_title_hash_idx ON public.ai_rejects(title_hash);
CREATE INDEX IF NOT EXISTS ai_rejects_created_at_idx ON public.ai_rejects(created_at DESC);

GRANT SELECT ON public.ai_rejects TO authenticated;
GRANT ALL ON public.ai_rejects TO service_role;
ALTER TABLE public.ai_rejects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and editors can read ai_rejects"
  ON public.ai_rejects FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Admins can manage ai_rejects"
  ON public.ai_rejects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Bounded retries + dead-letter on newsroom_articles
ALTER TABLE public.newsroom_articles
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_letter boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS newsroom_articles_retry_idx
  ON public.newsroom_articles(processing_status, dead_letter, last_attempt_at);

-- Bounded retries + dead-letter on newsroom_candidates
ALTER TABLE public.newsroom_candidates
  ADD COLUMN IF NOT EXISTS attempts int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS dead_letter boolean NOT NULL DEFAULT false;

-- Per-run cost/usage visibility
ALTER TABLE public.newsroom_runs
  ADD COLUMN IF NOT EXISTS ai_calls int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS prompt_tokens int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS completion_tokens int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_cost numeric(10,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS json_parse_failures int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discovery_ran boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS halt_reason text;