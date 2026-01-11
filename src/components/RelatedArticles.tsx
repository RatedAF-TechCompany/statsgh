import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";

interface RelatedArticle {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  hero_image_url: string | null;
  published_at: string | null;
  category_slug: string | null;
  author_name: string;
  tags: string[] | null;
}

interface RelatedArticlesProps {
  articleId: string;
  tags?: string[] | null;
  categorySlug?: string | null;
  maxItems?: number;
}

export const RelatedArticles = ({
  articleId,
  tags,
  categorySlug,
  maxItems = 12,
}: RelatedArticlesProps) => {
  const { data: relatedArticles, isLoading } = useQuery({
    queryKey: ["related-articles", articleId, tags, categorySlug],
    queryFn: async () => {
      // Build a query that finds articles matching tags or category
      // Priority: same tags > same category > latest
      
      const matchedArticleIds = new Set<string>();
      const matchedArticles: RelatedArticle[] = [];

      // 1. Match by tags if available
      if (tags && tags.length > 0) {
        const { data: tagMatches } = await supabase
          .from("articles")
          .select("id, title, slug, summary, hero_image_url, published_at, category_slug, author_name, tags")
          .eq("is_published", true)
          .neq("id", articleId)
          .overlaps("tags", tags)
          .order("published_at", { ascending: false })
          .limit(maxItems);

        if (tagMatches) {
          tagMatches.forEach((article) => {
            if (!matchedArticleIds.has(article.id)) {
              matchedArticleIds.add(article.id);
              matchedArticles.push(article as RelatedArticle);
            }
          });
        }
      }

      // 2. Match by category if available and need more articles
      if (categorySlug && matchedArticles.length < maxItems) {
        const { data: categoryMatches } = await supabase
          .from("articles")
          .select("id, title, slug, summary, hero_image_url, published_at, category_slug, author_name, tags")
          .eq("is_published", true)
          .eq("category_slug", categorySlug)
          .neq("id", articleId)
          .order("published_at", { ascending: false })
          .limit(maxItems);

        if (categoryMatches) {
          categoryMatches.forEach((article) => {
            if (!matchedArticleIds.has(article.id) && matchedArticles.length < maxItems) {
              matchedArticleIds.add(article.id);
              matchedArticles.push(article as RelatedArticle);
            }
          });
        }
      }

      // 3. Fallback to latest articles if we still need more
      if (matchedArticles.length < maxItems) {
        const { data: latestArticles } = await supabase
          .from("articles")
          .select("id, title, slug, summary, hero_image_url, published_at, category_slug, author_name, tags")
          .eq("is_published", true)
          .neq("id", articleId)
          .order("published_at", { ascending: false })
          .limit(maxItems);

        if (latestArticles) {
          latestArticles.forEach((article) => {
            if (!matchedArticleIds.has(article.id) && matchedArticles.length < maxItems) {
              matchedArticleIds.add(article.id);
              matchedArticles.push(article as RelatedArticle);
            }
          });
        }
      }

      return matchedArticles.slice(0, maxItems);
    },
    enabled: !!articleId,
  });

  if (isLoading) {
    return (
      <section className="mt-12 border-t border-border pt-8">
        <h2 className="font-serif text-2xl font-bold mb-6">Related Articles</h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-video w-full rounded-lg" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!relatedArticles || relatedArticles.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <h2 className="font-serif text-2xl font-bold mb-6">Related Articles</h2>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {relatedArticles.map((article) => (
          <Link
            key={article.id}
            to={`/${article.category_slug}/${article.slug}`}
            className="group"
          >
            <article>
              {article.hero_image_url && (
                <div className="aspect-video overflow-hidden rounded-lg mb-3">
                  <img
                    src={article.hero_image_url}
                    alt={article.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              <Badge variant="outline" className="mb-2 text-xs capitalize">
                {article.category_slug?.replace(/-/g, " ")}
              </Badge>
              <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-1">
                {article.title}
              </h3>
              {article.summary && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {article.summary}
                </p>
              )}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {article.author_name && <span>{article.author_name}</span>}
                {article.published_at && (
                  <>
                    <span>·</span>
                    <time>{format(new Date(article.published_at), "MMM d, yyyy")}</time>
                  </>
                )}
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
};
