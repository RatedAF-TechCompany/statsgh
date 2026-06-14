"use client";
import { useLocation, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CATEGORY_MAPPING, getSectionLabel } from "@/lib/navigation";
import { getCategoriesForSection } from "@/lib/sectionMapping";
import { Button } from "@/components/ui/button";
import { usePageMeta } from "@/hooks/usePageMeta";
import NotFound from "./NotFound";

const ARTICLES_PER_PAGE = 20;

const getTimeAgo = (publishedAt: string | null) => {
  if (!publishedAt) return "";
  const now = new Date();
  const published = new Date(publishedAt);
  const minutesAgo = Math.floor((now.getTime() - published.getTime()) / (1000 * 60));
  if (minutesAgo < 60) return `${minutesAgo}m ago`;
  const hoursAgo = Math.floor(minutesAgo / 60);
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  return `${Math.floor(hoursAgo / 24)}d ago`;
};

const Category = () => {
  const { categorySlug, slug } = useParams();
  const location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const fallbackSlug = pathSegments[0] === "category" ? pathSegments[1] : pathSegments[0];
  const categoryParam = categorySlug || slug || fallbackSlug;
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const categorySlugs = categoryParam ? getCategoriesForSection(categoryParam) : [];

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["category-articles", categoryParam, currentPage],
    queryFn: async () => {
      const from = (currentPage - 1) * ARTICLES_PER_PAGE;
      const to = from + ARTICLES_PER_PAGE - 1;

      // Query by both category_slug (mapped values) AND section column for full coverage
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, slug, category_slug, section, summary, hero_image_url, published_at")
        .eq("is_published", true)
        .or(`category_slug.in.(${categorySlugs.map(s => `"${s}"`).join(',')}),section.eq.${categoryParam}`)
        .order("published_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return data;
    },
    enabled: categorySlugs.length > 0,
  });

  const articles = articlesData || [];
  const hasNextPage = articles.length === ARTICLES_PER_PAGE;
  const categoryLabel = categoryParam
    ? CATEGORY_MAPPING[categoryParam as keyof typeof CATEGORY_MAPPING] || getSectionLabel(categoryParam)
    : "";

  const leadArticle = articles[0];
  const restArticles = articles.slice(1);

  const isUnknownSection = !!categoryParam && categorySlugs.length === 0;

  usePageMeta({
    title: isUnknownSection
      ? "Page not found | StatsGH"
      : categoryLabel
        ? `${categoryLabel} — News and Data from Ghana | StatsGH`
        : "StatsGH",
    description: categoryLabel && !isUnknownSection
      ? `Latest ${categoryLabel.toLowerCase()} news, analysis, and data from Ghana. Data-driven reporting from StatsGH.`
      : undefined,
    ogType: "website",
    robots: isUnknownSection ? "noindex, follow" : undefined,
  });

  if (isUnknownSection) {
    return <NotFound />;
  }

  return (
    <div className="min-h-screen bg-[#FFFFFF]">
      <Header />

      <main className="max-w-[1280px] mx-auto px-4 md:px-6 py-8">
        {/* Section title */}
        <div className="border-b border-[#E3120B] pb-3 mb-8">
          <h1 className="section-label text-base">{categoryLabel}</h1>
        </div>

        {isLoading ? (
          <div className="space-y-6">
            <Skeleton className="h-10 w-3/4 skeleton-ft" />
            <Skeleton className="h-6 w-full skeleton-ft" />
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full skeleton-ft" />
            ))}
          </div>
        ) : articles.length > 0 ? (
          <>
            {/* Lead article */}
            {leadArticle && (
              <article
                className="pb-8 border-b border-[#D9D9D9] mb-6 cursor-pointer group"
                onClick={() => navigate(`/${leadArticle.category_slug}/${leadArticle.slug}`)}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h2 className="font-headline text-[28px] md:text-[34px] font-bold leading-[1.15] text-[#121212] group-hover:text-[#E3120B] transition-colors">
                      {leadArticle.title}
                    </h2>
                    {leadArticle.summary && (
                      <p className="font-serif text-[15px] text-[#5B5B5B] mt-3 leading-relaxed line-clamp-3">
                        {leadArticle.summary}
                      </p>
                    )}
                    {leadArticle.published_at && (
                      <span className="font-ui text-xs text-[#5B5B5B] mt-3 block">
                        {getTimeAgo(leadArticle.published_at)}
                      </span>
                    )}
                  </div>
                  {leadArticle.hero_image_url && (
                    <img
                      src={leadArticle.hero_image_url}
                      alt={leadArticle.title}
                      className="w-full aspect-[4/3] object-cover"
                    />
                  )}
                </div>
              </article>
            )}

            {/* Rest of articles */}
            <div className="space-y-0">
              {restArticles.map((article) => (
                <article
                  key={article.id}
                  className="py-4 border-b border-[#D9D9D9] cursor-pointer group flex gap-4"
                  onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
                >
                  <div className="flex-1 min-w-0">
                    <h3 className="font-headline text-lg font-semibold leading-snug text-[#121212] group-hover:text-[#E3120B] transition-colors">
                      {article.title}
                    </h3>
                    {article.summary && (
                      <p className="font-serif text-sm text-[#5B5B5B] mt-1 line-clamp-1">
                        {article.summary}
                      </p>
                    )}
                    {article.published_at && (
                      <span className="font-ui text-xs text-[#5B5B5B] mt-1 block">
                        {getTimeAgo(article.published_at)}
                      </span>
                    )}
                  </div>
                  {article.hero_image_url && (
                    <img
                      src={article.hero_image_url}
                      alt=""
                      className="w-20 h-20 object-cover flex-shrink-0"
                    />
                  )}
                </article>
              ))}
            </div>

            {/* Pagination */}
            {(currentPage > 1 || hasNextPage) && (
              <div className="py-8 flex justify-center gap-3">
                {currentPage > 1 && (
                  <Button
                    variant="outline"
                    className="font-ui border-[#D9D9D9] text-[#121212] hover:bg-[#D9D9D9]"
                    onClick={() => { setCurrentPage(currentPage - 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    Previous
                  </Button>
                )}
                {hasNextPage && (
                  <Button
                    variant="outline"
                    className="font-ui border-[#D9D9D9] text-[#121212] hover:bg-[#D9D9D9]"
                    onClick={() => { setCurrentPage(currentPage + 1); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  >
                    Next
                  </Button>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-center py-12 text-[#5B5B5B] font-ui text-sm">
            No articles found in this section.
          </p>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Category;
