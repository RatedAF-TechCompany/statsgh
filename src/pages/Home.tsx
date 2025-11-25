import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef } from "react";
import { format } from "date-fns";

const ARTICLES_PER_PAGE = 20;

const Home = () => {
  const navigate = useNavigate();
  const observerTarget = useRef(null);

  const {
    data: articlesData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["all-articles"],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
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

  const allArticles = articlesData?.pages.flatMap((page) => page) || [];

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[1120px] mx-auto px-8 py-8">
        {/* Section Title */}
        <div className="mb-8">
          <h2 className="font-serif text-[22px] font-medium tracking-[0.04em]">
            Stats News
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-8 py-5 border-b border-border">
                <div className="w-40">
                  <Skeleton className="h-4 w-24 mb-6" />
                  <Skeleton className="h-[135px] w-[240px]" />
                </div>
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-16 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-0">
              {allArticles.map((article) => (
                <article
                  key={article.id}
                  className="flex gap-8 py-5 border-b border-border cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate(`/article/${article.slug}`)}
                >
                  {/* Left Column: Date + Image */}
                  <div className="w-40 flex-shrink-0">
                    <time className="block font-sans text-[11px] font-normal tracking-[0.18em] uppercase text-muted-foreground mb-6">
                      {article.published_at
                        ? format(new Date(article.published_at), "MMMM d yyyy")
                        : ""}
                    </time>
                    {article.hero_image_url && (
                      <img
                        src={article.hero_image_url}
                        alt={article.title}
                        className="w-[240px] h-[135px] object-cover"
                      />
                    )}
                  </div>

                  {/* Right Column: Category + Title + Excerpt */}
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-[12px] font-semibold tracking-[0.18em] text-[#C70033] mb-1">
                      {article.section}
                    </div>
                    <h3 className="font-serif text-[18px] font-medium leading-[1.25] text-foreground mb-1.5 hover:underline">
                      {article.title}
                    </h3>
                    <p className="font-sans text-[13px] leading-[1.4] text-muted-foreground line-clamp-3">
                      {article.summary}
                    </p>
                  </div>
                </article>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="py-8">
              {isFetchingNextPage ? (
                <div className="space-y-6">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-8 py-5 border-b border-border">
                      <div className="w-40">
                        <Skeleton className="h-4 w-24 mb-6" />
                        <Skeleton className="h-[135px] w-[240px]" />
                      </div>
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-2" />
                        <Skeleton className="h-6 w-full mb-2" />
                        <Skeleton className="h-16 w-full" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !hasNextPage ? (
                <p className="text-center text-muted-foreground text-sm font-sans">
                  No more stories
                </p>
              ) : null}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Home;
