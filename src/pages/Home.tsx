import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import EconomicIndicatorStrip from "@/components/home/EconomicIndicatorStrip";
import { SectionBlock } from "@/components/home/SectionBlock";
import DataRail from "@/components/home/DataRail";
import { Button } from "@/components/ui/button";
import { SITE_SECTIONS, getSectionLabel, getSectionSlug } from "@/lib/navigation";
import { getSectionForCategory } from "@/lib/sectionMapping";

const ARTICLES_PER_PAGE = 40;

const Home = () => {
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);

  const { data: articlesData, isLoading } = useQuery({
    queryKey: ["all-articles-ft", currentPage],
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

  const leadArticle = allArticles[0];
  const secondaryArticles = allArticles.slice(1, 3);
  const restArticles = allArticles.slice(3);

  // Group remaining articles by section
  const sectionArticles: Record<string, typeof restArticles> = {};
  restArticles.forEach((a) => {
    const sec = getSectionForCategory(a.category_slug);
    if (!sectionArticles[sec]) sectionArticles[sec] = [];
    sectionArticles[sec].push(a);
  });

  const getTimeAgo = (publishedAt: string | null) => {
    if (!publishedAt) return "";
    const now = new Date();
    const published = new Date(publishedAt);
    const minutesAgo = Math.floor((now.getTime() - published.getTime()) / (1000 * 60));
    if (minutesAgo < 60) return `${minutesAgo}m ago`;
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo < 24) return `${hoursAgo}h ago`;
    const daysAgo = Math.floor(hoursAgo / 24);
    return `${daysAgo}d ago`;
  };

  return (
    <div className="min-h-screen bg-[#FFF1E0]">
      <Header />
      <EconomicIndicatorStrip />

      <main className="max-w-[1280px] mx-auto px-4 md:px-6">
        {isLoading ? (
          <div className="py-8">
            <Skeleton className="h-12 w-3/4 mb-4 skeleton-ft" />
            <Skeleton className="h-6 w-full mb-2 skeleton-ft" />
            <Skeleton className="h-6 w-2/3 skeleton-ft" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
              <Skeleton className="h-32 skeleton-ft" />
              <Skeleton className="h-32 skeleton-ft" />
            </div>
          </div>
        ) : (
          <>
            {/* Zone A — Hero */}
            {leadArticle && (
              <div className="py-8 border-b border-[#E8D9C5]">
              <div className="grid grid-cols-1 lg:grid-cols-[58%_42%] items-start gap-0">
                  <article
                    className="cursor-pointer group flex flex-col justify-start pr-6"
                    onClick={() => navigate(`/${leadArticle.category_slug}/${leadArticle.slug}`)}
                  >
                    <span className="section-label">
                      {getSectionLabel(leadArticle.category_slug)}
                    </span>
                    <h1 className="font-headline text-[36px] md:text-[48px] font-bold leading-[1.08] text-[#33302E] group-hover:text-[#0D7680] transition-colors mt-2">
                      {leadArticle.title}
                    </h1>
                    {leadArticle.summary && (
                      <p className="font-serif text-[17px] text-[#66605A] mt-3 leading-relaxed line-clamp-2">
                        {leadArticle.summary}
                      </p>
                    )}
                    <span className="font-ui text-xs text-[#66605A] mt-3 block">
                      {getTimeAgo(leadArticle.published_at)}
                    </span>
                  </article>

                  {/* Hero image — 40% width, flush right */}
                  {leadArticle.hero_image_url && (
                    <div
                      className="cursor-pointer"
                      onClick={() => navigate(`/${leadArticle.category_slug}/${leadArticle.slug}`)}
                    >
                      <img
                        src={leadArticle.hero_image_url}
                        alt={leadArticle.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Zone B — Secondary stories */}
            {secondaryArticles.length > 0 && (
              <div className="py-6 border-b border-[#E8D9C5]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 items-stretch">
                  {secondaryArticles.map((article, i) => (
                    <article
                      key={article.id}
                      className={`cursor-pointer group flex flex-col ${i === 0 ? "md:pr-6 md:border-r md:border-[#E8D9C5]" : "md:pl-6"} ${i > 0 ? "mt-6 md:mt-0 pt-6 md:pt-0 border-t md:border-t-0 border-[#E8D9C5]" : ""}`}
                      onClick={() => navigate(`/${article.category_slug}/${article.slug}`)}
                    >
                      <span className="section-label">
                        {getSectionLabel(article.category_slug)}
                      </span>
                      <h2 className="font-headline text-[26px] font-semibold leading-[1.2] text-[#33302E] group-hover:text-[#0D7680] transition-colors mt-1">
                        {article.title}
                      </h2>
                      {article.summary && (
                        <p className="font-serif text-[15px] text-[#66605A] mt-2 line-clamp-1 leading-relaxed">
                          {article.summary}
                        </p>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}

            {/* Zone D + E — Section blocks + Data Rail */}
            <div className="grid grid-cols-1 lg:grid-cols-6 gap-8 py-4">
              {/* Section blocks (4.5 cols) */}
              <div className="lg:col-span-4">
                {SITE_SECTIONS.filter(s => s.slug !== "top-stories").map((section) => {
                  const articles = sectionArticles[section.slug];
                  if (!articles || articles.length === 0) return null;
                  return (
                    <SectionBlock
                      key={section.slug}
                      sectionLabel={section.label}
                      sectionSlug={section.slug}
                      articles={articles}
                    />
                  );
                })}

                {/* Pagination */}
                {(currentPage > 1 || hasNextPage) && (
                  <div className="py-8 flex justify-center gap-3">
                    {currentPage > 1 && (
                      <Button
                        variant="outline"
                        className="font-ui border-[#E8D9C5] text-[#33302E] hover:bg-[#E8D9C5]"
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
                        className="font-ui border-[#E8D9C5] text-[#33302E] hover:bg-[#E8D9C5]"
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
              </div>

              {/* Data Rail (1.5 cols) */}
              <div className="lg:col-span-2 hidden lg:block">
                <DataRail />
              </div>
            </div>

            {/* Mobile Data Rail */}
            <div className="lg:hidden py-6 border-t border-[#E8D9C5]">
              <DataRail />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Home;
