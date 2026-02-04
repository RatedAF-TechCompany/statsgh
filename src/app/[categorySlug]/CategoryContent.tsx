"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { RankedArticleItem } from "@/components/RankedArticleItem";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

const ARTICLES_PER_PAGE = 10;

interface CategoryContentProps {
  categorySlug: string;
  categoryLabel: string;
}

export default function CategoryContent({ categorySlug, categoryLabel }: CategoryContentProps) {
  const [currentPage, setCurrentPage] = useState(1);

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["category-articles", categorySlug, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .eq("category_slug", categorySlug)
        .order("published_at", { ascending: false })
        .range(from, to);

      if (error) throw error;
      return data;
    },
  });

  const articles = articlesData || [];
  const hasNextPage = articles.length === ARTICLES_PER_PAGE;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="max-w-[480px] mx-auto bg-background">
        <div className="px-4 pt-4">
          <div className="pb-2 mb-2">
            <h1 className="font-serif text-sm font-bold tracking-[0.2em] uppercase text-muted-foreground">
              {categoryLabel}
            </h1>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              {[...Array(10)].map((_, i) => (
                <div key={i} className="py-3 border-b border-border">
                  <Skeleton className="h-6 w-full mb-2" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ))}
            </div>
          ) : articles.length > 0 ? (
            <>
              {articles.map((article, index) => (
                <RankedArticleItem
                  key={article.id}
                  article={article}
                  rank={index}
                  isHero={index === 0}
                  showImage={index > 0 && index % 5 === 0}
                />
              ))}

              {(currentPage > 1 || hasNextPage) && (
                <div className="py-6 flex justify-center gap-3">
                  {currentPage > 1 && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCurrentPage(currentPage - 1);
                        window.scrollTo({ top: 0, behavior: "smooth" });
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
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                    >
                      Next
                    </Button>
                  )}
                </div>
              )}
            </>
          ) : (
            <p className="text-center py-6 text-muted-foreground text-sm">
              No articles found in this category
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
