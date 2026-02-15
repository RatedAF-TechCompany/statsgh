-- Schedule research-scan to run every 6 hours at the 30-minute mark
SELECT cron.schedule(
  'research-scan-every-6h',
  '30 */6 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ofhejtwaigiqyejbvncz.supabase.co/functions/v1/research-scan',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maGVqdHdhaWdpcXllamJ2bmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTE1NjUsImV4cCI6MjA3ODg2NzU2NX0.l01PfzD7KDaGQJKRoLFxoBuA46z8OsAM7F0Xc4DTLEo"}'::jsonb,
    body := '{"freshness_days": 7, "max_items": 20}'::jsonb
  );
  $$
);