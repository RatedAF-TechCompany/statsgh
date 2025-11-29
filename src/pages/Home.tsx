import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Menu, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SITE_NAVIGATION } from "@/lib/navigation";

const ARTICLES_PER_PAGE = 20;

const Home = () => {
  const navigate = useNavigate();
  const observerTarget = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);

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
  const [leadStory, ...headlines] = allArticles;

  return (
    <div className="min-h-screen bg-background">
      {/* Simplified Mobile Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background sticky top-0 z-10">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button 
              className="p-2 -ml-2 hover:opacity-70 transition-opacity"
              aria-label="Menu"
            >
              <Menu size={24} className="text-ft-maroon" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px]">
            <SheetHeader>
              <SheetTitle className="text-ft-maroon font-serif">Navigation</SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-1">
              {SITE_NAVIGATION.categories.map((item) => (
                item.type === "external" ? (
                  <a
                    key={item.slug}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-2 text-ft-maroon hover:bg-muted rounded-md transition-colors"
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </a>
                ) : (
                  <button
                    key={item.slug}
                    onClick={() => {
                      navigate(`/category/${item.slug}`);
                      setMenuOpen(false);
                    }}
                    className="px-3 py-2 text-ft-maroon hover:bg-muted rounded-md transition-colors text-left"
                  >
                    {item.label}
                  </button>
                )
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <h1 className="font-serif text-lg font-semibold text-ft-maroon">
          StatsGH
        </h1>
        <button 
          onClick={() => navigate('/auth')}
          className="p-2 -mr-2 hover:opacity-70 transition-opacity"
          aria-label="User account"
        >
          <User size={22} className="text-ft-maroon" />
        </button>
      </header>

      <main className="max-w-3xl mx-auto">
        {isLoading ? (
          <div className="px-4">
            {/* Lead Story Skeleton */}
            <div className="py-3 pb-6">
              <Skeleton className="w-full aspect-video mb-3" />
              <Skeleton className="h-7 w-full mb-2" />
              <Skeleton className="h-7 w-3/4 mb-3" />
              <Skeleton className="h-5 w-full mb-1" />
              <Skeleton className="h-5 w-full mb-1" />
              <Skeleton className="h-5 w-2/3" />
            </div>
            
            {/* Headlines Skeleton */}
            {[...Array(5)].map((_, i) => (
              <div key={i} className="py-4 border-t border-border">
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-4/5" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Lead Story */}
            {leadStory && (
              <article 
                className="px-4 py-3 pb-6 cursor-pointer"
                onClick={() => navigate(`/article/${leadStory.slug}`)}
              >
                {leadStory.hero_image_url && (
                  <img
                    src={leadStory.hero_image_url}
                    alt={leadStory.title}
                    className="w-full aspect-video object-cover mb-3"
                  />
                )}
                <h1 className="font-serif text-[22px] leading-[28px] font-medium text-ft-maroon mb-2">
                  {leadStory.title}
                </h1>
                {leadStory.summary && (
                  <p className="font-sans text-[14px] leading-[20px] text-ft-maroon line-clamp-3">
                    {leadStory.summary}
                  </p>
                )}
              </article>
            )}

            {/* Headlines List */}
            <div className="px-4">
              {headlines.map((article) => (
                <article
                  key={article.id}
                  className="py-4 border-t border-border cursor-pointer hover:opacity-70 transition-opacity"
                  onClick={() => navigate(`/article/${article.slug}`)}
                >
                  <h2 className="font-serif text-[17px] leading-[23px] font-medium text-ft-maroon">
                    {article.title}
                  </h2>
                </article>
              ))}
            </div>

            {/* Infinite scroll trigger */}
            <div ref={observerTarget} className="px-4 py-8">
              {isFetchingNextPage ? (
                <div>
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="py-4 border-t border-border">
                      <Skeleton className="h-6 w-full mb-2" />
                      <Skeleton className="h-6 w-4/5" />
                    </div>
                  ))}
                </div>
              ) : !hasNextPage ? (
                <p className="text-center text-ft-maroon text-sm font-sans py-4 border-t border-border">
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
