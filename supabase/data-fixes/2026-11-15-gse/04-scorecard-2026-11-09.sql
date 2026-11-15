-- StatsGH: fix the one stored economy-scorecard edition that captured the bad 2 Nov GSE-CI. Schema public ONLY.
-- PREPARED 15 Nov 2026 by StatsGH Web. NOT RUN. Run after 01. Touches 1 row of public.reports, one JSON key only.
-- reports(kind='economy-scorecard', edition='2026-11-09').data->'gse'->'week' = {"date":"2026-11-02","value":503067}
-- -> {"date":"2026-11-02","value":14286.89} (source as in 01-gse-index-2nov.sql). Nothing else in the edition is changed:
-- its movers (30 Oct -> 6 Nov) were right for what was stored when it was compiled, so it is NOT fully recompiled.
-- No other stored report or article contains the bad value (checked 15 Nov: the two GSE turnover articles quote 503,067
-- correctly as the 2 Nov share VOLUME; no change needed).
begin;
create table if not exists public.reports_backup_20261115 as table public.reports with no data;
insert into public.reports_backup_20261115 select * from public.reports r
  where r.kind = 'economy-scorecard' and r.edition = '2026-11-09'
    and not exists (select 1 from public.reports_backup_20261115 b where b.id = r.id);
alter table public.reports_backup_20261115 enable row level security;
revoke all on public.reports_backup_20261115 from anon, authenticated;
update public.reports set data = jsonb_set(data, '{gse,week,value}', '14286.89'::jsonb)
 where kind = 'economy-scorecard' and edition = '2026-11-09' and data->'gse'->'week'->>'value' = '503067';   -- expect UPDATE 1
select edition, data->'gse' from public.reports where kind = 'economy-scorecard' and edition = '2026-11-09';
commit;
-- ROLLBACK: update public.reports r set data = b.data from public.reports_backup_20261115 b where b.id = r.id;
