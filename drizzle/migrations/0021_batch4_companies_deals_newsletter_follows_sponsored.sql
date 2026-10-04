-- Companies (GSE-listed reference list)
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  symbol text NOT NULL UNIQUE,
  name text NOT NULL,
  sector text,
  aliases text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.companies TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read companies" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Admins manage companies" ON public.companies FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.companies (slug, symbol, name, sector, aliases)
SELECT DISTINCT ON (p.symbol)
  lower(regexp_replace(p.symbol, '[^A-Za-z0-9]+', '-', 'g')),
  p.symbol, coalesce(p.name, p.symbol), p.sector,
  array_remove(ARRAY[coalesce(p.name, p.symbol), nullif(btrim(regexp_replace(coalesce(p.name,''), '\s+(plc|ltd\.?|limited|company)$', '', 'i')), coalesce(p.name,''))], NULL)
FROM public.gse_daily_prices p
ORDER BY p.symbol, p.trade_date DESC
ON CONFLICT (symbol) DO NOTHING;

-- Article metadata: deal type + sponsored content
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS deal_type text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS is_sponsored boolean NOT NULL DEFAULT false;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS sponsor_name text;
ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS sponsor_disclosure text;
CREATE INDEX IF NOT EXISTS idx_articles_deal_type ON public.articles(deal_type) WHERE deal_type IS NOT NULL;

CREATE OR REPLACE FUNCTION public.classify_deal_type(p_title text, p_summary text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  SELECT CASE
    WHEN t ~* '\meurobonds?\M' THEN 'eurobond'
    WHEN t ~* '\mIPO\M|initial public offering|lists? on the (GSE|Ghana Stock Exchange)|new listing' THEN 'ipo'
    WHEN t ~* '\macqui(re|res|red|sition|sitions)\M|\mmergers?\M|\mtakeover|buys? (a )?\d*.{0,10}stake|sells? (its )?stake|\mdivest' THEN 'm_and_a'
    WHEN t ~* '\m(corporate|green|domestic|infrastructure|sukuk) bonds?\M|\mbonds?\M.{0,40}(issu|rais|programme|offer)|(issu|rais|offer)\w*.{0,40}\mbonds?\M|note programme' THEN 'bond'
    WHEN t ~* 'rights issue|private placement|capital rais|raises? (us\$|gh₵|\$|ghs)|equity rais|secures? .{0,40}(funding|financing|facility|investment)' THEN 'capital_raise'
    WHEN t ~* '(award|win|sign|secure)\w* .{0,40}contract|contract (worth|valued)' THEN 'contract'
  END
  FROM (SELECT coalesce(p_title,'') || ' ' || coalesce(p_summary,'') AS t) s
$$;

CREATE OR REPLACE FUNCTION public.set_article_deal_type()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.deal_type IS NULL AND NOT coalesce(NEW.is_sponsored,false) THEN
    NEW.deal_type := public.classify_deal_type(NEW.title, NEW.summary);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_articles_deal_type BEFORE INSERT OR UPDATE OF title, summary ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.set_article_deal_type();

ALTER TABLE public.articles DISABLE TRIGGER update_articles_updated_at;
UPDATE public.articles SET deal_type = public.classify_deal_type(title, summary)
  WHERE is_published = true AND deal_type IS NULL AND public.classify_deal_type(title, summary) IS NOT NULL;
ALTER TABLE public.articles ENABLE TRIGGER update_articles_updated_at;

-- Company article matching
CREATE OR REPLACE FUNCTION public.company_articles(p_symbol text, p_results_only boolean DEFAULT false, p_limit integer DEFAULT 50)
RETURNS TABLE(id uuid, title text, slug text, category_slug text, summary text, published_at timestamptz, tags text[], deal_type text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH c AS (SELECT aliases FROM public.companies WHERE upper(symbol) = upper(p_symbol)),
  pat AS (SELECT '\m(' || string_agg(regexp_replace(a, '([.^$*+?()\[\]{}|\\-])', '\\\1', 'g'), '|') || ')\M' AS re
          FROM c, unnest(c.aliases) a WHERE length(a) >= 3)
  SELECT a.id, a.title, a.slug, a.category_slug, a.summary, a.published_at, a.tags, a.deal_type
  FROM public.articles a, pat
  WHERE a.is_published = true AND NOT a.is_sponsored AND pat.re IS NOT NULL
    AND (a.title ~* pat.re OR a.summary ~* pat.re OR a.body ~* pat.re)
    AND (NOT p_results_only OR a.tags && ARRAY['results','earnings','dividend','dividends','financial-results','profit']
         OR a.title ~* '\m(results|earnings|profit|profits|dividend|dividends|half-year|interim|full-year|net income|turnover)\M')
  ORDER BY a.published_at DESC NULLS LAST
  LIMIT LEAST(GREATEST(p_limit,1),200)
$$;
GRANT EXECUTE ON FUNCTION public.company_articles(text, boolean, integer) TO anon, authenticated;

-- Newsletter 2.0
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS wants_daily boolean NOT NULL DEFAULT true;
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS wants_weekly boolean NOT NULL DEFAULT false;
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS manage_token uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.newsletter_subscribers ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
CREATE UNIQUE INDEX IF NOT EXISTS newsletter_subscribers_manage_token_key ON public.newsletter_subscribers(manage_token);

CREATE OR REPLACE FUNCTION public.subscribe_newsletter(p_email text, p_daily boolean, p_weekly boolean, p_source text)
RETURNS TABLE(status text, manage_token uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text := lower(btrim(p_email)); v_tok uuid;
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN RAISE EXCEPTION 'invalid email'; END IF;
  IF NOT (coalesce(p_daily,false) OR coalesce(p_weekly,false)) THEN RAISE EXCEPTION 'choose daily or weekly'; END IF;
  INSERT INTO public.newsletter_subscribers(email, source, wants_daily, wants_weekly, is_active, frequency)
  VALUES (v_email, left(coalesce(p_source,'site'),40), p_daily, p_weekly, true,
          CASE WHEN p_daily AND p_weekly THEN 'both' WHEN p_daily THEN 'daily' ELSE 'weekly' END)
  ON CONFLICT DO NOTHING RETURNING newsletter_subscribers.manage_token INTO v_tok;
  IF v_tok IS NOT NULL THEN RETURN QUERY SELECT 'subscribed'::text, v_tok; RETURN; END IF;
  -- Existing address: only ever add choices, never remove or reveal the token.
  UPDATE public.newsletter_subscribers SET wants_daily = wants_daily OR p_daily, wants_weekly = wants_weekly OR p_weekly, updated_at = now()
    WHERE email = v_email AND is_active;
  RETURN QUERY SELECT 'existing'::text, NULL::uuid;
END $$;

CREATE OR REPLACE FUNCTION public.get_newsletter_prefs(p_token uuid)
RETURNS TABLE(email text, wants_daily boolean, wants_weekly boolean, is_active boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT regexp_replace(s.email, '^(.).*(@.*)$', '\1***\2'), s.wants_daily, s.wants_weekly, s.is_active
  FROM public.newsletter_subscribers s WHERE s.manage_token = p_token
$$;

CREATE OR REPLACE FUNCTION public.update_newsletter_prefs(p_token uuid, p_daily boolean, p_weekly boolean, p_active boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.newsletter_subscribers
    SET wants_daily = coalesce(p_daily,false), wants_weekly = coalesce(p_weekly,false),
        is_active = coalesce(p_active,true) AND (coalesce(p_daily,false) OR coalesce(p_weekly,false)), updated_at = now()
    WHERE manage_token = p_token;
  RETURN FOUND;
END $$;
GRANT EXECUTE ON FUNCTION public.subscribe_newsletter(text, boolean, boolean, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_newsletter_prefs(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_newsletter_prefs(uuid, boolean, boolean, boolean) TO anon, authenticated;

-- Follows (alerts later; no sending now)
CREATE TABLE public.follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('topic','company','indicator')),
  target_key text NOT NULL,
  target_label text,
  manage_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (email, target_type, target_key)
);
GRANT SELECT, DELETE ON public.follows TO authenticated;
GRANT ALL ON public.follows TO service_role;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read follows" ON public.follows FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins delete follows" ON public.follows FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.follow_target(p_email text, p_type text, p_key text, p_label text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_email text := lower(btrim(p_email));
BEGIN
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' OR length(v_email) > 254 THEN RAISE EXCEPTION 'invalid email'; END IF;
  IF p_type NOT IN ('topic','company','indicator') OR coalesce(btrim(p_key),'') = '' OR length(p_key) > 120 THEN RAISE EXCEPTION 'invalid target'; END IF;
  INSERT INTO public.follows(email, target_type, target_key, target_label)
  VALUES (v_email, p_type, btrim(p_key), left(p_label, 160)) ON CONFLICT DO NOTHING;
  RETURN 'ok';
END $$;
GRANT EXECUTE ON FUNCTION public.follow_target(text, text, text, text) TO anon, authenticated;

-- Distribution + ad settings
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS whatsapp_url text;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS telegram_url text;
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS x_url text DEFAULT 'https://x.com/StatsGH';
ALTER TABLE public.site_settings ADD COLUMN IF NOT EXISTS ad_rates jsonb;