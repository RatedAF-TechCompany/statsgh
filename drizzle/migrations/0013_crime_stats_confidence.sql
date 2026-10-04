ALTER TABLE public.crime_stats
  ADD COLUMN IF NOT EXISTS confidence text NOT NULL DEFAULT 'medium',
  ADD COLUMN IF NOT EXISTS confidence_reason text,
  ADD COLUMN IF NOT EXISTS region_source text,
  ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS hidden_reason text;
ALTER TABLE public.crime_stats ADD CONSTRAINT crime_stats_confidence_chk CHECK (confidence IN ('high','medium','low'));
ALTER TABLE public.crime_stats ADD CONSTRAINT crime_stats_region_source_chk CHECK (region_source IS NULL OR region_source IN ('explicit','inferred'));

-- Never deletes: re-derives figures, updates matching rows, inserts new ones,
-- and flags rows that no longer qualify as hidden.
CREATE OR REPLACE FUNCTION public.refresh_crime_stats()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n integer;
BEGIN
  CREATE TEMP TABLE _cs ON COMMIT DROP AS
  WITH arts AS (
    SELECT a.id, a.slug, a.category_slug, a.title, a.published_at, a.key_data,
      coalesce(a.title,'')||' '||coalesce(a.summary,'') ts,
      coalesce(a.title,'')||' '||coalesce(a.summary,'')||' '||coalesce(a.body,'') tb
    FROM public.articles a
    WHERE a.is_published = true AND a.published_at IS NOT NULL
      AND (a.section = 'crime-justice' OR a.tags && ARRAY['crime','justice'])
  ), reg AS (
    SELECT id,
      -- explicit: the article names the region itself
      CASE
        WHEN tb ~* 'greater accra' THEN 'Greater Accra'
        WHEN tb ~* 'ashanti region' THEN 'Ashanti'
        WHEN tb ~* 'western north region' THEN 'Western North'
        WHEN tb ~* 'western region' THEN 'Western'
        WHEN tb ~* 'central region' THEN 'Central'
        WHEN tb ~* 'eastern region' THEN 'Eastern'
        WHEN tb ~* 'volta region' THEN 'Volta'
        WHEN tb ~* '\moti region' THEN 'Oti'
        WHEN tb ~* 'north east region' THEN 'North East'
        WHEN tb ~* 'northern region' THEN 'Northern'
        WHEN tb ~* 'savannah region' THEN 'Savannah'
        WHEN tb ~* 'upper east region' THEN 'Upper East'
        WHEN tb ~* 'upper west region' THEN 'Upper West'
        WHEN tb ~* 'bono east region' THEN 'Bono East'
        WHEN tb ~* 'ahafo region' THEN 'Ahafo'
        WHEN tb ~* 'bono region' THEN 'Bono'
      END explicit_region,
      -- inferred: only a town/city in the headline or summary
      CASE
        WHEN ts ~* '\maccra\M|\mtema\M|\mmadina\M|\mashaiman\M' THEN 'Greater Accra'
        WHEN ts ~* 'kumasi|obuasi|ejisu' THEN 'Ashanti'
        WHEN ts ~* 'sefwi|bibiani' THEN 'Western North'
        WHEN ts ~* 'takoradi|sekondi|tarkwa|prestea' THEN 'Western'
        WHEN ts ~* 'cape coast|kasoa|winneba' THEN 'Central'
        WHEN ts ~* 'koforidua|nkawkaw' THEN 'Eastern'
        WHEN ts ~* '\mhohoe\M|\maflao\M' THEN 'Volta'
        WHEN ts ~* 'tamale|yendi' THEN 'Northern'
        WHEN ts ~* 'damongo' THEN 'Savannah'
        WHEN ts ~* 'nalerigu' THEN 'North East'
        WHEN ts ~* 'bolgatanga|bawku' THEN 'Upper East'
        WHEN ts ~* 'techiman|kintampo' THEN 'Bono East'
        WHEN ts ~* 'sunyani' THEN 'Bono'
      END inferred_region,
      (tb ~* 'ghana|accra|kumasi|cedi|GH₵|ghs|EOCO|special prosecutor|\mOSP\M|CHRAJ|parliament of ghana|ghana police') is_ghana
    FROM arts
  ), raw AS (
    SELECT a.id, a.slug, a.category_slug, a.title, a.published_at, r.explicit_region, r.inferred_region, r.is_ghana,
      coalesce(e->>'label','') l, coalesce(e->>'context','') c, coalesce(e->>'unit','') u,
      nullif(regexp_replace(coalesce(e->>'value',''), '[^0-9.]', '', 'g'), '') vs
    FROM arts a JOIN reg r ON r.id = a.id,
      jsonb_array_elements(CASE WHEN jsonb_typeof(a.key_data)='array' THEN a.key_data ELSE '[]'::jsonb END) e
  ), typed AS (
    SELECT *,
      CASE
        WHEN (l||' '||u) ~* 'age|year|date|duration|deadline|day|week|month|hour|%|per ?cent|point|score|index|megawatt|capacity|litre|ounce|kilogram|tonne|vote|adjourn' THEN NULL
        WHEN (l||' '||u) ~* 'ghs|cedi|gh₵|us\$|usd|dollar|€|£' OR u ~* '^(million|billion|thousand)$' AND (l ~* 'amount|value|loss|fraud|stolen|bribe|recover|fund|sum|irregular') THEN 'amount'
        WHEN (l||' '||u) ~* 'arrest|suspect|detain' THEN 'arrests'
        WHEN (l||' '||u) ~* 'convict|sentenc|jailed|guilty' THEN 'convictions'
        WHEN (l||' '||u) ~* 'case|charge|count|investigat|prosecut|docket|petition|complaint|incident|robber|murder|killing' THEN 'cases'
        WHEN u ~* 'personnel|people|persons|individuals|victims|officers|accused|defendants' THEN 'people'
      END metric,
      (l||' '||c) ~* 'arrest|suspect|detain|remand|convict|sentenc|jail|prison|charge|bail|fraud|defraud|scam|stolen|theft|steal|robb|burglar|bribe|extort|embezzl|launder|ransom|recover|seiz|forfeit|confiscat|financial loss|loss to the state|murder|kill|homicide|victim|prosecut|investigat|court|fine\M|damages|smuggl|galamsey|illegal|corrupt|misappropriat|kidnap|assault|trafficking|narcotic|drug' strong,
      (l||' '||c) ~* 'budget|allocation|revenue|investment|project value|facilit|contract sum|salary|salaries|wage|earnings|income|price|fee\M|fees|donation|gdp|inflation|policy rate|capacity|population|turnout|share|score|cost of|spending|expenditure|tariff|levy|loan|grant|insurance|daily|monthly|annual|gate|vehicle value|property value|asset value' weak
    FROM raw WHERE vs ~ '^\d+(\.\d+)?$'
  )
  SELECT id article_id, slug article_slug, category_slug, title article_title, published_at,
    metric, l label, nullif(c,'') context,
    vs::numeric * CASE WHEN metric='amount' AND u ~* 'billion' THEN 1e9 WHEN metric='amount' AND u ~* 'million' THEN 1e6 WHEN metric='amount' AND u ~* 'thousand' THEN 1e3 ELSE 1 END value,
    nullif(u,'') unit,
    CASE WHEN metric <> 'amount' THEN NULL WHEN (l||' '||u) ~* 'us\$|usd|dollar' THEN 'USD' WHEN (l||' '||u) ~* '€|euro' THEN 'EUR' WHEN (l||' '||u) ~* '£|pound' THEN 'GBP' ELSE 'GHS' END currency,
    coalesce(explicit_region, inferred_region) region,
    CASE WHEN explicit_region IS NOT NULL THEN 'explicit' WHEN inferred_region IS NOT NULL THEN 'inferred' END region_source,
    CASE
      WHEN NOT is_ghana THEN 'low'
      WHEN weak AND NOT strong THEN 'low'
      WHEN weak THEN 'medium'
      WHEN strong THEN 'high'
      WHEN metric IN ('arrests','convictions') THEN 'high'
      ELSE 'medium'
    END confidence,
    CASE
      WHEN NOT is_ghana THEN 'No clear Ghana reference in the article'
      WHEN weak AND NOT strong THEN 'Figure looks like a budget, price or general statistic, not a crime/justice fact'
      WHEN weak THEN 'Mixed signals: crime wording alongside budget/price wording'
      WHEN strong THEN 'Label or context names a crime/justice fact'
      WHEN metric IN ('arrests','convictions') THEN 'Arrest or conviction count'
      ELSE 'No explicit crime/justice wording in label or context'
    END confidence_reason
  FROM typed WHERE metric IS NOT NULL AND vs::numeric > 0;

  UPDATE public.crime_stats s SET
    article_slug = t.article_slug, category_slug = t.category_slug, article_title = t.article_title,
    published_at = t.published_at, metric = t.metric, unit = t.unit, currency = t.currency,
    region = t.region, region_source = t.region_source, confidence = t.confidence,
    confidence_reason = t.confidence_reason, is_hidden = false, hidden_reason = NULL, extracted_at = now()
  FROM _cs t
  WHERE s.article_id = t.article_id AND s.label = t.label AND s.value = t.value
    AND coalesce(s.context,'') = coalesce(t.context,'');

  INSERT INTO public.crime_stats(article_id, article_slug, category_slug, article_title, published_at, metric, label, context, value, unit, currency, region, region_source, confidence, confidence_reason)
  SELECT t.article_id, t.article_slug, t.category_slug, t.article_title, t.published_at, t.metric, t.label, t.context, t.value, t.unit, t.currency, t.region, t.region_source, t.confidence, t.confidence_reason
  FROM _cs t
  WHERE NOT EXISTS (
    SELECT 1 FROM public.crime_stats s
    WHERE s.article_id = t.article_id AND s.label = t.label AND s.value = t.value AND coalesce(s.context,'') = coalesce(t.context,'')
  );

  UPDATE public.crime_stats s SET is_hidden = true, hidden_reason = 'No longer matches extraction rules or article unpublished'
  WHERE NOT s.is_hidden AND NOT EXISTS (
    SELECT 1 FROM _cs t
    WHERE s.article_id = t.article_id AND s.label = t.label AND s.value = t.value AND coalesce(s.context,'') = coalesce(t.context,'')
  );

  SELECT count(*) INTO n FROM public.crime_stats WHERE NOT is_hidden;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.refresh_crime_stats() FROM PUBLIC, anon, authenticated;