import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMostRead, type MostReadArticle } from "@/lib/homepage-data";

const MostReadRail = ({ initialData }: { initialData?: MostReadArticle[] } = {}) => {
  const { data: mostRead, isLoading } = useQuery({
    queryKey: ["most-read-rail-10"],
    queryFn: () => fetchMostRead(supabase),
    initialData,
    staleTime: 60_000,
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
            <Link
              key={article.id}
              to={`/${article.category_slug}/${article.slug}`}
              className="w-full flex items-start gap-3 py-2 border-t border-[#D9D9D9] text-left group"
            >
              <span className="font-headline text-lg font-bold text-[#5B5B5B] leading-none pt-0.5 w-5 flex-shrink-0">
                {i + 1}
              </span>
              <span className="font-headline text-[13px] font-medium text-[#121212] leading-snug group-hover:text-[#E3120B] transition-colors line-clamp-3">
                {article.title}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default MostReadRail;
