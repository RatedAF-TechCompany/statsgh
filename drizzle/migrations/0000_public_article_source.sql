create or replace function public.get_article_source(p_article_id uuid)
returns table(source_name text, source_url text)
language sql stable security definer set search_path = public
as $$
  select n.source_name, n.source_url
  from public.newsroom_articles n
  join public.articles a on a.id = n.generated_article_id
  where n.generated_article_id = p_article_id
    and a.is_published = true
    and n.source_url is not null
  order by n.created_at asc
  limit 1
$$;
revoke all on function public.get_article_source(uuid) from public;
grant execute on function public.get_article_source(uuid) to anon, authenticated, service_role;