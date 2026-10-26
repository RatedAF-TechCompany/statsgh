select cron.schedule('statsgh-market-data-3h', '5 */3 * * *', $$ select net.http_post(url:='https://rscqxztgtpcifcqxjskh.supabase.co/functions/v1/market-data-refresh', headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer <ANON_KEY>'), body:='{}'::jsonb, timeout_milliseconds:=10000) $$);
select cron.schedule('statsgh-bog-rates-weekdays', '30 10,16 * * 1-5', $$ select net.http_post(url:='https://rscqxztgtpcifcqxjskh.supabase.co/functions/v1/bog-rates-scrape', headers:=private.scheduler_headers(), body:='{}'::jsonb, timeout_milliseconds:=10000) $$);
select cron.schedule('statsgh-gse-weekdays', '0 16 * * 1-5', $$ select net.http_post(url:='https://rscqxztgtpcifcqxjskh.supabase.co/functions/v1/gse-scrape', headers:=private.scheduler_headers(), body:='{}'::jsonb, timeout_milliseconds:=10000) $$);
select cron.schedule('statsgh-economy-scorecard-daily', '0 17 * * *', $$ select public.compile_economy_scorecard(current_date) $$);
select cron.schedule('statsgh-gse-week-fri', '30 17 * * 5', $$ select public.compile_gse_week(current_date) $$);
select cron.schedule('statsgh-week-in-numbers-sun', '0 18 * * 0', $$ select public.compile_week_in_numbers(current_date) $$);
select cron.schedule('statsgh-cedi-report-monthly', '0 6 1 * *', $$ select public.compile_cedi_report((date_trunc('month', current_date) - interval '1 month')::date) $$);
select jobname, schedule from cron.job order by jobid;
