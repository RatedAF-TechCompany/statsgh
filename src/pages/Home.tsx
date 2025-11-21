import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "react-router-dom";

const PAGE_SIZE = 10;

const Home = () => {
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section");
  const observerTarget = useRef<HTMLDivElement>(null);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["articles", section],
      queryFn: async ({ pageParam = 0 }) => {
        let query = supabase
          .from("articles")
          .select("id, title, slug, section, summary, hero_image_url, published_at, is_most_read")
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

        if (section) {
          query = query.eq("section", section);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
      },
      initialPageParam: 0,
    });

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );

    const currentTarget = observerTarget.current;
    if (currentTarget) {
      observer.observe(currentTarget);
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget);
      }
    };
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  const articles = data?.pages.flat() ?? [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[480px] mx-auto bg-background">
        {section && (
          <div className="pt-4 pb-2 text-center">
            <p className="font-serif text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">
              {section} News
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="px-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2 py-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-foreground">No articles found</p>
          </div>
        ) : (
          <>
            <div className="px-4">
              {articles.map((article, index) => (
                <RankedArticleItem 
                  key={article.id} 
                  article={article}
                  rank={index}
                  isHero={index === 0}
                />
              ))}
            </div>

            <div ref={observerTarget} className="py-8 px-4">
              {isFetchingNextPage && (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2 py-4">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))}
                </div>
              )}
              {!hasNextPage && articles.length > 0 && (
                <p className="text-center text-muted-foreground text-sm">
                  No more stories
                </p>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Home;
