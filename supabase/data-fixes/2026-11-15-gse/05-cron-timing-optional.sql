-- StatsGH: OPTIONAL GSE cron timing change. PREPARED 15 Nov 2026, NOT RUN. Only useful together with the gse-scrape code fix
-- (5-day window); on its own it narrows but does not close the race. Times are GMT (= UTC, Europe/London in winter).
-- Evidence: GSE's last trade time on 13 Nov was 15:57 UTC; our 16:00 GMT run often saw only the previous day
--   (e.g. index rows are stored one day late: 10 Nov fetched 11 Nov 16:00, 6 Nov fetched 9 Nov 16:00).
-- Before: jobid 14 statsgh-gse-weekdays '0 16 * * 1-5'; jobid 16 statsgh-gse-week-fri '30 17 * * 5' (compile_gse_week).
select cron.alter_job(14, schedule := '0 17 * * 1-5');                            -- main run 17:00 GMT Mon–Fri
select cron.schedule('statsgh-gse-catchup', '0 9 * * 2-6',
  (select command from cron.job where jobid = 14));                              -- next-morning catch-up, same call, no secrets inline
select cron.alter_job(16, schedule := '30 9 * * 6');                             -- weekly compile Sat 09:30 GMT, after the catch-up
-- ROLLBACK: select cron.alter_job(14, schedule := '0 16 * * 1-5'); select cron.alter_job(16, schedule := '30 17 * * 5');
--           select cron.unschedule('statsgh-gse-catchup');
-- Note: compile_gse_week(current_date) on Saturday still resolves to the Mon–Sun week just ended (date_trunc('week')).
