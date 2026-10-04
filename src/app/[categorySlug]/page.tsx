import type { Metadata } from "next";
import { getSectionLabel } from "@/lib/navigation";
import Category from "@/views/Category";
import { notFound } from "next/navigation";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { feedCategories, isKnownSectionSlug } from "@/lib/sitemap";

export const revalidate = 120;
export const dynamicParams = true;
export async function generateStaticParams() { return []; }

// Unknown slugs must return a real 404 rather than an empty listing.
async function sectionExists(slug: string) {
  if (isKnownSectionSlug(slug)) return true;
  if (!/^[a-z0-9-]+$/.test(slug)) return false;
  const { count } = await createReadOnlyServerClient().from("articles")
    .select("id", { count: "exact", head: true }).eq("is_published", true).in("category_slug", feedCategories(slug));
  return (count ?? 0) > 0;
}

interface CategoryPageProps {
  params: Promise<{ categorySlug: string }>;
}

export async function generateMetadata({
  params,
}: CategoryPageProps): Promise<Metadata> {
  const { categorySlug } = await params;
  const label = getSectionLabel(categorySlug) || "News";
  const canonicalUrl = `https://www.statsgh.com/${categorySlug}`;
  const description = `Latest ${label} news and data from StatsGH — Ghana's data journalism platform.`;

  return {
    title: `${label} | StatsGH`,
    description,
    alternates: {
      canonical: canonicalUrl,
      types: { "application/rss+xml": [{ url: `https://www.statsgh.com/feeds/${categorySlug}.xml`, title: `${label} | StatsGH` }] },
    },
    openGraph: {
      type: "website",
      title: `${label} | StatsGH`,
      description,
      url: canonicalUrl,
      siteName: "StatsGH",
    },
    twitter: {
      card: "summary_large_image",
      site: "@StatsGH",
      title: `${label} | StatsGH`,
      description,
    },
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { categorySlug } = await params;
  if (!(await sectionExists(categorySlug))) notFound();
  return <Category />;
}
