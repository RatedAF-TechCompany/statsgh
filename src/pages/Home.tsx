import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;

const Home = () => {
  const [searchParams] = useSearchParams();
  const section = searchParams.get("section");
  const observerTarget = useRef<HTMLDivElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useInfiniteQuery({
      queryKey: ["articles", section, searchQuery],
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

        if (searchQuery.trim()) {
          query = query.or(
            `title.ilike.%${searchQuery}%,summary.ilike.%${searchQuery}%,section.ilike.%${searchQuery}%`
          );
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

  // Handle click outside to close search
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(event.target as Node)) {
        setIsSearchOpen(false);
      }
    };

    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSearchOpen(false);
      }
    };

    if (isSearchOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleEscKey);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscKey);
    };
  }, [isSearchOpen]);

  const articles = data?.pages.flat() ?? [];

  // Group articles by date
  const groupedArticles = articles.reduce((groups: { [key: string]: typeof articles }, article) => {
    const date = article.published_at 
      ? new Date(article.published_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "Unknown Date";
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(article);
    return groups;
  }, {});

  const dateGroups = Object.entries(groupedArticles);

  const today = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-background">
      <Header onSearchToggle={() => setIsSearchOpen(!isSearchOpen)} />

      <main className="max-w-2xl mx-auto">
        <div className="px-4 pt-4">
          <h2 className="font-sans text-2xl font-medium mb-2">
            {section ? `More ${section}` : "More World"}
          </h2>
          <div className="border-b border-divider mb-2" />
          <div className="text-xs uppercase text-muted-text mb-4">
            {today}
          </div>
          
          {isSearchOpen && (
            <div 
              ref={searchContainerRef}
              className="relative mb-4 animate-in slide-in-from-top-2 fade-in duration-200"
            >
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-text" />
              <Input
                type="text"
                placeholder="Search articles by title, summary, or section..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-10"
                autoFocus
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                onClick={() => {
                  setSearchQuery("");
                  setIsSearchOpen(false);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
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
            {dateGroups.map(([date, groupArticles]) => (
              <div key={date} className="px-4 mb-8">
                <div className="mb-2">
                  <h2 className="font-sans text-sm font-semibold text-[#4A3C35] mb-0">{date}</h2>
                  <hr className="border-0 border-t border-[#E2D4C6] my-2 mb-1" />
                </div>
                
                <h3 className="font-serif text-lg font-semibold text-[#111111] mb-3">
                  Stories most read
                </h3>
                
                <div className="flex flex-col gap-3">
                  {groupArticles.map((article, index) => (
                    <RankedArticleItem 
                      key={article.id} 
                      article={article}
                      rank={index + 1}
                    />
                  ))}
                </div>
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
