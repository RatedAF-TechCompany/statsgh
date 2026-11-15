-- StatsGH: recompute stored GSE weekly summaries after 01 (index fix) and 02 (price backfill). Schema public ONLY.
-- PREPARED 15 Nov 2026 by StatsGH Web. NOT RUN. Run only after 01 and 02 have both committed.
-- Only stored derived data is week_in_numbers.gse (written by compile_gse_week). Everything else is computed at request time.
-- Also includes the week of 26 Oct: it was compiled on 1 Nov 18:00 GMT, before the 30 Oct prices were stored (2 Nov 16:00 GMT),
-- so it still ends on 29 Oct.
-- Expected results (read-only simulation, 15 Nov 2026; current values in brackets):
--   w/c 26 Oct: 26 Oct -> 30 Oct, 5 days, CI 14,014.16 -> 14,302.27 (+2.06%)   [was 26->29 Oct, 4 days, ->14,246.71]
--      gainers SIC +10.38, GCB +4.62, GOIL +4.56 [GCB +8.58, GOIL +4.56, MTNGH +2.77]; losers HORDS -6.25, SOGEGH -3.54, DIGICUT -2.50 [HORDS, SOGEGH -3.75, TOTAL -2.44]
--   w/c 2 Nov:  2 Nov -> 6 Nov, 5 days, CI 14,286.89 -> 14,000.37 (-2.01%)    [was 3->6 Nov, 4 days, from 14,155.02]
--      gainers CPC +28.95, MMH +14.29, DASPHARMA +11.83; losers TOTAL -12.98, DIGICUT -10.26, FML -7.08
--   w/c 9 Nov:  9 Nov -> 13 Nov, 5 days, CI 14,010.02 -> 13,960.40 (-0.35%)   [was 10->13 Nov, 4 days, from 13,944.00]
--      gainers CPC +30.19, DIGICUT +11.43, SIC +2.97; losers HORDS -17.57, FAB -9.52, SOGEGH -4.97 (losers unchanged)
begin;
create table if not exists public.week_in_numbers_backup_20261115b as table public.week_in_numbers with no data;
insert into public.week_in_numbers_backup_20261115b select * from public.week_in_numbers w
  where w.week_start in ('2026-10-26','2026-11-02','2026-11-09')
    and not exists (select 1 from public.week_in_numbers_backup_20261115b b where b.week_start = w.week_start);
alter table public.week_in_numbers_backup_20261115b enable row level security;
revoke all on public.week_in_numbers_backup_20261115b from anon, authenticated;

select public.compile_gse_week('2026-10-26'), public.compile_gse_week('2026-11-02'), public.compile_gse_week('2026-11-09');  -- expect 5, 5, 5
select week_start, gse->>'from' f, gse->>'to' t, gse->>'trading_days' d, gse->>'ci_start' s, gse->>'ci_end' e,
       gse->'gainers' g, gse->'losers' l from public.week_in_numbers where week_start in ('2026-10-26','2026-11-02','2026-11-09') order by 1;
commit;
-- ROLLBACK: update public.week_in_numbers w set gse = b.gse from public.week_in_numbers_backup_20261115b b where b.week_start = w.week_start;

-- AFTER (no SQL): pages revalidate on their own TTL (<= ~10 min ISR + edge cache). If faster is needed, bump CACHE_GEN 9 -> 10
-- on the next approved Worker deploy. Then spot-check: /markets/gse (chart no 503,067 spike), /indicators/gse-composite-index,
-- /data-vault/gse-index (CSV row 2 Nov), /markets/gse/MTNGH and /markets/gse/KASA (history now has 2, 9, 11 Nov), /week-in-numbers.
