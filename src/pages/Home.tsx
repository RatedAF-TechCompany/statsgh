import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { ArticleCard } from "@/components/ArticleCard";
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

  // Group articles by date
  const groupedArticles = articles.reduce((groups: { [key: string]: typeof articles }, article) => {
    const date = article.published_at 
      ? new Date(article.published_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
      : "Unknown Date";
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(article);
    return groups;
  }, {});

  const dateGroups = Object.entries(groupedArticles);
  const backgroundColors = ["bg-[hsl(var(--date-group-bg-1))]", "bg-[hsl(var(--date-group-bg-2))]", "bg-[hsl(var(--date-group-bg-3))]"];

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-2xl mx-auto">
        <div className="px-4 pt-4">
          <h2 className="font-sans text-2xl font-medium mb-2">
            {section ? `More ${section}` : "More World"}
          </h2>
          <div className="border-b border-divider mb-2" />
          <div className="text-xs uppercase text-muted-text mb-4">
            {today}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4 px-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-12 px-4">
            <p className="text-muted-text">No articles found</p>
          </div>
        ) : (
          <>
            {dateGroups.map(([date, groupArticles], groupIndex) => (
              <div key={date} className={`${backgroundColors[groupIndex % 3]} py-4`}>
                <div className="px-4 mb-3">
                  <div className="text-xs uppercase text-muted-text">{date}</div>
                </div>
                {groupArticles.map((article) => (
                  <ArticleCard 
                    key={article.id} 
                    article={article} 
                    isMostRead={article.is_most_read || false}
                  />
                ))}
              </div>
            ))}

            <div ref={observerTarget} className="py-8">
              {isFetchingNextPage && (
                <div className="space-y-4 px-4">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="space-y-2">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  ))}
                </div>
              )}
              {!hasNextPage && articles.length > 0 && (
                <p className="text-center text-muted-text text-sm">
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
