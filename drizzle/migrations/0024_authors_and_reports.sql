CREATE TABLE public.authors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  display_name text NOT NULL,
  role text,
  bio text,
  expertise text[] NOT NULL DEFAULT '{}',
  byline_aliases text[] NOT NULL DEFAULT '{}',
  kind text NOT NULL DEFAULT 'journalist' CHECK (kind IN ('journalist','desk')),
  journalist_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.authors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.authors TO authenticated;
GRANT ALL ON public.authors TO service_role;
ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads active authors" ON public.authors FOR SELECT USING (is_active OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "Editors manage authors" ON public.authors FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE TRIGGER authors_updated_at BEFORE UPDATE ON public.authors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.authors (slug, display_name, role, bio, expertise, byline_aliases, kind, journalist_id, sort_order)
SELECT trim(both '-' from regexp_replace(lower(coalesce(j.byline_name, j.name)), '[^a-z0-9]+', '-', 'g')),
       coalesce(j.byline_name, j.name), j.specialization || ' correspondent', j.bio,
       CASE WHEN j.specialization IS NULL THEN '{}' ELSE ARRAY[j.specialization] END,
       ARRAY[coalesce(j.byline_name, j.name)], 'journalist', j.id, 100
FROM public.journalists j WHERE j.is_active
ON CONFLICT (slug) DO NOTHING;
INSERT INTO public.authors (slug, display_name, role, bio, expertise, byline_aliases, kind, sort_order) VALUES
('data-desk','StatsGH Data Desk','Automated data products',
 'The Data Desk is the name StatsGH uses for automatically compiled products such as the Data Vault, the weekly Ghana Economy Scorecard and the monthly State of the Cedi report. They are built only from stored official datasets; no person writes the numbers, and every figure links to its source.',
 ARRAY['Exchange rates','Interest rates','Inflation','Ghana Stock Exchange'],
 ARRAY['Data Journalism Desk','Ghana Data Desk','StatsGH','StatsGH Newsroom'],'desk',1)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('economy-scorecard','state-of-the-cedi')),
  edition text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  data jsonb NOT NULL,
  compiled_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, edition)
);
GRANT SELECT ON public.reports TO anon, authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public reads reports" ON public.reports FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public._fx_at(p_pair text, p_day date)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('value', mid, 'date', rate_date) FROM bog_fx_rates
  WHERE pair = p_pair AND rate_date <= p_day ORDER BY rate_date DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public._gse_at(p_day date)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('value', gse_ci, 'date', trade_date) FROM gse_index_daily
  WHERE gse_ci IS NOT NULL AND trade_date <= p_day ORDER BY trade_date DESC LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public._tbill_at(p_tenor int, p_day date)
RETURNS jsonb LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT jsonb_build_object('value', interest_rate, 'date', issue_date) FROM bog_tbill_rates
  WHERE tenor_days = p_tenor AND issue_date <= p_day ORDER BY issue_date DESC LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.compile_economy_scorecard(p_day date DEFAULT (now() AT TIME ZONE 'UTC')::date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d jsonb; g_now date; g_prev date; movers jsonb; comm jsonb; infl jsonb; gold jsonb; pol jsonb;
BEGIN
  SELECT max(trade_date) INTO g_now FROM gse_daily_prices WHERE trade_date <= p_day;
  SELECT max(trade_date) INTO g_prev FROM gse_daily_prices WHERE trade_date <= p_day - 7;
  IF g_now IS NOT NULL AND g_prev IS NOT NULL THEN
    WITH ch AS (
      SELECT a.symbol, coalesce(a.name, a.symbol) AS name, a.close, b.close AS prev,
             round(((a.close - b.close) / nullif(b.close,0) * 100)::numeric, 2) AS pct
      FROM gse_daily_prices a JOIN gse_daily_prices b ON b.symbol = a.symbol AND b.trade_date = g_prev
      WHERE a.trade_date = g_now AND a.close <> b.close)
    SELECT jsonb_build_object(
      'from', g_prev, 'to', g_now,
      'up', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM ch WHERE pct > 0 ORDER BY pct DESC LIMIT 3) x), '[]'),
      'down', coalesce((SELECT jsonb_agg(to_jsonb(x)) FROM (SELECT * FROM ch WHERE pct < 0 ORDER BY pct ASC LIMIT 3) x), '[]'))
    INTO movers;
  END IF;
  SELECT coalesce(jsonb_object_agg(commodity, v), '{}') INTO comm FROM (
    SELECT c.commodity, jsonb_build_object('value', c.price, 'unit', c.unit, 'currency', c.currency, 'source', c.source, 'date', c.fetched_at::date,
      'week', (SELECT jsonb_build_object('value', p.price, 'date', p.fetched_at::date) FROM commodity_prices p WHERE p.commodity = c.commodity AND p.fetched_at::date <= p_day - 7 ORDER BY p.fetched_at DESC LIMIT 1)) v
    FROM (SELECT DISTINCT ON (commodity) * FROM commodity_prices WHERE fetched_at::date <= p_day AND fetched_at::date > p_day - 14 ORDER BY commodity, fetched_at DESC) c) s;
  SELECT jsonb_build_object('value', value, 'date', period, 'source', source, 'source_url', source_url,
    'prev', (SELECT jsonb_build_object('value', p.value, 'date', p.period) FROM macro_series p WHERE p.series_key='gold_usd' AND p.period <= p_day - 7 ORDER BY p.period DESC LIMIT 1))
    INTO gold FROM macro_series WHERE series_key = 'gold_usd' AND period <= p_day ORDER BY period DESC LIMIT 1;
  SELECT jsonb_build_object('value', value, 'period', period,
    'prev', (SELECT jsonb_build_object('value', p.value, 'period', p.period) FROM inflation_readings p WHERE p.kind = 'headline' AND p.period < i.period ORDER BY p.period DESC LIMIT 1),
    'year', (SELECT jsonb_build_object('value', p.value, 'period', p.period) FROM inflation_readings p WHERE p.kind = 'headline' AND p.period = (i.period - interval '1 year')::date LIMIT 1),
    'article_slug', article_slug, 'category_slug', category_slug)
    INTO infl FROM inflation_readings i WHERE kind = 'headline' AND period <= p_day ORDER BY period DESC LIMIT 1;
  SELECT jsonb_build_object('value', rate, 'date', effective_date, 'source_url', source_url,
    'prev', (SELECT jsonb_build_object('value', p.rate, 'date', p.effective_date) FROM bog_policy_rates p WHERE p.meeting_no < b.meeting_no ORDER BY p.meeting_no DESC LIMIT 1))
    INTO pol FROM bog_policy_rates b WHERE effective_date <= p_day ORDER BY meeting_no DESC LIMIT 1;

  d := jsonb_build_object(
    'as_of', p_day,
    'usd', jsonb_build_object('now', _fx_at('USDGHS', p_day), 'week', _fx_at('USDGHS', p_day - 7), 'month', _fx_at('USDGHS', p_day - 30), 'year', _fx_at('USDGHS', p_day - 365)),
    'gbp', jsonb_build_object('now', _fx_at('GBPGHS', p_day), 'week', _fx_at('GBPGHS', p_day - 7)),
    'eur', jsonb_build_object('now', _fx_at('EURGHS', p_day), 'week', _fx_at('EURGHS', p_day - 7)),
    'tbills', jsonb_build_object(
      '91', jsonb_build_object('now', _tbill_at(91, p_day), 'week', _tbill_at(91, p_day - 7), 'month', _tbill_at(91, p_day - 30), 'year', _tbill_at(91, p_day - 365)),
      '182', jsonb_build_object('now', _tbill_at(182, p_day), 'week', _tbill_at(182, p_day - 7), 'month', _tbill_at(182, p_day - 30), 'year', _tbill_at(182, p_day - 365)),
      '364', jsonb_build_object('now', _tbill_at(364, p_day), 'week', _tbill_at(364, p_day - 7), 'month', _tbill_at(364, p_day - 30), 'year', _tbill_at(364, p_day - 365))),
    'policy', pol, 'inflation', infl,
    'gse', jsonb_build_object('now', _gse_at(p_day), 'week', _gse_at(p_day - 7), 'month', _gse_at(p_day - 30), 'year', _gse_at(p_day - 365)),
    'movers', movers, 'commodities', comm, 'gold', gold);
  IF d->'usd'->'now' IS NULL AND d->'gse'->'now' IS NULL THEN RETURN NULL; END IF;
  INSERT INTO reports (kind, edition, period_start, period_end, data)
  VALUES ('economy-scorecard', p_day::text, p_day - 6, p_day, d)
  ON CONFLICT (kind, edition) DO UPDATE SET data = EXCLUDED.data, compiled_at = now();
  RETURN p_day::text;
END $$;

CREATE OR REPLACE FUNCTION public.compile_cedi_report(p_month date DEFAULT (date_trunc('month', now() AT TIME ZONE 'UTC') - interval '1 month')::date)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m0 date := date_trunc('month', p_month)::date; m1 date; d jsonb; pairs jsonb := '{}'; pr text; s jsonb; ed text;
BEGIN
  m1 := (m0 + interval '1 month - 1 day')::date;
  ed := to_char(m0, 'YYYY-MM');
  FOREACH pr IN ARRAY ARRAY['USDGHS','GBPGHS','EURGHS'] LOOP
    WITH r AS (SELECT rate_date, mid FROM bog_fx_rates WHERE pair = pr AND rate_date BETWEEN m0 AND m1)
    SELECT CASE WHEN count(*) = 0 THEN NULL ELSE jsonb_build_object(
      'start', (SELECT jsonb_build_object('value', mid, 'date', rate_date) FROM r ORDER BY rate_date LIMIT 1),
      'end', (SELECT jsonb_build_object('value', mid, 'date', rate_date) FROM r ORDER BY rate_date DESC LIMIT 1),
      'high', (SELECT jsonb_build_object('value', mid, 'date', rate_date) FROM r ORDER BY mid DESC, rate_date LIMIT 1),
      'low', (SELECT jsonb_build_object('value', mid, 'date', rate_date) FROM r ORDER BY mid ASC, rate_date LIMIT 1),
      'days', count(*),
      'prev_month_end', (SELECT jsonb_build_object('value', mid, 'date', rate_date) FROM bog_fx_rates WHERE pair = pr AND rate_date < m0 ORDER BY rate_date DESC LIMIT 1),
      'series', (SELECT jsonb_agg(jsonb_build_array(rate_date, mid) ORDER BY rate_date) FROM r)) END
    INTO s FROM r;
    IF s IS NOT NULL THEN pairs := pairs || jsonb_build_object(pr, s); END IF;
  END LOOP;
  IF NOT pairs ? 'USDGHS' THEN RETURN NULL; END IF;
  d := jsonb_build_object('month', ed, 'pairs', pairs, 'complete', m1 < (now() AT TIME ZONE 'UTC')::date,
    'source', 'Bank of Ghana daily interbank FX rates', 'source_url', 'https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/');
  INSERT INTO reports (kind, edition, period_start, period_end, data) VALUES ('state-of-the-cedi', ed, m0, m1, d)
  ON CONFLICT (kind, edition) DO UPDATE SET data = EXCLUDED.data, compiled_at = now();
  RETURN ed;
END $$;
REVOKE ALL ON FUNCTION public.compile_economy_scorecard(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.compile_cedi_report(date) FROM PUBLIC, anon, authenticated;