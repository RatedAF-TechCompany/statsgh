DO $$
DECLARE
  t text;
  public_tables text[] := ARRAY[
    'newsroom_articles','categories','article_entities','article_indicators',
    'article_sources','entities','news_events','indicators','indicator_topics',
    'data_series','data_points','data_sources','data_topics','datasets',
    'geographies','geography_sets','geography_set_members','ghana_series_tags',
    'gse_stocks','currency_rates','commodity_prices','economic_calendar',
    'dashboard_updates','site_settings','media'
  ];
BEGIN
  FOREACH t IN ARRAY public_tables LOOP
    EXECUTE format('GRANT SELECT ON public.%I TO anon, authenticated', t);
    EXECUTE format('DROP POLICY IF EXISTS "Public read access" ON public.%I', t);
    EXECUTE format('CREATE POLICY "Public read access" ON public.%I FOR SELECT TO anon, authenticated USING (true)', t);
  END LOOP;
END $$;

-- Articles: public reads see published articles only (drafts/rejected stay hidden)
GRANT SELECT ON public.articles TO anon, authenticated;
DROP POLICY IF EXISTS "Public read access" ON public.articles;
CREATE POLICY "Public read access" ON public.articles
  FOR SELECT TO anon, authenticated USING (is_published = true);

-- Comments: public reads see published comments only (shown on article pages)
GRANT SELECT ON public.comments TO anon, authenticated;
DROP POLICY IF EXISTS "Public read access" ON public.comments;
CREATE POLICY "Public read access" ON public.comments
  FOR SELECT TO anon, authenticated USING (is_published = true);

-- article_views: anon insert only, no public select (Most Read uses the
-- security-definer get_most_read_counts RPC instead)
GRANT INSERT ON public.article_views TO anon, authenticated;