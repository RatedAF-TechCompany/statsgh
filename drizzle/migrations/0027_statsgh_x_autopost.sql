CREATE TABLE IF NOT EXISTS public.social_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid, url text, section text, category_slug text, topic_key text, format text,
  post_text text, edited_text text, char_count int, key_number text, source text,
  chart_suggestion text, alt_text text, model_output jsonb, checks_json jsonb, code_checks_json jsonb,
  status text NOT NULL, reject_reason text, prompt_version text, model text,
  prompt_tokens int, completion_tokens int, x_post_id text, posted_at timestamptz,
  reviewed_by uuid, reviewed_at timestamptz, impressions int, replies int, reposts int, link_clicks int,
  metrics_pulled_at timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(),
  CONSTRAINT social_posts_status_check CHECK (status IN ('rejected_crime','rejected_duplicate','rejected_ineligible','rejected_model','held','approved','posted','post_failed','discarded','expired'))
);
CREATE INDEX IF NOT EXISTS social_posts_status_created_idx ON public.social_posts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_posted_at_idx ON public.social_posts (posted_at DESC);
CREATE INDEX IF NOT EXISTS social_posts_topic_key_idx ON public.social_posts (topic_key);
CREATE UNIQUE INDEX IF NOT EXISTS social_posts_article_active_uidx ON public.social_posts (article_id) WHERE status IN ('held','approved','posted');
GRANT SELECT ON public.social_posts TO authenticated;
GRANT ALL ON public.social_posts TO service_role;
ALTER TABLE public.social_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and editors can read social posts" ON public.social_posts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER social_posts_updated_at BEFORE UPDATE ON public.social_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.x_autopost_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  mode text NOT NULL DEFAULT 'review_only' CHECK (mode IN ('review_only','auto')),
  daily_cap int NOT NULL DEFAULT 6 CHECK (daily_cap BETWEEN 1 AND 6),
  min_gap_minutes int NOT NULL DEFAULT 90 CHECK (min_gap_minutes >= 60),
  quiet_start_utc int NOT NULL DEFAULT 23 CHECK (quiet_start_utc BETWEEN 0 AND 23),
  quiet_end_utc int NOT NULL DEFAULT 6 CHECK (quiet_end_utc BETWEEN 0 AND 23),
  max_candidates_per_run int NOT NULL DEFAULT 2,
  max_model_calls_per_day int NOT NULL DEFAULT 20,
  lookback_hours int NOT NULL DEFAULT 24,
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  temperature numeric NOT NULL DEFAULT 0.4,
  prompt_version text NOT NULL DEFAULT '1.0',
  link_mode text NOT NULL DEFAULT 'in_post',
  utm text NOT NULL DEFAULT 'utm_source=x&utm_medium=social&utm_campaign=autopost',
  last_run_at timestamptz, last_run_summary jsonb, updated_at timestamptz DEFAULT now()
);
GRANT SELECT, UPDATE ON public.x_autopost_settings TO authenticated;
GRANT ALL ON public.x_autopost_settings TO service_role;
ALTER TABLE public.x_autopost_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read autopost settings" ON public.x_autopost_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins update autopost settings" ON public.x_autopost_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER x_autopost_settings_updated_at BEFORE UPDATE ON public.x_autopost_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT SELECT, UPDATE ON public.system_flags TO authenticated;
CREATE POLICY "admins update auto tweet flag" ON public.system_flags FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') AND key = 'AUTO_TWEET_ENABLED')
  WITH CHECK (public.has_role(auth.uid(),'admin') AND key = 'AUTO_TWEET_ENABLED');