// One query definition for section/category listings, shared by the server page
// (prerendered list for crawlers and first paint) and the client Category view.
import type { SupabaseClient } from "@supabase/supabase-js";
import { crimeJusticeOrFilter, getCategoriesForSection, SECTION_TO_CATEGORIES } from "@/lib/sectionMapping";

export const SECTION_ARTICLE_COLUMNS =
  "id, title, slug, category_slug, section, summary, hero_image_url, key_data, published_at, author_name, tags";

export function sectionOrFilter(slug: string): string {
  if (slug === "crime-justice") return crimeJusticeOrFilter();
  const cats = getCategoriesForSection(slug);
  return [`category_slug.in.(${cats.map((s) => `"${s}"`).join(",")})`, `section.eq.${slug}`].join(",");
}

export async function fetchSectionArticles(sb: SupabaseClient<any>, slug: string, from: number, to: number) {
  const { data, error, count } = await sb
    .from("articles")
    .select(SECTION_ARTICLE_COLUMNS, { count: "exact" })
    .eq("is_published", true)
    .or(sectionOrFilter(slug))
    .order("published_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { rows: (data ?? []) as any[], count: count ?? 0 };
}

/**
 * Legacy or alias listing slugs that have no stories of their own, mapped to the live
 * listing that carries the same coverage. Used only when the alias itself is empty,
 * so a slug that later gets real stories keeps its own page.
 */
export const SECTION_ALIAS_TARGET: Record<string, string> = {
  "top-stories": "news",
  "labour-salaries": "labour-and-jobs",
  "trade-investment": "trade-and-industry",
  "infrastructure-transport": "infrastructure-and-transport",
  "agriculture-food": "agriculture-and-commodities",
  "technology-innovation": "technology-and-digital-economy",
  "economy-inflation": "macroeconomy",
  "environment-climate": "energy-resources",
  "security-governance": "crime-justice",
  "health-data": "research",
  education: "research",
  population: "economy",
};

export const isSectionKey = (slug: string) => slug in SECTION_TO_CATEGORIES;
