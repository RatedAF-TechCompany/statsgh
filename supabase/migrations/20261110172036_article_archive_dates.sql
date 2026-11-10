-- Date archive: one grouped count of published articles per Africa/Accra calendar day.
-- Adds an index and two functions only. No rows are updated or deleted.
--
-- Africa/Accra is GMT (UTC+0) all year, with no daylight-saving transition, so the
-- UTC calendar date is the Accra calendar date. timestamptz AT TIME ZONE is STABLE,
-- which cannot be indexed, so the expression lives in a plpgsql IMMUTABLE wrapper
-- (plpgsql is not inlined, so the planner trusts the volatility label).

CREATE OR REPLACE FUNCTION public.article_published_on_accra(p_published_at timestamptz)
RETURNS date
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
AS $$
BEGIN
  RETURN (p_published_at AT TIME ZONE 'UTC')::date;
END;
$$;

COMMENT ON FUNCTION public.article_published_on_accra(timestamptz) IS
  'Publication calendar date in Africa/Accra (GMT, UTC+0, no daylight saving).';

CREATE INDEX IF NOT EXISTS idx_articles_published_on_accra
  ON public.articles (public.article_published_on_accra(published_at))
  WHERE is_published AND published_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.archive_publication_days()
RETURNS TABLE(published_on date, article_count bigint)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT public.article_published_on_accra(published_at) AS published_on,
         count(*)::bigint AS article_count
  FROM public.articles
  WHERE is_published
    AND published_at IS NOT NULL
  GROUP BY 1
  ORDER BY 1 DESC;
$$;

COMMENT ON FUNCTION public.archive_publication_days() IS
  'Published article counts by Africa/Accra calendar day. Respects RLS.';

REVOKE ALL ON FUNCTION public.article_published_on_accra(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.article_published_on_accra(timestamptz) TO anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.archive_publication_days() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.archive_publication_days() TO anon, authenticated, service_role;
