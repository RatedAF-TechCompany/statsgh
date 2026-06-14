import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const MostReadArticles = () => {

  const { data: mostReadArticles, isLoading } = useQuery({
    queryKey: ["most-read-articles"],
    queryFn: async () => {
      // Get article view counts from the last 24 hours
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);

      const { data: viewCounts, error: viewError } = await supabase
        .from("article_views")
        .select("article_id")
        .gte("viewed_at", oneDayAgo.toISOString());

      if (viewError) throw viewError;

      // Count views per article
      const articleViewCounts: Record<string, number> = {};
      (viewCounts || []).forEach((view) => {
        if (view.article_id) {
          articleViewCounts[view.article_id] = (articleViewCounts[view.article_id] || 0) + 1;
        }
      });

      // Get top 5 article IDs by view count
      const topArticleIds = Object.entries(articleViewCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([id]) => id);

      // If we have view data, fetch those articles
      if (topArticleIds.length > 0) {
        const { data: articles, error: articlesError } = await supabase
          .from("articles")
          .select("id, title, slug, category_slug")
          .in("id", topArticleIds)
          .eq("is_published", true);

        if (articlesError) throw articlesError;

        // Sort articles by view count to maintain ranking
        const sortedArticles = (articles || []).sort((a, b) => {
          return (articleViewCounts[b.id] || 0) - (articleViewCounts[a.id] || 0);
        });

        return sortedArticles;
      }

      // Fallback: if no views data, get most recent articles
      const { data: recentArticles, error: recentError } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(5);

      if (recentError) throw recentError;
      return recentArticles || [];
    },
  });

  if (isLoading) {
    return (
      <div className="border-t border-border pt-6">
        <Skeleton className="h-6 w-40 mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="py-3 border-b border-border">
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!mostReadArticles || mostReadArticles.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-[#D9D9D9] pt-6">
      <h2 className="kicker mb-4">Most read today</h2>
      <div className="space-y-0">
        {mostReadArticles.map((article, index) => (
          <Link
            key={article.id}
            to={`/${article.category_slug}/${article.slug}`}
            className="w-full flex items-start gap-4 py-4 border-b border-[#D9D9D9] text-left group"
          >
            <span
              className="font-serif text-[28px] font-bold text-[#E3120B] leading-none pt-0.5"
              style={{ minWidth: '2rem' }}
            >
              {index + 1}
            </span>
            <span className="font-serif text-[15px] font-semibold leading-[1.25] text-[#0D0D0D] headline-link line-clamp-2">
              {article.title}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default MostReadArticles;
