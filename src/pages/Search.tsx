import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search as SearchIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";

interface Article {
  id: string;
  title: string;
  slug: string;
  category_slug: string;
  summary: string;
  hero_image_url: string | null;
  published_at: string;
  section: string;
}

const Search = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");
  const [articles, setArticles] = useState<Article[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  usePageMeta({
    title: "Search Articles | StatsGH",
    description: "Search StatsGH's archive of data journalism articles on Ghana's economy, markets, and public policy.",
    robots: "noindex, nofollow",
  });

  useEffect(() => {
    const delaySearch = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch(searchQuery.trim());
        setSearchParams({ q: searchQuery.trim() });
      } else {
        setArticles([]);
        setHasSearched(false);
      }
    }, 300);

    return () => clearTimeout(delaySearch);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    setIsLoading(true);
    setHasSearched(true);

    try {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug, summary, hero_image_url, published_at, section")
        .eq("is_published", true)
        .or(`title.ilike.%${query}%,summary.ilike.%${query}%,body.ilike.%${query}%`)
        .order("published_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setArticles(data || []);
    } catch (error) {
      console.error("Search error:", error);
      setArticles([]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center gap-3 px-4 bg-background sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="hover:opacity-70"
        >
          <ArrowLeft size={24} className="text-ft-maroon" />
        </Button>
        <h1 className="font-serif text-lg font-semibold text-ft-maroon">
          Search
        </h1>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Search Input */}
        <div className="relative mb-6">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-ft-maroon" size={20} />
          <Input
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 text-base border-border focus:border-ft-maroon"
            autoFocus
          />
        </div>

        {/* Search Results */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="py-4 border-t border-border">
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))}
          </div>
        ) : hasSearched ? (
          articles.length > 0 ? (
            <div>
              <p className="text-sm text-ft-maroon mb-4 font-sans">
                Found {articles.length} {articles.length === 1 ? "article" : "articles"}
              </p>
              <div className="space-y-0">
                {articles.map((article) => (
                  <article
                    key={article.id}
                    className="py-4 border-t border-border cursor-pointer hover:opacity-70 transition-opacity"
                    onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
                  >
                    <div className="flex gap-3">
                      {article.hero_image_url && (
                        <img
                          src={article.hero_image_url}
                          alt={article.title}
                          className="w-20 h-20 object-cover flex-shrink-0"
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <h2 className="font-serif text-[17px] leading-[23px] font-medium text-ft-maroon mb-1">
                          {article.title}
                        </h2>
                        <p className="font-sans text-[14px] leading-[18px] text-ft-maroon line-clamp-2">
                          {article.summary}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-ft-maroon font-sans">
                No articles found for "{searchQuery}"
              </p>
              <p className="text-sm text-ft-maroon/70 mt-2 font-sans">
                Try different keywords
              </p>
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <SearchIcon size={48} className="text-ft-maroon/30 mx-auto mb-3" />
            <p className="text-ft-maroon/70 font-sans">
              Enter at least 2 characters to search
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Search;
