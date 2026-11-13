-- BBC-style live coverage pages. Additive, schema public only (never ghanacrimes).
-- Apply to production only with Zeb's confirmation, together with one Worker deploy.
-- Public can SELECT published (live/ended) rows; all writes go through service-role RPCs.

create table if not exists public.live_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null,
  slug_date date not null,
  path text not null generated always as (slug || '-' || to_char(slug_date, 'YYYY-MM-DD')) stored,
  headline text not null,
  byline text not null,
  summary_bullets text[] not null,
  status text not null default 'live' check (status in ('draft', 'live', 'ended')),
  visibility text not null default 'public' check (visibility in ('public', 'hidden')),
  started_at timestamptz,
  ended_at timestamptz,
  content_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint live_pages_slug_date_key unique (slug, slug_date),
  constraint live_pages_path_key unique (path),
  constraint live_pages_slug_shape check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  constraint live_pages_headline_no_colon check (position(':' in headline) = 0 and position(U&'\FF1A' in headline) = 0),
  constraint live_pages_bullets_len check (cardinality(summary_bullets) between 3 and 5)
);

create table if not exists public.live_entries (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.live_pages(id) on delete cascade,
  posted_at timestamptz not null default now(),
  title text not null,
  body text not null,
  source_url text,
  source_label text,
  image_url text,
  image_alt text,
  image_caption text,
  is_wrapup boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_entries_title_no_colon check (position(':' in title) = 0 and position(U&'\FF1A' in title) = 0)
);

create index if not exists live_pages_status_vis_idx on public.live_pages (status, visibility, content_updated_at desc);
create index if not exists live_pages_path_idx on public.live_pages (path);
create index if not exists live_entries_page_posted_idx on public.live_entries (page_id, posted_at desc);

alter table public.live_pages enable row level security;
alter table public.live_entries enable row level security;

drop policy if exists "Public can read published live pages" on public.live_pages;
create policy "Public can read published live pages"
  on public.live_pages for select
  using (status in ('live', 'ended'));

drop policy if exists "Public can read entries of published live pages" on public.live_entries;
create policy "Public can read entries of published live pages"
  on public.live_entries for select
  using (exists (
    select 1 from public.live_pages p
    where p.id = page_id and p.status in ('live', 'ended')
  ));

-- No insert/update/delete policies for anon/authenticated: writes are service_role / RPCs only.

create or replace function public.live_assert_no_colon(p_label text, p_value text)
returns void language plpgsql immutable as $$
begin
  if p_value ~ '[:：]' then
    raise exception '% must not contain a colon', p_label;
  end if;
end $$;

create or replace function public.live_sanitize_text(p_html text)
returns text language sql immutable as $$
  select regexp_replace(
    regexp_replace(coalesce(p_html, ''), '(?i)<(script|iframe|object|embed|form)[^>]*>.*?</\1>', '', 'g'),
    '(?i)</?(script|iframe|object|embed|form|svg)[^>]*>', '', 'g')
$$;

create or replace function public.live_entry_json(e public.live_entries)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', e.id, 'page_id', e.page_id, 'posted_at', e.posted_at,
    'title', e.title, 'body', e.body,
    'source_url', e.source_url, 'source_label', e.source_label,
    'image_url', e.image_url, 'image_alt', e.image_alt, 'image_caption', e.image_caption,
    'is_wrapup', e.is_wrapup, 'created_at', e.created_at, 'updated_at', e.updated_at
  )
$$;

create or replace function public.live_page_json(p public.live_pages)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'id', p.id, 'slug', p.slug, 'slug_date', p.slug_date, 'path', p.path,
    'headline', p.headline, 'byline', p.byline, 'summary_bullets', p.summary_bullets,
    'status', p.status, 'visibility', p.visibility,
    'started_at', p.started_at, 'ended_at', p.ended_at,
    'content_updated_at', p.content_updated_at, 'created_at', p.created_at,
    'entries', coalesce((
      select jsonb_agg(public.live_entry_json(e) order by e.posted_at desc)
      from public.live_entries e where e.page_id = p.id
    ), '[]'::jsonb)
  )
$$;

create or replace function public.live_resolve_page(p_slug text)
returns public.live_pages language plpgsql stable as $$
declare v public.live_pages; v_path text; v_slug text;
begin
  v_path := trim(p_slug);
  -- Full path slug-YYYY-MM-DD
  if v_path ~ '^[a-z0-9]+(-[a-z0-9]+)*-\d{4}-\d{2}-\d{2}$' then
    select * into v from public.live_pages where path = v_path;
    if not found then raise exception 'No live page at %', v_path; end if;
    return v;
  end if;
  v_slug := lower(v_path);
  select * into v from public.live_pages
   where slug = v_slug and status = 'live'
   order by started_at desc nulls last limit 1;
  if found then return v; end if;
  select * into v from public.live_pages
   where slug = v_slug
   order by slug_date desc limit 1;
  if not found then raise exception 'No live page with slug %', v_slug; end if;
  return v;
end $$;

create or replace function public.live_start(
  p_slug text, p_headline text, p_byline text, p_bullets text[],
  p_title text, p_body text,
  p_source_url text default null, p_source_label text default null,
  p_image_url text default null, p_image_alt text default null, p_image_caption text default null,
  p_visibility text default 'public', p_date date default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_page public.live_pages;
  v_date date;
  v_body text;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(-[a-z0-9]+)*$' or char_length(p_slug) > 80 then
    raise exception 'Slug must be lowercase letters, numbers and hyphens, without a trailing date';
  end if;
  perform public.live_assert_no_colon('Headline', p_headline);
  if char_length(btrim(p_headline)) < 8 or char_length(btrim(p_headline)) > 140 then
    raise exception 'Headline must be 8–140 characters';
  end if;
  if char_length(btrim(p_byline)) < 2 or char_length(btrim(p_byline)) > 80 then
    raise exception 'Byline must be 2–80 characters';
  end if;
  if p_bullets is null or cardinality(p_bullets) < 3 or cardinality(p_bullets) > 5 then
    raise exception 'Summary must have 3–5 bullets';
  end if;
  perform public.live_assert_no_colon('Entry title', p_title);
  v_body := public.live_sanitize_text(p_body);
  if v_body is null or length(btrim(v_body)) < 8 then raise exception 'Entry body is required'; end if;
  if exists (select 1 from public.live_pages where slug = p_slug and status = 'live') then
    raise exception 'A live page with slug "%" is already running', p_slug;
  end if;
  v_date := coalesce(p_date, (timezone('Africa/Accra', now()))::date);
  if exists (select 1 from public.live_pages where slug = p_slug and slug_date = v_date) then
    raise exception 'A page already exists at /live/%-%', p_slug, v_date;
  end if;
  if p_visibility not in ('public', 'hidden') then p_visibility := 'public'; end if;

  insert into public.live_pages (slug, slug_date, headline, byline, summary_bullets, status, visibility, started_at, content_updated_at)
  values (p_slug, v_date, btrim(p_headline), btrim(p_byline), p_bullets, 'live', p_visibility, now(), now())
  returning * into v_page;

  insert into public.live_entries (page_id, title, body, source_url, source_label, image_url, image_alt, image_caption)
  values (v_page.id, btrim(p_title), v_body, nullif(p_source_url, ''), nullif(p_source_label, ''),
          nullif(p_image_url, ''), nullif(p_image_alt, ''), nullif(p_image_caption, ''));

  return public.live_page_json(v_page);
end $$;

create or replace function public.live_add(
  p_slug text, p_title text, p_body text,
  p_source_url text default null, p_source_label text default null,
  p_image_url text default null, p_image_alt text default null, p_image_caption text default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_page public.live_pages; v_entry public.live_entries; v_body text;
begin
  v_page := public.live_resolve_page(p_slug);
  if v_page.status is distinct from 'live' then raise exception 'Cannot add an entry to a page that is not live'; end if;
  perform public.live_assert_no_colon('Entry title', p_title);
  v_body := public.live_sanitize_text(p_body);
  if v_body is null or length(btrim(v_body)) < 8 then raise exception 'Entry body is required'; end if;
  insert into public.live_entries (page_id, title, body, source_url, source_label, image_url, image_alt, image_caption)
  values (v_page.id, btrim(p_title), v_body, nullif(p_source_url, ''), nullif(p_source_label, ''),
          nullif(p_image_url, ''), nullif(p_image_alt, ''), nullif(p_image_caption, ''))
  returning * into v_entry;
  update public.live_pages set content_updated_at = now() where id = v_page.id;
  return public.live_entry_json(v_entry);
end $$;

create or replace function public.live_summary(p_slug text, p_bullets text[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_page public.live_pages;
begin
  v_page := public.live_resolve_page(p_slug);
  if v_page.status is distinct from 'live' then raise exception 'Cannot replace the summary on a page that is not live'; end if;
  if p_bullets is null or cardinality(p_bullets) < 3 or cardinality(p_bullets) > 5 then
    raise exception 'Summary must have 3–5 bullets';
  end if;
  update public.live_pages
     set summary_bullets = p_bullets, content_updated_at = now()
   where id = v_page.id
   returning * into v_page;
  return public.live_page_json(v_page);
end $$;

create or replace function public.live_edit(
  p_slug text, p_entry_id uuid,
  p_title text default null, p_body text default null,
  p_source_url text default null, p_source_label text default null,
  p_image_url text default null, p_image_alt text default null, p_image_caption text default null,
  p_clear_source boolean default false, p_clear_image boolean default false
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_page public.live_pages; v_entry public.live_entries;
begin
  v_page := public.live_resolve_page(p_slug);
  select * into v_entry from public.live_entries where id = p_entry_id and page_id = v_page.id;
  if not found then raise exception 'Entry not found on that page'; end if;
  if p_title is not null then
    perform public.live_assert_no_colon('Entry title', p_title);
    v_entry.title := btrim(p_title);
  end if;
  if p_body is not null then
    v_entry.body := public.live_sanitize_text(p_body);
  end if;
  if p_clear_source then
    v_entry.source_url := null; v_entry.source_label := null;
  else
    if p_source_url is not null then v_entry.source_url := nullif(p_source_url, ''); end if;
    if p_source_label is not null then v_entry.source_label := nullif(p_source_label, ''); end if;
  end if;
  if p_clear_image then
    v_entry.image_url := null; v_entry.image_alt := null; v_entry.image_caption := null;
  else
    if p_image_url is not null then v_entry.image_url := nullif(p_image_url, ''); end if;
    if p_image_alt is not null then v_entry.image_alt := nullif(p_image_alt, ''); end if;
    if p_image_caption is not null then v_entry.image_caption := nullif(p_image_caption, ''); end if;
  end if;
  v_entry.updated_at := now();
  update public.live_entries set
    title = v_entry.title, body = v_entry.body,
    source_url = v_entry.source_url, source_label = v_entry.source_label,
    image_url = v_entry.image_url, image_alt = v_entry.image_alt, image_caption = v_entry.image_caption,
    updated_at = v_entry.updated_at
  where id = v_entry.id;
  update public.live_pages set content_updated_at = now() where id = v_page.id;
  return public.live_entry_json(v_entry);
end $$;

create or replace function public.live_end(p_slug text, p_title text, p_body text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_page public.live_pages; v_body text;
begin
  v_page := public.live_resolve_page(p_slug);
  if v_page.status is distinct from 'live' then raise exception 'Page is not live'; end if;
  perform public.live_assert_no_colon('Entry title', p_title);
  v_body := public.live_sanitize_text(p_body);
  if v_body is null or length(btrim(v_body)) < 8 then raise exception 'Wrap-up body is required'; end if;
  insert into public.live_entries (page_id, title, body, is_wrapup)
  values (v_page.id, btrim(p_title), v_body, true);
  update public.live_pages
     set status = 'ended', ended_at = now(), content_updated_at = now()
   where id = v_page.id
   returning * into v_page;
  return public.live_page_json(v_page);
end $$;

revoke all on function public.live_start(text,text,text,text[],text,text,text,text,text,text,text,text,date) from public, anon, authenticated;
revoke all on function public.live_add(text,text,text,text,text,text,text,text) from public, anon, authenticated;
revoke all on function public.live_summary(text,text[]) from public, anon, authenticated;
revoke all on function public.live_edit(text,uuid,text,text,text,text,text,text,text,boolean,boolean) from public, anon, authenticated;
revoke all on function public.live_end(text,text,text) from public, anon, authenticated;
revoke all on function public.live_resolve_page(text) from public, anon, authenticated;
revoke all on function public.live_assert_no_colon(text,text) from public, anon, authenticated;
-- Keep json helpers executable by the definer only; service_role bypasses RLS and can call the write RPCs.
grant execute on function public.live_start(text,text,text,text[],text,text,text,text,text,text,text,text,date) to service_role;
grant execute on function public.live_add(text,text,text,text,text,text,text,text) to service_role;
grant execute on function public.live_summary(text,text[]) to service_role;
grant execute on function public.live_edit(text,uuid,text,text,text,text,text,text,text,boolean,boolean) to service_role;
grant execute on function public.live_end(text,text,text) to service_role;

grant select on public.live_pages to anon, authenticated, service_role;
grant select on public.live_entries to anon, authenticated, service_role;
