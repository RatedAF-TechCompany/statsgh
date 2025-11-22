import { useParams } from "react-router-dom";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import { CATEGORY_MAPPING } from "@/lib/navigation";

const ARTICLES_PER_PAGE = 20;

const Category = () => {
  const { slug } = useParams();
  const observerTarget = useRef(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["category-articles", slug],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .eq("section", slug)
        .order("published_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < ARTICLES_PER_PAGE) return undefined;
      return pages.length;
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

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const articles = data?.pages.flatMap((page) => page) || [];
  const categoryLabel = slug ? CATEGORY_MAPPING[slug as keyof typeof CATEGORY_MAPPING] : "";

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[480px] mx-auto bg-background">
        <div className="px-4 pt-4">
          <div className="pb-2 mb-2">
            <h1 className="font-serif text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">
              {categoryLabel}
            </h1>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="space-y-2 py-4">
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-16 w-full" />
                </div>
              ))}
            </div>
          ) : articles.length > 0 ? (
            <>
              {articles.map((article, index) => (
                <RankedArticleItem
                  key={article.id}
                  article={article}
                  rank={index}
                  isHero={false}
                />
              ))}

              <div ref={observerTarget} className="py-4">
                {isFetchingNextPage ? (
                  <div className="space-y-4">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="space-y-2 py-4">
                        <Skeleton className="h-6 w-full" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    ))}
                  </div>
                ) : !hasNextPage ? (
                  <p className="text-center text-muted-foreground text-sm">
                    No more stories
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <p className="text-center py-6 text-muted-foreground text-sm">
              No articles found in this category
            </p>
          )}
        </div>
      </main>
    </div>
  );
};

export default Category;
