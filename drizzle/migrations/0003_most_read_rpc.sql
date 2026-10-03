CREATE OR REPLACE FUNCTION public.get_most_read_counts(p_since timestamptz, p_limit int DEFAULT 10)
RETURNS TABLE(article_id uuid, views bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT v.article_id, count(*)::bigint
  FROM public.article_views v JOIN public.articles a ON a.id = v.article_id AND a.is_published = true
  WHERE v.viewed_at >= p_since
  GROUP BY v.article_id ORDER BY count(*) DESC LIMIT LEAST(GREATEST(p_limit,1),50)
$$;
GRANT EXECUTE ON FUNCTION public.get_most_read_counts(timestamptz, int) TO anon, authenticated;