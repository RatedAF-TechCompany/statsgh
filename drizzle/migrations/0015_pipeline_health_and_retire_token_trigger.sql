CREATE OR REPLACE FUNCTION public.trigger_newsroom_scan()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  -- Retired: the query-token trigger was removed. Scheduled scans use the
  -- newsroom-15min-scan pg_cron job or the authenticated newsroom-scheduled function.
  RAISE LOG 'trigger_newsroom_scan is retired';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.trigger_newsroom_scan() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.pipeline_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL CHECK (status IN ('ok','stale','runs_failing','stale_and_failing')),
  last_published_at timestamptz,
  hours_since_publish numeric,
  in_active_window boolean NOT NULL,
  last_run_status text,
  last_run_at timestamptz,
  consecutive_failed_runs integer NOT NULL DEFAULT 0,
  notes text
);
CREATE INDEX pipeline_health_checked_at_idx ON public.pipeline_health (checked_at DESC);
GRANT SELECT ON public.pipeline_health TO authenticated;
GRANT ALL ON public.pipeline_health TO service_role;
ALTER TABLE public.pipeline_health ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read pipeline health" ON public.pipeline_health FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));