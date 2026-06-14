import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Client = SupabaseClient<Database>;

const ARTICLES_LIMIT = 200; // enough for 60+ visible stories across all zones

export type HomepageArticle = {
  id: string;
  title: string;
  slug: string;
  category_slug: string;
  section: string | null;
  summary: string | null;
  word_count: number | null;
  hero_image_url: string | null;
  published_at: string | null;
  author_name: string | null;
  is_breaking: boolean | null;
};

export type MostReadArticle = {
  id: string;
  title: string;
  slug: string;
  category_slug: string;
};

/**
 * The dense homepage article batch. All homepage article zones (Top Stories,
 * Spotlight, section blocks) are derived from this single array.
 * Shared by the server component (initial render) and the client useQuery
 * (refetch) so the two render identical content.
 */
export async function fetchHomepageArticles(client: Client): Promise<HomepageArticle[]> {
  const { data, error } = await client
    .from("articles")
    .select(
      "id, title, slug, category_slug, section, summary, word_count, hero_image_url, published_at, author_name, is_breaking"
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(ARTICLES_LIMIT);
  if (error) throw error;
  return (data || []) as HomepageArticle[];
}

/**
 * Most-read articles over the last 24h (by view count), with a recent-articles
 * fallback when there are no views yet. Shared by server + client.
 */
export async function fetchMostRead(client: Client): Promise<MostReadArticle[]> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: views, error: viewErr } = await client
    .from("article_views")
    .select("article_id")
    .gte("viewed_at", oneDayAgo);

  if (viewErr) throw viewErr;

  const counts: Record<string, number> = {};
  (views || []).forEach((v) => {
    if (v.article_id) counts[v.article_id] = (counts[v.article_id] || 0) + 1;
  });

  const topIds = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([id]) => id);

  if (topIds.length > 0) {
    const { data: articles } = await client
      .from("articles")
      .select("id, title, slug, category_slug")
      .in("id", topIds)
      .eq("is_published", true);

    return ((articles || []) as MostReadArticle[]).sort(
      (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)
    );
  }

  // Fallback: most recent articles
  const { data: recent } = await client
    .from("articles")
    .select("id, title, slug, category_slug")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(10);

  return (recent || []) as MostReadArticle[];
}
