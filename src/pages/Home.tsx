import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, User, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SITE_NAVIGATION } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import { RankedArticleItem } from "@/components/RankedArticleItem";

const ARTICLES_PER_PAGE = 10;

// Top Stories category slug
const TOP_STORIES_SLUG = "top-stories";

const Home = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: articlesData,
    isLoading,
  } = useQuery({
    queryKey: ["all-articles", currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return data;
    },
  });

  const allArticles = articlesData || [];
  const hasNextPage = allArticles.length === ARTICLES_PER_PAGE;

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
                      navigate(`/${item.slug}`);
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
        <div className="flex items-center gap-1">
          <button 
            onClick={() => navigate('/search')}
            className="p-2 hover:opacity-70 transition-opacity"
            aria-label="Search"
          >
            <Search size={22} className="text-ft-maroon" />
          </button>
          <button 
            onClick={() => navigate('/auth')}
            className="p-2 -mr-2 hover:opacity-70 transition-opacity"
            aria-label="User account"
          >
            <User size={22} className="text-ft-maroon" />
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto">
        {isLoading ? (
          <div className="px-4">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="py-3 border-b border-border">
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : (
          <>
            <div className="px-4">
              {allArticles.map((article, index) => (
                <RankedArticleItem
                  key={article.id}
                  article={article}
                  rank={index}
                  isHero={index === 0}
                  showImage={index > 0 && (index % 5 === 0)}
                />
              ))}
            </div>

            {/* Pagination */}
            {(currentPage > 1 || hasNextPage) && (
              <div className="px-4 py-6 flex justify-center gap-3">
                {currentPage > 1 && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentPage(currentPage - 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Previous
                  </Button>
                )}
                {hasNextPage && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setCurrentPage(currentPage + 1);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                  >
                    Next
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Home;
