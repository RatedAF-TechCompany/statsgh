import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Menu, Search } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SITE_NAVIGATION } from "@/lib/navigation";
import { Button } from "@/components/ui/button";
import statsghLogo from "@/assets/statsgh-logo.png";
import { LeadStory } from "@/components/home/LeadStory";
import { SecondaryStory } from "@/components/home/SecondaryStory";
import { LatestNewsList } from "@/components/home/LatestNewsList";
import MostReadSidebar from "@/components/home/MostReadSidebar";
import DataHighlightsSidebar from "@/components/home/DataHighlightsSidebar";
import TopicsOverview from "@/components/TopicsOverview";
import GhanaAtAGlance from "@/components/home/GhanaAtAGlance";
import GSETickerStrip from "@/components/home/GSETickerStrip";

const ARTICLES_PER_PAGE = 20;

const Home = () => {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["all-articles", currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug, section, summary, word_count, hero_image_url, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return data;
    },
  });

  const allArticles = articlesData || [];
  const hasNextPage = allArticles.length === ARTICLES_PER_PAGE;
  
  // Split articles for different sections
  const leadArticle = allArticles[0];
  const secondaryArticles = allArticles.slice(1, 4); // Next 3 articles for grid
  const remainingArticles = allArticles.slice(4); // Rest for the list

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-background sticky top-0 z-10">
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetTrigger asChild>
            <button className="p-2 -ml-2 hover:opacity-70 transition-opacity" aria-label="Menu">
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
        
        <div className="flex items-center gap-1.5 sm:gap-2">
          <img src={statsghLogo} alt="StatsGH" className="h-6 sm:h-8" />
          <span className="font-serif text-base sm:text-lg font-semibold text-ft-maroon">StatsGH</span>
        </div>
        
        <button 
          onClick={() => navigate('/search')}
          className="p-2 -mr-2 hover:opacity-70 transition-opacity"
          aria-label="Search"
        >
          <Search size={22} className="text-ft-maroon" />
        </button>
      </header>

      {/* GSE Stock Ticker */}
      <GSETickerStrip />
      <main className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-8">
              <Skeleton className="h-64 w-full mb-4" />
              <Skeleton className="h-8 w-3/4 mb-2" />
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </div>
            <div className="lg:col-span-4">
              <Skeleton className="h-6 w-32 mb-4" />
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full mb-2" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Top Section: Lead Story + Most Read Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pb-6">
              {/* Lead Story (Main Column) */}
              <div className="lg:col-span-8">
                {leadArticle && <LeadStory article={leadArticle} />}
              </div>
              
              {/* Most Read Sidebar */}
              <aside className="lg:col-span-4">
                <MostReadSidebar />
              </aside>
            </div>

            {/* Secondary Stories Grid - Show more news before data */}
            {secondaryArticles.length > 0 && (
              <div className="pb-6 border-b border-border">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                  {secondaryArticles.map((article) => (
                    <SecondaryStory 
                      key={article.id} 
                      article={article} 
                      showImage={!!article.hero_image_url}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Ghana At A Glance - Full Width Strip */}
            <div className="-mx-4 my-6">
              <GhanaAtAGlance />
            </div>

            {/* Lower Section: More Stories + Topics/Data */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 pt-6">
              {/* More Stories */}
              <div className="lg:col-span-8">
                <LatestNewsList articles={remainingArticles} title="More stories" />
                
                {/* Pagination */}
                {(currentPage > 1 || hasNextPage) && (
                  <div className="py-6 flex justify-center gap-3">
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
              </div>
              
              {/* Right Sidebar: Topics + Data Highlights */}
              <aside className="lg:col-span-4 space-y-6">
                <section className="border-t-2 border-ft-maroon pt-3">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="font-serif text-base font-bold text-foreground">
                      Topics
                    </h2>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-ft-maroon hover:text-ft-maroon/80 -mt-1 h-auto py-0 text-xs"
                      onClick={() => navigate('/topics')}
                    >
                      View all →
                    </Button>
                  </div>
                  <TopicsOverview showHeader={false} limitIndicators={3} maxTopics={4} />
                </section>
                <DataHighlightsSidebar />
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Home;
