-- Developing-story update system (BBC-style "Updated HH:MM" + update box).
-- Idempotent: safe to run more than once.

-- 1) Article columns
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS story_key TEXT;            -- entity|event|place|YYYY-MM
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS source_url TEXT;           -- primary source URL used for matching
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS content_updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_articles_story_key ON public.articles(story_key);
CREATE INDEX IF NOT EXISTS idx_articles_source_url ON public.articles(source_url);
CREATE INDEX IF NOT EXISTS idx_articles_content_updated_at ON public.articles(content_updated_at DESC);

-- 2) content_updated_at only moves when title/summary/body actually change
CREATE OR REPLACE FUNCTION public.set_article_content_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.body IS DISTINCT FROM OLD.body THEN
    NEW.content_updated_at := now();
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_articles_content_updated_at ON public.articles;
CREATE TRIGGER trg_articles_content_updated_at
  BEFORE UPDATE OF title, summary, body ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_article_content_updated_at();

-- 3) Update records
CREATE TABLE IF NOT EXISTS public.story_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  headline_change TEXT,
  summary TEXT NOT NULL,
  body_md TEXT,
  sources TEXT[] NOT NULL DEFAULT '{}',
  kind TEXT NOT NULL DEFAULT 'update' CHECK (kind IN ('update','correction')),
  is_material BOOLEAN NOT NULL DEFAULT false,
  tweeted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_story_updates_article ON public.story_updates(article_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_story_updates_untweeted ON public.story_updates(posted_at) WHERE is_material AND tweeted_at IS NULL;

ALTER TABLE public.story_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view updates on published articles" ON public.story_updates;
CREATE POLICY "Anyone can view updates on published articles" ON public.story_updates
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.articles a WHERE a.id = article_id AND a.is_published = true)
                    OR public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins can manage story updates" ON public.story_updates;
CREATE POLICY "Admins can manage story updates" ON public.story_updates
  FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- service_role bypasses RLS (bots write with the service key).

-- 4) Helper bots call: add an update / correction
CREATE OR REPLACE FUNCTION public.add_story_update(
  p_article_id UUID, p_summary TEXT, p_body_md TEXT DEFAULT NULL, p_sources TEXT[] DEFAULT '{}',
  p_kind TEXT DEFAULT 'update', p_is_material BOOLEAN DEFAULT false,
  p_new_title TEXT DEFAULT NULL, p_new_summary TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id UUID; v_old_title TEXT;
BEGIN
  SELECT title INTO v_old_title FROM public.articles WHERE id = p_article_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'article % not found', p_article_id; END IF;
  INSERT INTO public.story_updates(article_id, headline_change, summary, body_md, sources, kind, is_material)
  VALUES (p_article_id,
          CASE WHEN p_new_title IS NOT NULL AND p_new_title IS DISTINCT FROM v_old_title THEN p_new_title END,
          p_summary, p_body_md, COALESCE(p_sources,'{}'), p_kind, p_is_material)
  RETURNING id INTO v_id;
  -- Headline / top paragraph change in place only when supplied. slug + published_at untouched.
  UPDATE public.articles SET
    title = COALESCE(p_new_title, title),
    summary = COALESCE(p_new_summary, summary),
    content_updated_at = now()
  WHERE id = p_article_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.add_story_update(UUID,TEXT,TEXT,TEXT[],TEXT,BOOLEAN,TEXT,TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_story_update(UUID,TEXT,TEXT,TEXT[],TEXT,BOOLEAN,TEXT,TEXT) TO service_role;

-- 5) Cheap matching: URL -> story_key (30d) -> >=2 key-term overlap with titles (14d).
-- Returns candidates; if match_type = 'terms' the bot asks a one-line AI yes/no before amending.
CREATE OR REPLACE FUNCTION public.find_story_match(
  p_source_url TEXT DEFAULT NULL, p_story_key TEXT DEFAULT NULL, p_terms TEXT[] DEFAULT '{}'
) RETURNS TABLE(article_id UUID, slug TEXT, title TEXT, published_at TIMESTAMPTZ, match_type TEXT, overlap INT)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_source_url IS NOT NULL THEN
    RETURN QUERY SELECT a.id, a.slug, a.title, a.published_at, 'url'::TEXT, NULL::INT
      FROM public.articles a
      WHERE a.is_published AND a.published_at > now() - interval '30 days'
        AND (a.source_url = p_source_url
             OR EXISTS (SELECT 1 FROM public.story_updates u WHERE u.article_id = a.id AND p_source_url = ANY(u.sources)))
      ORDER BY a.published_at DESC LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
  IF p_story_key IS NOT NULL THEN
    RETURN QUERY SELECT a.id, a.slug, a.title, a.published_at, 'story_key'::TEXT, NULL::INT
      FROM public.articles a
      WHERE a.is_published AND a.story_key = p_story_key AND a.published_at > now() - interval '30 days'
      ORDER BY a.published_at DESC LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;
  IF COALESCE(array_length(p_terms,1),0) >= 2 THEN
    RETURN QUERY SELECT a.id, a.slug, a.title, a.published_at, 'terms'::TEXT, x.n
      FROM public.articles a
      CROSS JOIN LATERAL (SELECT count(*)::INT AS n FROM unnest(p_terms) t
                          WHERE length(t) > 2 AND a.title ILIKE '%' || t || '%') x
      WHERE a.is_published AND a.published_at > now() - interval '14 days' AND x.n >= 2
      ORDER BY x.n DESC, a.published_at DESC LIMIT 3;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.find_story_match(TEXT,TEXT,TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.find_story_match(TEXT,TEXT,TEXT[]) TO service_role;
