ALTER TABLE public.articles ADD COLUMN IF NOT EXISTS why_it_matters text;

CREATE TABLE public.week_in_numbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  week_end date NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  compiled_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.week_in_numbers TO anon, authenticated;
GRANT ALL ON public.week_in_numbers TO service_role;
ALTER TABLE public.week_in_numbers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read week in numbers" ON public.week_in_numbers FOR SELECT TO anon, authenticated USING (true);

-- Compiles the Monday–Sunday week containing p_day (UTC): one top stat per article, ranked by views.
CREATE OR REPLACE FUNCTION public.compile_week_in_numbers(p_day date DEFAULT (now() AT TIME ZONE 'UTC')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_start date := date_trunc('week', p_day)::date;
  v_end date := v_start + 6;
  v_items jsonb;
BEGIN
  WITH arts AS (
    SELECT a.id, a.slug, a.category_slug, a.title, a.published_at, a.key_data
    FROM public.articles a
    WHERE a.is_published = true AND a.published_at >= v_start AND a.published_at < v_end + 1
  ), stats AS (
    SELECT DISTINCT ON (a.id) a.id, a.slug, a.category_slug, a.title, a.published_at,
      e->>'label' label, e->>'value' val, e->>'unit' unit, e->>'context' context
    FROM arts a, jsonb_array_elements(CASE WHEN jsonb_typeof(a.key_data)='array' THEN a.key_data ELSE '[]'::jsonb END) WITH ORDINALITY x(e, ord)
    WHERE coalesce(e->>'label','') <> ''
      AND replace(coalesce(e->>'value',''), ',', '') ~ '^-?\d+(\.\d+)?$'
      AND (e->>'label') !~* '\m(date|day|days|time|hour|year|years|month|edition|anniversary|session|deadline|phone|age|duration)\M'
      AND coalesce(e->>'unit','') !~* '^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$|^(years?|days?|months?|weeks?|hours?)$'
      AND coalesce(e->>'context','') !~* 'forecast|projection|target|peak'
    ORDER BY a.id, x.ord
  ), views AS (
    SELECT v.article_id, count(*) n FROM public.article_views v
    WHERE v.viewed_at >= v_start AND v.viewed_at < v_end + 1 GROUP BY 1
  ), ranked AS (
    SELECT s.*, coalesce(v.n, 0) views FROM stats s LEFT JOIN views v ON v.article_id = s.id
    ORDER BY coalesce(v.n, 0) DESC, s.published_at DESC LIMIT 10
  )
  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'article_id', id, 'slug', slug, 'category_slug', category_slug, 'title', title,
    'published_at', published_at, 'label', label, 'value', val, 'unit', unit,
    'context', context, 'views', views) ORDER BY views DESC, published_at DESC), '[]'::jsonb)
  INTO v_items FROM ranked;

  INSERT INTO public.week_in_numbers(week_start, week_end, items, compiled_at)
  VALUES (v_start, v_end, v_items, now())
  ON CONFLICT (week_start) DO UPDATE SET items = EXCLUDED.items, compiled_at = now(), week_end = EXCLUDED.week_end;
  RETURN jsonb_array_length(v_items);
END $$;
REVOKE ALL ON FUNCTION public.compile_week_in_numbers(date) FROM PUBLIC, anon, authenticated;