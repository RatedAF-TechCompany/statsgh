select cron.schedule('statsgh-newsroom-uk-07-11-15-19', '0 * * * *', $$
  select net.http_post(
    url := 'https://rscqxztgtpcifcqxjskh.supabase.co/functions/v1/newsroom-scheduled',
    headers := private.scheduler_headers(),
    body := '{"triggerType":"scheduled"}'::jsonb,
    timeout_milliseconds := 10000)
  where extract(hour from now() at time zone 'Europe/London') in (7,11,15,19);
$$);
select cron.schedule('ghanacrimes-ingest-uk-08-14-20', '0 * * * *', $$
  select net.http_post(
    url := 'https://rscqxztgtpcifcqxjskh.supabase.co/functions/v1/gc-source-ingest',
    headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='ingest_cron_secret')),
    body := '{"trigger":"cron"}'::jsonb,
    timeout_milliseconds := 10000)
  where extract(hour from now() at time zone 'Europe/London') in (8,14,20);
$$);
select jobname, schedule from cron.job;
