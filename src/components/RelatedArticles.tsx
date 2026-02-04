"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { supabase } from "@/integrations/supabase/client";
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
      const matchedArticleIds = new Set<string>();
      const matchedArticles: RelatedArticle[] = [];

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
      <section className="mt-12 pt-10 border-t border-border">
        <h2 className="font-serif text-2xl font-semibold text-foreground mb-6">
          More from StatsGH
        </h2>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-[3/2] w-full" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-3 w-32" />
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
    <section className="mt-12 pt-10 border-t border-border">
      <h2 className="font-serif text-2xl font-semibold text-foreground mb-6">
        More from StatsGH
      </h2>
      <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
        {relatedArticles.map((article) => (
          <Link
            key={article.id}
            href={`/${article.category_slug}/${article.slug}`}
            className="group block"
          >
            <article className="h-full">
              {article.hero_image_url && (
                <div className="aspect-[3/2] overflow-hidden mb-3">
                  <img
                    src={article.hero_image_url}
                    alt=""
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
              )}
              
              <div className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wide text-ft-maroon">
                  {article.category_slug?.replace(/-/g, " ")}
                </span>
                
                <h3 className="font-serif text-lg font-semibold text-foreground group-hover:text-ft-maroon transition-colors leading-snug line-clamp-3">
                  {article.title}
                </h3>
                
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  {article.published_at && (
                    <time dateTime={article.published_at}>
                      {format(new Date(article.published_at), "MMM d, yyyy")}
                    </time>
                  )}
                </div>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </section>
  );
};
