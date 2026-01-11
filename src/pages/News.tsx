import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { getWordCount, formatTime } from "@/components/ReadingTime";
import { Clock } from "lucide-react";
const News = () => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ["news-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, slug")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch articles
  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["news-articles", selectedCategory, page],
    queryFn: async () => {
      let query = supabase
        .from("articles")
        .select("id, title, slug, summary, body, hero_image_url, published_at, category_slug, author_name, tags", { count: "exact" })
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .range((page - 1) * pageSize, page * pageSize - 1);

      if (selectedCategory) {
        query = query.eq("category_slug", selectedCategory);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { articles: data || [], total: count || 0 };
    },
  });

  const articles = articlesData?.articles || [];
  const totalPages = Math.ceil((articlesData?.total || 0) / pageSize);

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-8">
        {/* Page Header */}
        <header className="mb-8">
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-3">
            News
          </h1>
          <p className="text-muted-foreground text-lg">
            Latest data journalism and analysis from Ghana.
          </p>
        </header>

        {/* Category Filters */}
        <div className="flex flex-wrap gap-2 mb-8">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setSelectedCategory(null);
              setPage(1);
            }}
          >
            All
          </Button>
          {categories?.slice(0, 8).map((cat) => (
            <Button
              key={cat.id}
              variant={selectedCategory === cat.slug ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setSelectedCategory(cat.slug);
                setPage(1);
              }}
            >
              {cat.name}
            </Button>
          ))}
        </div>

        {/* Articles Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-video w-full" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-6 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg">No articles found.</p>
          </div>
        ) : (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {articles.map((article) => (
                <article
                  key={article.id}
                  className="group cursor-pointer"
                  onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
                >
                  {article.hero_image_url && (
                    <div className="aspect-video overflow-hidden rounded-lg mb-3">
                      <img
                        src={article.hero_image_url}
                        alt={article.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <Badge variant="outline" className="mb-2 text-xs capitalize">
                    {article.category_slug?.replace(/-/g, " ")}
                  </Badge>
                  <h2 className="font-serif text-lg font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 mb-2">
                    {article.title}
                  </h2>
                  {article.summary && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {article.summary}
                    </p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    {article.author_name && <span>{article.author_name}</span>}
                    {article.published_at && (
                      <>
                        <span>·</span>
                        <time>{format(new Date(article.published_at), "MMM d, yyyy")}</time>
                      </>
                    )}
                    {article.body && (
                      <>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatTime(getWordCount(article.body) / 238)} read
                        </span>
                      </>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center gap-2 mt-10">
                <Button
                  variant="outline"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span className="flex items-center px-4 text-sm text-muted-foreground">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default News;
