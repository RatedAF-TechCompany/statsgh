ALTER TABLE public.newsroom_articles DROP CONSTRAINT IF EXISTS newsroom_articles_processing_status_check;
ALTER TABLE public.newsroom_articles ADD CONSTRAINT newsroom_articles_processing_status_check CHECK (processing_status IN ('pending','pending_ai','processing','completed','failed','duplicate','rejected'));

CREATE OR REPLACE FUNCTION public.trigger_newsroom_scan()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  headers jsonb;
  project_url text;
BEGIN
  -- Resolve deployment URL from the installed job, never store credentials in migration history.
  SELECT substring(command from 'https://[^''[:space:]]+/functions/v1/') INTO project_url
  FROM cron.job WHERE command LIKE '%/functions/v1/newsroom-%' ORDER BY jobid LIMIT 1;
  IF project_url IS NULL THEN RAISE EXCEPTION 'Newsroom scheduler endpoint is not configured'; END IF;
  headers := private.scheduler_headers();
  IF coalesce(headers->>'Authorization', '') = '' THEN RAISE EXCEPTION 'Newsroom scheduler authentication is not configured'; END IF;
  PERFORM net.http_post(url := project_url || 'newsroom-scheduled', headers := headers,
    body := '{"triggerType":"scheduled"}'::jsonb, timeout_milliseconds := 60000);
END;
$$;
REVOKE ALL ON FUNCTION public.trigger_newsroom_scan() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_newsroom_scan() TO service_role;
COMMENT ON FUNCTION public.trigger_newsroom_scan() IS 'Authenticated scheduled newsroom callback; uses the existing private scheduler credential without exposing it.';