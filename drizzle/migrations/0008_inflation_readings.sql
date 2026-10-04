CREATE TABLE public.inflation_readings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('headline','food','non_food')),
  period date NOT NULL,
  value numeric NOT NULL,
  article_id uuid REFERENCES public.articles(id) ON DELETE SET NULL,
  article_slug text,
  category_slug text,
  article_title text,
  article_published_at timestamptz,
  source_count integer NOT NULL DEFAULT 1,
  extracted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kind, period)
);
GRANT SELECT ON public.inflation_readings TO anon, authenticated;
GRANT ALL ON public.inflation_readings TO service_role;
ALTER TABLE public.inflation_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read inflation readings" ON public.inflation_readings FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.refresh_inflation_readings()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.inflation_readings WHERE true;
  WITH raw AS (
    SELECT a.id, a.slug, a.category_slug, a.title, a.published_at,
           coalesce(e->>'label','') l, coalesce(e->>'context','') c,
           coalesce(e->>'unit','') u, e->>'value' v
    FROM public.articles a,
         jsonb_array_elements(CASE WHEN jsonb_typeof(a.key_data)='array' THEN a.key_data ELSE '[]'::jsonb END) e
    WHERE a.is_published = true AND a.published_at IS NOT NULL AND (e->>'label') ~* 'inflation'
  ), cleaned AS (
    SELECT *,
      regexp_match(l||' '||c, '(january|february|march|april|may|june|july|august|september|october|november|december)\s+(20\d\d)', 'i') m,
      lower(btrim(regexp_replace(regexp_replace(regexp_replace(l,
        '(january|february|march|april|may|june|july|august|september|october|november|december)\s+20\d\d','','gi'),
        '[()]','','g'),'\s+',' ','g'))) cl
    FROM raw
  ), typed AS (
    SELECT *,
      CASE
        WHEN cl IN ('non-food inflation','non food inflation','non-food inflation rate','non-food inflation year-on-year') THEN 'non_food'
        WHEN cl IN ('food inflation','food inflation rate','food inflation year-on-year') THEN 'food'
        WHEN cl IN ('inflation','inflation rate','headline inflation','headline inflation rate','cpi inflation',
                    'consumer price inflation','annual inflation','year-on-year inflation','consumer price index inflation',
                    'headline consumer price inflation','inflation year-on-year') THEN 'headline'
      END kind,
      to_date(m[1]||' '||m[2], 'Month YYYY') period,
      nullif(regexp_replace(v, '[^0-9.\-]', '', 'g'), '')::numeric val
    FROM cleaned
    WHERE m IS NOT NULL AND btrim(u) = '%' AND v ~ '^\s*-?\d+(\.\d+)?\s*%?\s*$'
      AND c !~* 'forecast|projection|projected|target|expected|peak|estimate|month-on-month'
  ), valid AS (
    SELECT * FROM typed
    WHERE kind IS NOT NULL AND val BETWEEN -10 AND 100
      AND period <= date_trunc('month', published_at)::date
      AND period >= (date_trunc('month', published_at) - interval '4 months')::date
  ), votes AS (
    SELECT kind, period, val, count(DISTINCT id) cnt, max(published_at) latest FROM valid GROUP BY 1,2,3
  ), best AS (
    SELECT DISTINCT ON (kind, period) kind, period, val, cnt FROM votes ORDER BY kind, period, cnt DESC, latest DESC
  ), src AS (
    SELECT DISTINCT ON (b.kind, b.period) b.*, v.id, v.slug, v.category_slug, v.title, v.published_at
    FROM best b JOIN valid v ON v.kind=b.kind AND v.period=b.period AND v.val=b.val
    ORDER BY b.kind, b.period, v.published_at ASC
  )
  INSERT INTO public.inflation_readings(kind, period, value, article_id, article_slug, category_slug, article_title, article_published_at, source_count)
  SELECT kind, period, val, id, slug, category_slug, title, published_at, cnt FROM src;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.refresh_inflation_readings() FROM PUBLIC, anon, authenticated;
SELECT public.refresh_inflation_readings();