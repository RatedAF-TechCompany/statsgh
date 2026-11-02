-- Comment moderation (admin approve/reject) + server-verified site forms (Turnstile in the Worker).

-- 1. Comments: explicit moderation state; admins (has_role admin/editor) can moderate. Nothing is deleted.
alter table public.comments add column if not exists moderation_status text not null default 'pending'
  check (moderation_status in ('pending','approved','rejected'));
alter table public.comments add column if not exists moderated_at timestamptz;
alter table public.comments add column if not exists moderated_by uuid;
update public.comments set moderation_status = 'approved' where is_published and moderation_status = 'pending';

drop policy if exists "Admins can view all comments" on public.comments;
create policy "Admins can view all comments" on public.comments for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role));

create or replace function public.sg_moderate_comment(p_id uuid, p_action text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_action not in ('approve','reject','pending') then raise exception 'bad action'; end if;
  update public.comments set
    moderation_status = case p_action when 'approve' then 'approved' when 'reject' then 'rejected' else 'pending' end,
    is_published = (p_action = 'approve'), moderated_at = now(), moderated_by = auth.uid()
  where id = p_id;
  if not found then raise exception 'comment not found'; end if;
  return p_action;
end $$;
revoke all on function public.sg_moderate_comment(uuid, text) from public, anon;
grant execute on function public.sg_moderate_comment(uuid, text) to authenticated;

-- 2. Forms: more lead kinds; anon can no longer insert directly. The Worker verifies Cloudflare Turnstile,
--    then calls sg_submit_form with the shared Worker secret (same sha256 as sg_report_worker_error).
alter table public.contact_messages drop constraint if exists contact_messages_kind_check;
alter table public.contact_messages add constraint contact_messages_kind_check
  check (kind = any (array['contact','advertise','sponsored','fellowship','api','whatsapp','factcheck']));
drop policy if exists "Anyone can send" on public.contact_messages;
revoke insert, update, delete, truncate, references, trigger on public.contact_messages from anon;
revoke truncate, references, trigger on public.contact_messages from authenticated;

create or replace function public.sg_submit_form(p_secret text, p_kind text, p_name text, p_email text,
  p_organisation text, p_subject text, p_message text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare v_hash text; v_email text := lower(trim(coalesce(p_email,'')));
begin
  select value into v_hash from private.sg_settings where key = 'worker_alert_secret_sha256';
  if v_hash is null or encode(digest(coalesce(p_secret,''), 'sha256'), 'hex') <> v_hash then return 'forbidden'; end if;
  if p_kind not in ('contact','advertise','sponsored','fellowship','api','whatsapp','factcheck') then return 'bad_kind'; end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 254 then return 'bad_email'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 100 or length(trim(coalesce(p_message,''))) not between 1 and 3000
     or length(coalesce(p_organisation,'')) > 150 or length(coalesce(p_subject,'')) > 150 then return 'bad_input'; end if;
  if (select count(*) from public.contact_messages where lower(email) = v_email and created_at > now() - interval '10 minutes') >= 3
     or (select count(*) from public.contact_messages where created_at > now() - interval '1 hour') >= 60 then return 'rate_limited'; end if;
  insert into public.contact_messages(kind, name, email, organisation, subject, message)
  values (p_kind, trim(p_name), v_email, nullif(trim(coalesce(p_organisation,'')),''), nullif(trim(coalesce(p_subject,'')),''), trim(p_message));
  return 'ok';
end $$;
revoke all on function public.sg_submit_form(text,text,text,text,text,text,text) from public;
grant execute on function public.sg_submit_form(text,text,text,text,text,text,text) to anon, authenticated;

-- 3. Alert emails point to the moderation page.
create or replace function public.sg_enqueue_notification() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_kind text := tg_argv[0];
  v_label text := coalesce(tg_argv[1], tg_argv[0]);
  v_row jsonb := to_jsonb(new) - 'verification_code' - 'manage_token';
  v_details text; v_snippet text; v_link text; v_extra text := ''; v_art record;
begin
  if v_kind = 'comment' and coalesce((v_row->>'is_published')::boolean, false) then return new; end if;
  select string_agg(key || ': ' || left(coalesce(value, ''), 2000), E'\n' order by key) into v_details from jsonb_each_text(v_row);
  v_snippet := left(regexp_replace(coalesce(v_row->>'body', v_row->>'subject', v_row->>'title', v_row->>'message', v_row->>'email', ''), '\s+', ' ', 'g'), 70);
  v_link := 'https://supabase.com/dashboard/project/rscqxztgtpcifcqxjskh/editor?schema=public&table=' || tg_table_name;
  if v_kind = 'comment' then
    select category_slug, slug, title into v_art from public.articles where id = new.article_id;
    if found then v_extra := E'\nArticle: ' || v_art.title || E'\nhttps://www.statsgh.com/' || v_art.category_slug || '/' || v_art.slug; end if;
    v_extra := v_extra || E'\nApprove or reject: https://www.statsgh.com/admin/comments (sign in as officeofnajib@gmail.com)';
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
