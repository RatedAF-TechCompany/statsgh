-- StatsGH: correct the GSE Composite Index for Mon 2 Nov 2026 in public.gse_index_daily. Schema public ONLY.
-- PREPARED 15 Nov 2026 by StatsGH Web. NOT RUN. Needs Zeb's go-ahead (production data write). Run BEFORE 03-recompute.sql.
-- Fault: stored gse_ci = 503067, which is that day's VOLUME (503,067 shares). The fault is upstream: GSE's own "Index" table
--   (wpDataTables id 47 on https://gse.com.gh/trading-and-data/) shows row 821, Monday 02/11/2026: volume 503,067.00,
--   GSE-CI 503,067.00, market cap GH¢267,946.42m, GSE-FSI 7,388.15. GSE publishes no separate daily report for 2 Nov
--   (its Market Reports page carries monthly reports only; November's is not out yet).
-- Correct GSE-CI 14,286.89 for 2 Nov 2026, from two independent published secondary sources:
--   1) SIC Brokerage Morning Brief, 4 Nov 2026 (previous-level column = 2 Nov close): GSE-CI 14,286.89; GSE-FSI 7,388.15;
--      market cap GH¢267,946.42m; volume 503,067; value GH¢2,954,318.17.
--      https://mail.sicbrokerage.com/files/research/MORNING_BRIEF_04.11.2026.pdf_2026-11-04.pdf
--   2) GSE trading summary for 2 Nov 2026 as reposted on LinkedIn: GSE-CI down 15.38 points (-0.11%) to 14,286.89; FSI flat at 7,388.15.
--   Arithmetic check against our stored neighbours: 14,302.27 (30 Oct) -15.38 = 14,286.89; 3 Nov 14,155.02 is -0.92% on 14,286.89.
-- FSI, volume, market cap and the GSE source_url are already right and are NOT changed. Only gse_ci and the source note change.
-- Guarded: only updates if the bad value is still there (idempotent; safe to re-run).

begin;
create table if not exists public.gse_index_daily_backup_20261115 as table public.gse_index_daily with no data;
insert into public.gse_index_daily_backup_20261115 select * from public.gse_index_daily i
  where i.trade_date = '2026-11-02'
    and not exists (select 1 from public.gse_index_daily_backup_20261115 b where b.trade_date = i.trade_date);
alter table public.gse_index_daily_backup_20261115 enable row level security;
revoke all on public.gse_index_daily_backup_20261115 from anon, authenticated;

update public.gse_index_daily
   set gse_ci = 14286.89,
       source = 'Ghana Stock Exchange (gse.com.gh), end-of-day; GSE-CI corrected 15 Nov 2026 (GSE table showed the day''s volume in the GSE-CI column) from SIC Brokerage Morning Brief 4 Nov 2026'
 where trade_date = '2026-11-02' and gse_ci = 503067;          -- expect UPDATE 1 (0 if already fixed)

select trade_date, gse_ci, gse_fsi, volume, market_cap_m from public.gse_index_daily where trade_date between '2026-10-30' and '2026-11-03' order by 1;
-- expect 30 Oct 14302.27 | 2 Nov 14286.89 7388.15 503067 267946.42 | 3 Nov 14155.02
commit;

-- ALTERNATIVE (if Zeb wants GSE-only figures until GSE's November monthly report confirms):
--   update public.gse_index_daily set gse_ci = null where trade_date = '2026-11-02' and gse_ci = 503067;
--   (charts/indicator skip null gse_ci; compile_gse_week then anchors the week of 2 Nov on 3 Nov.)
-- ROLLBACK:
--   update public.gse_index_daily i set gse_ci = b.gse_ci, source = b.source from public.gse_index_daily_backup_20261115 b
--    where b.trade_date = i.trade_date and i.trade_date = '2026-11-02';
