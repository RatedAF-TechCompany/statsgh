import type { Metadata } from "next";
import { getCategoryPageLabel } from "@/lib/navigation";
import Category from "@/views/Category";
import { notFound, permanentRedirect } from "next/navigation";
import { cache } from "react";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { isKnownSectionSlug } from "@/lib/sitemap";
import { getSectionForCategory } from "@/lib/sectionMapping";
import { fetchSectionArticles, isSectionKey, SECTION_ALIAS_TARGET } from "@/lib/sectionArticles";

export const revalidate = 600;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

const FIRST_PAGE = 20;

// First page of the listing, fetched on the server so crawlers (and first paint) get real
// story links instead of an empty shell. Shared by metadata and page via React cache().
const getListing = cache(async (slug: string) => {
  if (!/^[a-z0-9-]+$/.test(slug)) return null;
  try {
    return await fetchSectionArticles(createReadOnlyServerClient(), slug, 0, FIRST_PAGE - 1);
  } catch {
    return undefined; // database hiccup: fall back to the client-side fetch, never 404 a real section
  }
});

/**
 * Where an empty listing should send readers: an empty alias/legacy slug goes to the live
 * listing with the same coverage (or its parent section); an empty top-level section stays
 * (noindexed) so the nav link still works. Never points at an article.
 */
const emptyListingTarget = cache(async (slug: string): Promise<string | null> => {
  let target = SECTION_ALIAS_TARGET[slug] ?? (isSectionKey(slug) ? null : getSectionForCategory(slug));
  if (!target) return null;
  if (target === "top-stories") target = "news";
  if (target !== "news") {
    const t = await getListing(target);
    if (t && t.count === 0) target = "news";
  }
  return target;
});

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const label = getCategoryPageLabel(categorySlug) || "News";
  const canonicalUrl = `https://www.statsgh.com/${categorySlug}`;
  const description = `Latest ${label} news and data from StatsGH — Ghana's data journalism platform.`;
  const listing = await getListing(categorySlug);
  const empty = listing?.count === 0;

  return {
    title: `${label} | StatsGH`,
    description,
    // An empty listing is a soft 404 in Google's eyes: keep it out of the index until it has stories.
    ...(empty ? { robots: { index: false, follow: true } } : {}),
    alternates: {
      canonical: canonicalUrl,
      types: { "application/rss+xml": [{ url: `https://www.statsgh.com/feeds/${categorySlug}.xml`, title: `${label} | StatsGH` }] },
    },
    openGraph: { type: "website", title: `${label} | StatsGH`, description, url: canonicalUrl, siteName: "StatsGH" },
    twitter: { card: "summary_large_image", site: "@StatsGH", title: `${label} | StatsGH`, description },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;
  const listing = await getListing(categorySlug);
  if (listing === null || (listing === undefined && !isKnownSectionSlug(categorySlug))) notFound();
  // Unknown slugs must return a real 404 rather than an empty listing.
  if (listing && listing.count === 0) {
    if (!isKnownSectionSlug(categorySlug)) notFound();
    const target = await emptyListingTarget(categorySlug);
    if (target) permanentRedirect(`/${target}`);
  }
  return <Category initialArticles={listing ? listing.rows : undefined} />;
}
