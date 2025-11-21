import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const FEATURED_SECTIONS = ["economy-inflation", "markets-banking", "public-finance-debt"];
const ARTICLES_PER_SECTION = 3;

const Home = () => {
  const navigate = useNavigate();

  const { data: topStories, isLoading: loadingTop } = useQuery({
    queryKey: ["top-stories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .eq("section", "top-stories")
        .order("published_at", { ascending: false })
        .limit(5);
      
      if (error) throw error;
      return data;
    },
  });

  const { data: featuredSections, isLoading: loadingFeatured } = useQuery({
    queryKey: ["featured-sections"],
    queryFn: async () => {
      const results = await Promise.all(
        FEATURED_SECTIONS.map(async (sectionSlug) => {
          const { data, error } = await supabase
            .from("articles")
            .select("id, title, slug, section, summary, hero_image_url, published_at")
            .eq("is_published", true)
            .eq("section", sectionSlug)
            .order("published_at", { ascending: false })
            .limit(ARTICLES_PER_SECTION);
          
          if (error) throw error;
          return { slug: sectionSlug, articles: data };
        })
      );
      return results;
    },
  });

  const isLoading = loadingTop || loadingFeatured;

  const getSectionLabel = (slug: string) => {
    const labels: Record<string, string> = {
      "economy-inflation": "Economy & Inflation",
      "markets-banking": "Markets & Banking",
      "public-finance-debt": "Public Finance & Debt"
    };
    return labels[slug] || slug;
  };

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
            {/* Top Stories Section */}
            <div className="px-4 pt-4">
              <div className="pb-2 mb-2">
                <h2 className="font-serif text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">
                  Top Stories
                </h2>
              </div>
              {topStories && topStories.length > 0 ? (
                <>
                  {topStories.map((article, index) => (
                    <RankedArticleItem 
                      key={article.id} 
                      article={article}
                      rank={index}
                      isHero={index === 0}
                    />
                  ))}
                  <div className="pt-4 pb-6 text-center">
                    <button
                      onClick={() => navigate("/section/top-stories")}
                      className="font-serif text-sm font-medium hover:underline"
                    >
                      View all Top Stories →
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  No top stories available
                </p>
              )}
            </div>

            {/* Featured Sections */}
            {featuredSections?.map((section) => (
              section.articles.length > 0 && (
                <div key={section.slug} className="px-4 py-6 border-t border-border">
                  <div className="pb-2 mb-2">
                    <h2 className="font-serif text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">
                      {getSectionLabel(section.slug)}
                    </h2>
                  </div>
                  {section.articles.map((article, index) => (
                    <RankedArticleItem 
                      key={article.id} 
                      article={article}
                      rank={index}
                      isHero={false}
                    />
                  ))}
                  <div className="pt-4 text-center">
                    <button
                      onClick={() => navigate(`/section/${section.slug}`)}
                      className="font-serif text-sm font-medium hover:underline"
                    >
                      View all {getSectionLabel(section.slug)} →
                    </button>
                  </div>
                </div>
              )
            ))}
          </>
        )}
      </main>
    </div>
  );
};

export default Home;
