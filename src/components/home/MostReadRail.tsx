import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const MostReadRail = () => {
  const navigate = useNavigate();

  const { data: mostRead, isLoading } = useQuery({
    queryKey: ["most-read-rail-10"],
    queryFn: async () => {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const { data: views, error: viewErr } = await supabase
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
        const { data: articles } = await supabase
          .from("articles")
          .select("id, title, slug, category_slug")
          .in("id", topIds)
          .eq("is_published", true);

        return (articles || []).sort(
          (a, b) => (counts[b.id] || 0) - (counts[a.id] || 0)
        );
      }

      // Fallback: recent articles
      const { data: recent } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(10);

      return recent || [];
    },
    refetchInterval: 5 * 60 * 1000, // 5 minutes
  });

  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 h-px bg-[#D9D9D9]" />
        <h2 className="font-ui text-[10px] font-bold uppercase tracking-[0.1em] text-[#121212] m-0">
          Most Read
        </h2>
        <div className="flex-1 h-px bg-[#D9D9D9]" />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="space-y-0">
          {(mostRead || []).map((article, i) => (
            <button
              key={article.id}
              onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
              className="w-full flex items-start gap-3 py-2 border-t border-[#D9D9D9] text-left group"
            >
              <span className="font-headline text-lg font-bold text-[#5B5B5B] leading-none pt-0.5 w-5 flex-shrink-0">
                {i + 1}
              </span>
              <span className="font-headline text-[13px] font-medium text-[#121212] leading-snug group-hover:text-[#E3120B] transition-colors">
                {article.title}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MostReadRail;
