import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";

const Home = () => {
  const navigate = useNavigate();

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

  // Fetch all other articles (excluding the recent story)
  const { data: allArticles, isLoading: loadingArticles } = useQuery({
    queryKey: ["all-articles", recentStory?.id],
    queryFn: async () => {
      let query = supabase
        .from("articles")
        .select("id, title, slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(20);

      // Exclude the recent story from the list
      if (recentStory?.id) {
        query = query.neq("id", recentStory.id);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !loadingRecent, // Wait for recent story to load first
  });

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
                </>
              ) : (
                <p className="text-center py-6 text-muted-foreground text-sm">
                  No more articles available
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
