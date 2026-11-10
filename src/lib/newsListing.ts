// Shared by app/news (server prerender) and views/News (client) so both fetch the same rows.
export const NEWS_PAGE_SIZE = 20;
export const NEWS_COLUMNS =
  "id, title, slug, summary, word_count, hero_image_url, key_data, published_at, category_slug, author_name, tags";
