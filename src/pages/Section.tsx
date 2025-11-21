import { useEffect, useRef } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { SECTION_MAPPING } from "@/lib/navigation";

const PAGE_SIZE = 10;

const Section = () => {
  const { slug } = useParams<{ slug: string }>();
  const observerTarget = useRef<HTMLDivElement>(null);

  const sectionName = slug ? SECTION_MAPPING[slug as keyof typeof SECTION_MAPPING] : null;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["articles", slug],
      queryFn: async ({ pageParam = 0 }) => {
        let query = supabase
          .from("articles")
          .select("id, title, slug, section, summary, hero_image_url, published_at")
          .eq("is_published", true)
          .order("published_at", { ascending: false })
          .range(pageParam * PAGE_SIZE, (pageParam + 1) * PAGE_SIZE - 1);

        if (slug) {
          query = query.eq("section", slug);
        }

        const { data, error } = await query;
        if (error) throw error;
        return data;
      },
      getNextPageParam: (lastPage, allPages) => {
        return lastPage.length === PAGE_SIZE ? allPages.length : undefined;
      },
      initialPageParam: 0,
      enabled: !!slug,
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
        {sectionName && (
          <div className="pt-4 pb-2 text-center">
            <p className="font-serif text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">
              {sectionName}
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
            <p className="text-muted-foreground">No articles found in this section</p>
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

export default Section;
