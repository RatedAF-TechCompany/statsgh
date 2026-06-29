"use client";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Header } from "@/components/Header";
import Footer from "@/components/Footer";
import { SectionBlock } from "@/components/home/SectionBlock";
import DataRail from "@/components/home/DataRail";
import MostReadRail from "@/components/home/MostReadRail";
import { FTSectionLabel } from "@/components/home/FTSectionLabel";
import { StoryItem } from "@/components/home/StoryItem";
import { SITE_SECTIONS, getSectionLabel } from "@/lib/navigation";
import { getSectionForCategory } from "@/lib/sectionMapping";
import {
  fetchHomepageArticles,
  type HomepageArticle,
  type MostReadArticle,
} from "@/lib/homepage-data";

interface HomeProps {
  initialArticles?: HomepageArticle[];
  initialMostRead?: MostReadArticle[];
}

const Home = ({ initialArticles, initialMostRead }: HomeProps = {}) => {
  // Server-rendered batch is passed in as initialData so the article zones are
  // present in the initial HTML; the client hydrates and refetches for freshness.
  const { data: allArticles, isLoading } = useQuery({
    queryKey: ["homepage-articles-dense"],
    queryFn: () => fetchHomepageArticles(supabase),
    initialData: initialArticles,
    staleTime: 60_000,
  });

  const articles = allArticles || [];

  // Zone A: Top 5 stories
  const topStories = articles.slice(0, 5);
  const leadStory = topStories[0];
  const col2Stories = topStories.slice(1, 3);
  const col3Stories = topStories.slice(3, 5);

  // Zone B: Next 3 stories (spotlight)
  const spotlightStories = articles.slice(5, 8);

  // Remaining: group by section
  const restArticles = articles.slice(8);
  const sectionArticles: Record<string, typeof restArticles> = {};
  restArticles.forEach((a) => {
    const sec = a.section || getSectionForCategory(a.category_slug);
    if (!sectionArticles[sec]) sectionArticles[sec] = [];
    sectionArticles[sec].push(a);
  });

  // Date string
  const today = new Date();
  const dateStr = today.toLocaleDateString("en-GB", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-white">
      <h1 className="sr-only">StatsGH — Ghana's Premier Data Journalism Platform</h1>
      <Header showTicker />

      {/* Date strip */}
      <div className="border-b border-[#D9D9D9]">
        <div className="max-w-[1280px] mx-auto px-4 md:px-6 py-2">
          <span className="font-ui text-[12px] text-[#5B5B5B]">
            {dateStr} <span className="text-[#ccc] mx-2">|</span> Ghana's Premier Data Journalism Platform
          </span>
        </div>
      </div>

      <main className="max-w-[1280px] mx-auto px-4 md:px-6">
        {isLoading ? (
          <div className="py-8 space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-5 w-full" />
            <div className="grid grid-cols-4 gap-4 mt-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* ═══ ZONE A — TOP STORIES ═══ */}
            <div className="py-6 border-b border-[#D9D9D9]">
              <FTSectionLabel label="Top Stories" to="/" />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-x-6 gap-y-6">
                {/* Lead spans 2 columns — image-left/text-right inside */}
                <div className="min-w-0 md:col-span-2">
                  {leadStory && (
                    <StoryItem
                      article={leadStory as any}
                      variant="lead"
                      showImage
                      showSummary
                      eager
                    />
                  )}
                </div>

                {/* Right column — stacked secondaries with thumbs */}
                <div className="min-w-0 md:border-l md:border-[#D9D9D9] md:pl-6">
                  {[...col2Stories, ...col3Stories].slice(0, 4).map((a) => (
                    <StoryItem key={a.id} article={a as any} variant="secondary" showImage />
                  ))}
                </div>
              </div>
            </div>

            {/* ═══ ZONE B — SPOTLIGHT ═══ */}
            {spotlightStories.length >= 3 && (
              <div className="py-5 border-b border-[#D9D9D9]">
                <FTSectionLabel
                  label={getSectionLabel(spotlightStories[0].category_slug)}
                  to={`/${getSectionForCategory(spotlightStories[0].category_slug)}`}
                />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-x-0 gap-y-4">
                  {spotlightStories.map((a, i) => (
                    <div
                      key={a.id}
                      className={`${i > 0 ? "md:border-l md:border-[#D9D9D9] md:pl-5" : ""} ${i < 2 ? "md:pr-5" : ""}`}
                    >
                      <StoryItem
                        article={a as any}
                        variant="secondary"
                        showImage={!!a.hero_image_url}
                        showSummary
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ═══ ZONE C — MAIN + RIGHT RAIL ═══ */}
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-x-8 py-4">
              {/* Main content — section blocks */}
              <div>
                {(() => {
                  const spotlightSection = spotlightStories[0]
                    ? getSectionForCategory(spotlightStories[0].category_slug)
                    : null;
                  const renderedSlugs = new Set<string>();
                  if (spotlightSection) renderedSlugs.add(spotlightSection);
                  return SITE_SECTIONS.filter((s) => s.slug !== "top-stories").map((section) => {
                    if (renderedSlugs.has(section.slug)) return null;
                    const arts = sectionArticles[section.slug];
                    if (!arts || arts.length < 4) return null;
                    renderedSlugs.add(section.slug);
                    return (
                      <SectionBlock
                        key={section.slug}
                        sectionLabel={section.label}
                        sectionSlug={section.slug}
                        articles={arts as any}
                      />
                    );
                  });
                })()}
              </div>

              {/* Right rail */}
              <div className="hidden lg:block">
                <MostReadRail initialData={initialMostRead} />
                <DataRail />
              </div>
            </div>

            {/* Mobile: right rail content at bottom */}
            <div className="lg:hidden py-6 border-t border-[#D9D9D9]">
              <MostReadRail initialData={initialMostRead} />
              <DataRail />
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

// ── Inline data widget for Zone A col 4 ──
const DataWidget = () => {
  const { data: currencies } = useQuery({
    queryKey: ["widget-currencies"],
    queryFn: async () => {
      const { data } = await supabase
        .from("currency_rates")
        .select("base_currency, rate, change_percent")
        .eq("target_currency", "GHS")
        .order("fetched_at", { ascending: false })
        .limit(5);
      const seen = new Set<string>();
      return (data || []).filter((r) => {
        if (seen.has(r.base_currency || "")) return false;
        seen.add(r.base_currency || "");
        return true;
      });
    },
    refetchInterval: 60000,
  });

  const { data: commodities } = useQuery({
    queryKey: ["widget-commodities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("commodity_prices")
        .select("commodity, price, change_percent")
        .order("fetched_at", { ascending: false })
        .limit(10);
      const seen = new Set<string>();
      return (data || []).filter((c) => {
        if (seen.has(c.commodity)) return false;
        seen.add(c.commodity);
        return true;
      });
    },
    refetchInterval: 60000,
  });

  const items = [
    ...(currencies || []).slice(0, 2).map((r) => ({
      label: `${r.base_currency}/GHS`,
      value: r.rate.toFixed(2),
      change: r.change_percent,
    })),
    ...(commodities || []).slice(0, 3).map((c) => ({
      label: c.commodity.replace(/_/g, " ").replace(/\b\w/g, (ch: string) => ch.toUpperCase()),
      value: `$${c.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
      change: c.change_percent,
    })),
  ];

  return (
    <div className="space-y-0">
      {items.map((item, i) => (
        <div key={i} className="flex items-center justify-between py-1.5 border-t border-[#D9D9D9]">
          <span className="font-ui text-[11px] font-medium text-[#121212]">{item.label}</span>
          <div className="flex items-center gap-1.5">
            <span className="font-ui text-[12px] font-semibold text-[#121212]">{item.value}</span>
            {item.change !== null && (
              <span className={`font-ui text-[10px] ${(item.change ?? 0) > 0 ? "text-[#00A36C]" : (item.change ?? 0) < 0 ? "text-[#E3120B]" : "text-[#5B5B5B]"}`}>
                {(item.change ?? 0) > 0 ? "+" : ""}{(item.change ?? 0).toFixed(1)}%
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default Home;
