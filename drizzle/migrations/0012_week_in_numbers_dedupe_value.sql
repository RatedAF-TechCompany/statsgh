CREATE OR REPLACE FUNCTION public.compile_week_in_numbers(p_day date DEFAULT (now() AT TIME ZONE 'UTC')::date)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_start date := date_trunc('week', p_day)::date;
  v_end date := v_start + 6;
  v_year int := extract(year FROM v_start)::int;
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
      AND replace(e->>'value', ',', '')::numeric <> 0
      AND (e->>'label') !~* '\m(date|day|days|time|hour|year|years|month|edition|anniversary|session|deadline|phone|age|duration|peak|previous|former|historic|record)\M'
      AND coalesce(e->>'unit','') !~* '^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*$|^(years?|days?|months?|weeks?|hours?)$'
      AND coalesce(e->>'context','') !~* 'forecast|projection|target|peak|previous|prior|earlier'
      AND NOT EXISTS (
        SELECT 1 FROM regexp_matches(coalesce(e->>'label','')||' '||coalesce(e->>'context',''), '\m((?:19|20)\d\d)\M', 'g') y(m)
        WHERE y.m[1]::int < v_year - 1
      )
    ORDER BY a.id, x.ord
  ), views AS (
    SELECT v.article_id, count(*) n FROM public.article_views v
    WHERE v.viewed_at >= v_start AND v.viewed_at < v_end + 1 GROUP BY 1
  ), scored AS (
    SELECT s.*, coalesce(v.n, 0) views,
      lower(split_part(btrim(s.label), ' ', 1)) || '|' ||
      (replace(s.val, ',', '')::numeric *
        CASE WHEN coalesce(s.unit,'') ~* 'billion' THEN 1e9 WHEN coalesce(s.unit,'') ~* 'million' THEN 1e6 ELSE 1 END)::text dkey
    FROM stats s LEFT JOIN views v ON v.article_id = s.id
  ), deduped AS (
    SELECT DISTINCT ON (dkey) * FROM scored ORDER BY dkey, views DESC, published_at DESC
  ), ranked AS (
    SELECT * FROM deduped ORDER BY views DESC, published_at DESC LIMIT 10
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