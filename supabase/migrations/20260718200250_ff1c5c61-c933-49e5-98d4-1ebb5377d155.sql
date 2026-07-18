
-- 1. newsroom_sources fast-lane flag
ALTER TABLE public.newsroom_sources ADD COLUMN IF NOT EXISTS is_primary_data BOOLEAN NOT NULL DEFAULT false;

-- 2. articles: key data, type, scenarios
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS key_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS article_type TEXT NOT NULL DEFAULT 'analysis',
  ADD COLUMN IF NOT EXISTS article_scenarios JSONB;

-- 3. entities table
CREATE TABLE IF NOT EXISTS public.entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person','company','ministry','law','indicator','organization')),
  description TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.entities TO anon, authenticated;
GRANT ALL ON public.entities TO service_role;

ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read entities" ON public.entities FOR SELECT USING (true);
CREATE POLICY "Admins manage entities" ON public.entities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_entities_slug ON public.entities(slug);
CREATE INDEX IF NOT EXISTS idx_entities_type ON public.entities(entity_type);

CREATE TRIGGER trg_entities_updated_at BEFORE UPDATE ON public.entities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. article_entities link table
CREATE TABLE IF NOT EXISTS public.article_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  mention_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(article_id, entity_id)
);

GRANT SELECT ON public.article_entities TO anon, authenticated;
GRANT ALL ON public.article_entities TO service_role;

ALTER TABLE public.article_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read article_entities" ON public.article_entities FOR SELECT USING (true);
CREATE POLICY "Admins manage article_entities" ON public.article_entities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE INDEX IF NOT EXISTS idx_article_entities_article ON public.article_entities(article_id);
CREATE INDEX IF NOT EXISTS idx_article_entities_entity ON public.article_entities(entity_id);

-- 5. Seed primary sources (only if not already present by name)
INSERT INTO public.newsroom_sources (name, rss_url, is_active, priority_tier, is_primary_data, trust_pub_date)
SELECT * FROM (VALUES
  ('Bank of Ghana — Press Releases', 'https://www.bog.gov.gh/news_events/feed/', true, 1, true, true),
  ('Ghana Statistical Service — Publications', 'https://statsghana.gov.gh/feed/', true, 1, true, true),
  ('Ghana Stock Exchange — Announcements', 'https://gse.com.gh/feed/', true, 1, true, true),
  ('Ministry of Finance — Publications', 'https://mofep.gov.gh/press-release/feed', true, 1, true, true),
  ('IMF — Ghana Country News', 'https://www.imf.org/en/News/rss?Language=ENG&SearchText=ghana', true, 1, true, true)
) AS s(name, rss_url, is_active, priority_tier, is_primary_data, trust_pub_date)
WHERE NOT EXISTS (SELECT 1 FROM public.newsroom_sources ns WHERE ns.name = s.name);
