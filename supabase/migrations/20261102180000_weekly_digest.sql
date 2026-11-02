-- Weekly "Ghana in Numbers" digest, built only from stored data (StatsGH articles, Bank of Ghana, GSE).
-- Until a sending domain is verified for readers, it is emailed ONLY to the editor (officeofnajib@gmail.com,
-- the single verified destination of the Worker send_email binding) via public.sg_notifications.
create or replace function public.sg_build_weekly_digest(p_force boolean default false) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_key text := 'digest-' || to_char(now() at time zone 'Europe/London', 'IYYY-IW');
  v_body text := ''; v_subj text; r record; i int := 0; v_n int;
begin
  if not p_force and exists (select 1 from public.sg_notifications where dedupe_key = v_key) then return 'already built'; end if;

  v_body := 'Ghana in Numbers — weekly digest from StatsGH' || E'\n' || 'Week to ' || to_char(now() at time zone 'Europe/London', 'FMDD Mon YYYY') || E'\n\n';
  v_body := v_body || 'MOST READ THIS WEEK' || E'\n';
  for r in
    select a.title, a.category_slug, a.slug, count(*) n from public.article_views v join public.articles a on a.id = v.article_id
    where v.viewed_at > now() - interval '7 days' and a.is_published group by 1,2,3 order by n desc limit 5
  loop
    i := i + 1;
    v_body := v_body || i || '. ' || r.title || E'\n   https://www.statsgh.com/' || coalesce(r.category_slug,'news') || '/' || r.slug || E'\n';
  end loop;
  if i = 0 then v_body := v_body || '(No reading data this week.)' || E'\n'; end if;

  v_body := v_body || E'\nKEY NUMBERS (latest stored official figures)\n';
  select mid, rate_date into r from public.bog_fx_rates where pair = 'USDGHS' order by rate_date desc limit 1;
  if found then v_body := v_body || '- US dollar (BoG interbank mid): GH₵' || round(r.mid, 4) || ' on ' || to_char(r.rate_date, 'FMDD Mon YYYY') || E'\n'; end if;
  select rate, effective_date into r from public.bog_policy_rates order by effective_date desc limit 1;
  if found then v_body := v_body || '- BoG policy rate: ' || r.rate || '% (effective ' || to_char(r.effective_date, 'FMDD Mon YYYY') || E')\n'; end if;
  select interest_rate, issue_date into r from public.bog_tbill_rates where tenor_days = 91 order by issue_date desc limit 1;
  if found then v_body := v_body || '- 91-day T-bill: ' || r.interest_rate || '% (' || to_char(r.issue_date, 'FMDD Mon YYYY') || E')\n'; end if;
  select value, period into r from public.inflation_readings where kind = 'headline' order by period desc limit 1;
  if found then v_body := v_body || '- Headline CPI inflation (GSS): ' || r.value || '% for ' || to_char(r.period, 'FMMonth YYYY') || E'\n'; end if;
  select gse_ci, trade_date into r from public.gse_index_daily where gse_ci is not null order by trade_date desc limit 1;
  if found then v_body := v_body || '- GSE Composite Index: ' || r.gse_ci || ' (' || to_char(r.trade_date, 'FMDD Mon YYYY') || E')\n'; end if;

  v_body := v_body || E'\nData and sources: https://www.statsgh.com/data-vault\nWeek in Numbers: https://www.statsgh.com/week-in-numbers\n\n'
    || '-- Editor-only preview: reader sending is off until a sending domain is verified. --';
  v_subj := '[StatsGH] Weekly digest: Ghana in Numbers, week to ' || to_char(now() at time zone 'Europe/London', 'FMDD Mon YYYY');

  insert into public.sg_notifications (kind, source_table, source_id, subject, body, link, dedupe_key)
  values ('digest', 'newsletter_sends', null, v_subj, v_body, 'https://www.statsgh.com/newsletter', case when p_force then v_key || '-' || extract(epoch from now())::bigint else v_key end);
  insert into public.newsletter_sends (sent_at, subject, recipients_count, status, error_message)
  values (now(), v_subj, 1, 'editor_only', 'Sent to editor only; reader sending needs a verified sending domain');
  return 'queued';
end $$;
revoke all on function public.sg_build_weekly_digest(boolean) from public, anon, authenticated;

select cron.unschedule('statsgh-weekly-digest') where exists (select 1 from cron.job where jobname = 'statsgh-weekly-digest');
select cron.schedule('statsgh-weekly-digest', '0 7 * * 1', $$select public.sg_build_weekly_digest()$$);
