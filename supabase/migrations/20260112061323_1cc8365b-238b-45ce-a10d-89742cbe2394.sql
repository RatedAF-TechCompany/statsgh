-- Update the cron job to run every 20 minutes instead of hourly
SELECT cron.unschedule('newsroom-hourly-scan');

SELECT cron.schedule(
  'newsroom-20min-scan',
  '*/20 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/newsroom-scheduled',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{"triggerType": "scheduled"}'::jsonb
  );
  $$
);