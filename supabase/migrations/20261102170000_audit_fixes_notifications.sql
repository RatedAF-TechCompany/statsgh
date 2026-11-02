-- StatsGH audit fixes 2026-11-02 (public schema only; the ghanacrimes schema is not touched).
-- 1. Lock down objects that anon could write to.
alter table public._bak_category_fix_20261029 enable row level security;      -- backup table: keep rows, staff-only
revoke all on public._bak_category_fix_20261029 from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.comments_public from anon, authenticated;
alter view public.comments_public set (security_barrier = true);
revoke insert, update, delete, truncate, references, trigger on public.author_profiles from anon, authenticated;
revoke execute on function public.compile_gse_week(date) from public, anon, authenticated;  -- cron-only writer

-- 2. Comments are moderated: only the submit-comment function (service role) inserts, always unpublished.
alter table public.comments alter column is_published set default false;

-- 3. Notification queue -> email to the editor (officeofnajib@gmail.com) via the statsgh Worker (/__internal/mail).
create table if not exists public.sg_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null,              -- comment | contact | submission | newsletter | worker_error | test
  source_table text, source_id text,
  subject text not null, body text not null, link text, dedupe_key text,
  created_at timestamptz not null default now(),
  sent_at timestamptz, request_id bigint, attempts int not null default 0, last_error text
);
create index if not exists sg_notifications_unsent_idx on public.sg_notifications (created_at) where sent_at is null;
create index if not exists sg_notifications_dedupe_idx on public.sg_notifications (dedupe_key, created_at);
alter table public.sg_notifications enable row level security;
revoke all on public.sg_notifications from anon, authenticated;
grant select on public.sg_notifications to authenticated;
drop policy if exists "Admins view notifications" on public.sg_notifications;
create policy "Admins view notifications" on public.sg_notifications for select to authenticated using (public.has_role(auth.uid(), 'admin'::public.app_role));

create table if not exists private.sg_settings (key text primary key, value text not null);
revoke all on private.sg_settings from public, anon, authenticated;

create or replace function public.sg_enqueue_notification() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_kind text := tg_argv[0];
  v_label text := coalesce(tg_argv[1], tg_argv[0]);
  v_row jsonb := to_jsonb(new) - 'verification_code' - 'manage_token';
  v_details text; v_snippet text; v_link text; v_extra text := ''; v_art record;
begin
  if v_kind = 'comment' and coalesce(new.is_published, false) then return new; end if;
  select string_agg(key || ': ' || left(coalesce(value, ''), 2000), E'\n' order by key) into v_details from jsonb_each_text(v_row);
  v_snippet := left(regexp_replace(coalesce(v_row->>'body', v_row->>'subject', v_row->>'title', v_row->>'message', v_row->>'email', ''), '\s+', ' ', 'g'), 70);
  v_link := 'https://supabase.com/dashboard/project/rscqxztgtpcifcqxjskh/editor?schema=public&table=' || tg_table_name;
  if v_kind = 'comment' then
    select category_slug, slug, title into v_art from public.articles where id = new.article_id;
    if found then v_extra := E'\nArticle: ' || v_art.title || E'\nhttps://www.statsgh.com/' || v_art.category_slug || '/' || v_art.slug; end if;
    v_extra := v_extra || E'\nTo publish: set is_published = true on this row (public.comments). To reject: leave it or delete the row.';
  end if;
  insert into public.sg_notifications (kind, source_table, source_id, subject, body, link)
  values (v_kind, tg_table_name, v_row->>'id',
    '[StatsGH] New ' || v_label || case when v_snippet <> '' then ': ' || v_snippet else '' end,
    'New ' || v_label || ' on StatsGH at ' || to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI') || E' (UK time)\n\n'
      || coalesce(v_details, '') || E'\n' || v_extra || E'\n\nDatabase row (table public.' || tg_table_name || ', id ' || coalesce(v_row->>'id', '?') || E'):\n' || v_link,
    v_link);
  return new;
exception when others then
  raise warning 'sg_enqueue_notification failed: %', sqlerrm;
  return new; -- never block the reader's submission
end $$;
revoke all on function public.sg_enqueue_notification() from public, anon, authenticated;

drop trigger if exists sg_notify_comment on public.comments;
create trigger sg_notify_comment after insert on public.comments for each row execute function public.sg_enqueue_notification('comment', 'comment awaiting approval');
drop trigger if exists sg_notify_contact on public.contact_messages;
create trigger sg_notify_contact after insert on public.contact_messages for each row execute function public.sg_enqueue_notification('contact', 'contact message');
drop trigger if exists sg_notify_submission on public.expert_submissions;
create trigger sg_notify_submission after insert on public.expert_submissions for each row execute function public.sg_enqueue_notification('submission', 'expert submission');
drop trigger if exists sg_notify_newsletter on public.newsletter_subscribers;
create trigger sg_notify_newsletter after insert on public.newsletter_subscribers for each row execute function public.sg_enqueue_notification('newsletter', 'newsletter signup');

create or replace function public.sg_send_pending_notifications() returns int
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_secret text;
  v_to text := coalesce((select value from private.sg_settings where key = 'notify_to'), 'officeofnajib@gmail.com');
  v_url text := coalesce((select value from private.sg_settings where key = 'mail_endpoint'), 'https://www.statsgh.com/__internal/mail');
  r record; v_n int := 0;
begin
  for r in select n.id, h.status_code, h.error_msg, h.content from public.sg_notifications n
           left join net._http_response h on h.id = n.request_id where n.sent_at is null and n.request_id is not null loop
    if r.status_code between 200 and 299 then
      update public.sg_notifications set sent_at = now(), last_error = null where id = r.id;
    elsif r.status_code is not null or r.error_msg is not null then
      update public.sg_notifications set request_id = null, last_error = left(coalesce(r.status_code::text, '') || ' ' || coalesce(r.error_msg, r.content, ''), 500) where id = r.id;
    end if;
  end loop;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sg_mail_secret';
  if v_secret is null then return 0; end if; -- queue-only mode
  for r in select * from public.sg_notifications where sent_at is null and request_id is null and attempts < 5
             and created_at > now() - interval '3 days' order by created_at limit 10 for update skip locked loop
    update public.sg_notifications set attempts = attempts + 1, request_id = net.http_post(
      url := v_url,
      body := jsonb_build_object('to', v_to, 'subject', left(r.subject, 180), 'text', r.body),
      headers := jsonb_build_object('x-sg-mail', v_secret, 'Content-Type', 'application/json'),
      timeout_milliseconds := 15000) where id = r.id;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.sg_send_pending_notifications() from public, anon, authenticated;

-- Worker error alerts: at most one email per error type per hour (secret-protected, called with the anon key).
create or replace function public.sg_report_worker_error(p_secret text, p_type text, p_detail text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare v_key text := 'worker_error:' || left(coalesce(p_type, 'unknown'), 120);
begin
  if p_secret is null or encode(extensions.digest(p_secret, 'sha256'), 'hex') is distinct from
     (select value from private.sg_settings where key = 'worker_alert_secret_sha256') then return false; end if;
  perform pg_advisory_xact_lock(hashtext(v_key));
  if exists (select 1 from public.sg_notifications where dedupe_key = v_key and created_at > now() - interval '1 hour') then return false; end if;
  insert into public.sg_notifications (kind, subject, body, dedupe_key, link)
  values ('worker_error', '[StatsGH] Site error: ' || left(coalesce(p_type, 'unknown'), 120),
    'Server error on www.statsgh.com at ' || to_char(now() at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI') || E' (UK time).\n(Max one email per error type per hour.)\n\n'
    || left(coalesce(p_detail, ''), 6000) || E'\n\nLogs: Cloudflare dashboard > Workers & Pages > statsgh > Observability',
    v_key, 'https://dash.cloudflare.com/');
  return true;
end $$;
revoke all on function public.sg_report_worker_error(text, text, text) from public;
grant execute on function public.sg_report_worker_error(text, text, text) to anon, authenticated;

select cron.unschedule('statsgh-notifications') where exists (select 1 from cron.job where jobname = 'statsgh-notifications');
select cron.schedule('statsgh-notifications', '* * * * *', 'select public.sg_send_pending_notifications()');
-- Secrets are set out of band (never in git): vault secret 'sg_mail_secret' and private.sg_settings 'worker_alert_secret_sha256'.
