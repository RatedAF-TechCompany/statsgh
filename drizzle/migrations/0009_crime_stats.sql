CREATE TABLE public.crime_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
  article_slug text NOT NULL,
  category_slug text NOT NULL,
  article_title text NOT NULL,
  published_at timestamptz NOT NULL,
  metric text NOT NULL CHECK (metric IN ('arrests','convictions','cases','amount','people')),
  label text NOT NULL,
  context text,
  value numeric NOT NULL,
  unit text,
  currency text,
  region text,
  extracted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crime_stats_published_idx ON public.crime_stats (published_at DESC);
GRANT SELECT ON public.crime_stats TO anon, authenticated;
GRANT ALL ON public.crime_stats TO service_role;
ALTER TABLE public.crime_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read crime stats" ON public.crime_stats FOR SELECT TO anon, authenticated USING (true);

CREATE OR REPLACE FUNCTION public.refresh_crime_stats()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  DELETE FROM public.crime_stats WHERE true;
  WITH arts AS (
    SELECT a.* FROM public.articles a
    WHERE a.is_published = true AND a.published_at IS NOT NULL
      AND (a.section = 'crime-justice' OR a.tags && ARRAY['crime','justice'])
  ), reg AS (
    SELECT a.id,
      CASE
        WHEN t ~* 'greater accra|\maccra\M|\mtema\M|kasoa' AND t !~* 'kasoa' THEN 'Greater Accra'
        WHEN t ~* 'ashanti|kumasi|obuasi' THEN 'Ashanti'
        WHEN t ~* 'western north|sefwi' THEN 'Western North'
        WHEN t ~* 'western region|takoradi|sekondi|tarkwa' THEN 'Western'
        WHEN t ~* 'central region|cape coast|kasoa|winneba' THEN 'Central'
        WHEN t ~* 'eastern region|koforidua' THEN 'Eastern'
        WHEN t ~* 'volta region|\mhohoe\M' THEN 'Volta'
        WHEN t ~* '\moti region' THEN 'Oti'
        WHEN t ~* 'northern region|tamale' THEN 'Northern'
        WHEN t ~* 'savannah region|damongo' THEN 'Savannah'
        WHEN t ~* 'north east region|nalerigu' THEN 'North East'
        WHEN t ~* 'upper east|bolgatanga|bawku' THEN 'Upper East'
        WHEN t ~* 'upper west' THEN 'Upper West'
        WHEN t ~* 'bono east|techiman' THEN 'Bono East'
        WHEN t ~* 'ahafo region' THEN 'Ahafo'
        WHEN t ~* 'bono region|sunyani' THEN 'Bono'
      END region
    FROM (SELECT id, coalesce(title,'')||' '||coalesce(summary,'') t FROM arts) a
  ), raw AS (
    SELECT a.id, a.slug, a.category_slug, a.title, a.published_at, r.region,
      coalesce(e->>'label','') l, coalesce(e->>'context','') c, coalesce(e->>'unit','') u,
      nullif(regexp_replace(coalesce(e->>'value',''), '[^0-9.]', '', 'g'), '') vs
    FROM arts a JOIN reg r ON r.id = a.id,
      jsonb_array_elements(CASE WHEN jsonb_typeof(a.key_data)='array' THEN a.key_data ELSE '[]'::jsonb END) e
  ), typed AS (
    SELECT *,
      CASE
        WHEN (l||' '||u) ~* 'age|year|date|duration|deadline|day|week|month|hour|%|per ?cent|point|score|index|megawatt|capacity|litre|ounce|kilogram|tonne|vote|adjourn'
          THEN NULL
        WHEN (l||' '||u) ~* 'ghs|cedi|gh₵|us\$|usd|dollar|€|£' OR u ~* '^(million|billion|thousand)$' AND (l ~* 'amount|value|loss|fraud|stolen|bribe|recover|fund|sum|irregular')
          THEN 'amount'
        WHEN (l||' '||u) ~* 'arrest|suspect|detain' THEN 'arrests'
        WHEN (l||' '||u) ~* 'convict|sentenc|jailed|guilty' THEN 'convictions'
        WHEN (l||' '||u) ~* 'case|charge|count|investigat|prosecut|docket|petition|complaint|incident|robber|murder|killing' THEN 'cases'
        WHEN u ~* 'personnel|people|persons|individuals|victims|officers|accused|defendants' THEN 'people'
      END metric
    FROM raw WHERE vs ~ '^\d+(\.\d+)?$'
  )
  INSERT INTO public.crime_stats(article_id, article_slug, category_slug, article_title, published_at, metric, label, context, value, unit, currency, region)
  SELECT id, slug, category_slug, title, published_at, metric, l, nullif(c,''),
    vs::numeric * CASE WHEN metric='amount' AND u ~* 'billion' THEN 1e9 WHEN metric='amount' AND u ~* 'million' THEN 1e6 WHEN metric='amount' AND u ~* 'thousand' THEN 1e3 ELSE 1 END,
    nullif(u,''),
    CASE WHEN metric <> 'amount' THEN NULL WHEN (l||' '||u) ~* 'us\$|usd|dollar' THEN 'USD' WHEN (l||' '||u) ~* '€|euro' THEN 'EUR' WHEN (l||' '||u) ~* '£|pound' THEN 'GBP' ELSE 'GHS' END,
    region
  FROM typed WHERE metric IS NOT NULL AND vs::numeric > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.refresh_crime_stats() FROM PUBLIC, anon, authenticated;
SELECT public.refresh_crime_stats();