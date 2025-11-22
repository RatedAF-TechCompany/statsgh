import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";

const ARTICLES_PER_PAGE = 20;

const Home = () => {
  const navigate = useNavigate();
  const observerTarget = useRef(null);

  // Fetch the single most recent article for "Recent Story"
  const { data: recentStory, isLoading: loadingRecent } = useQuery({
    queryKey: ["recent-story"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  // Fetch all other articles with infinite scrolling (excluding the recent story)
  const {
    data: articlesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading: loadingArticles,
  } = useInfiniteQuery({
    queryKey: ["all-articles", recentStory?.id],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      let query = supabase
        .from("articles")
        .select("id, title, slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .range(from, to);

      // Exclude the recent story from the list
      if (recentStory?.id) {
        query = query.neq("id", recentStory.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.length < ARTICLES_PER_PAGE) return undefined;
      return pages.length;
    },
    initialPageParam: 0,
    enabled: !loadingRecent, // Wait for recent story to load first
  });

  // Set up intersection observer for infinite scroll
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

  const allArticles = articlesData?.pages.flatMap((page) => page) || [];
  const isLoading = loadingRecent || loadingArticles;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[480px] mx-auto bg-background">
        {isLoading ? (
          <div className="px-4 space-y-4 pt-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="space-y-2 py-4">
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Recent Story Section */}
            {recentStory && (
              <div className="px-4 pt-4 pb-6 border-b border-border">
                <div className="pb-2 mb-2">
                  <h2 className="font-serif text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">
                    Recent Story
                  </h2>
                </div>
                <RankedArticleItem 
                  article={recentStory}
                  rank={0}
                  isHero={true}
                />
              </div>
            )}

            {/* All Other Articles */}
            <div className="px-4 pt-6">
              {allArticles && allArticles.length > 0 ? (
                <>
                  {allArticles.map((article, index) => (
                    <RankedArticleItem 
                      key={article.id} 
                      article={article}
                      rank={index + 1}
                      isHero={false}
                    />
                  ))}

                  {/* Infinite scroll trigger and loading indicator */}
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
                  No articles available
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
