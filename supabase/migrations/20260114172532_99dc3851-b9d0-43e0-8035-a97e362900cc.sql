-- Schedule the newsroom scan to run every hour
-- Using the cron schema which is pre-installed in Supabase
SELECT cron.schedule(
  'newsroom-hourly-scan',
  '0 * * * *',
  $$SELECT public.trigger_newsroom_scan()$$
);