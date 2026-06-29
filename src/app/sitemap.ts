import { MetadataRoute } from "next";
import { createReadOnlyServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = "https://statsgh.com";

const STATIC_PAGES = [
  { url: `${BASE_URL}/`, changeFrequency: "hourly" as const, priority: 1.0 },
  { url: `${BASE_URL}/top-stories`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/economy-inflation`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/public-finance`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/labour-salaries`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/agriculture-food`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/energy-resources`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/trade-investment`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/health-data`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/education`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/infrastructure-transport`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/security-governance`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/technology-innovation`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/environment-climate`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/population`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/business`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/markets-data`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/politics-policy`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/charts-explainers`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/sources`, changeFrequency: "weekly" as const, priority: 0.5 },
  { url: `${BASE_URL}/search`, changeFrequency: "weekly" as const, priority: 0.5 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createReadOnlyServerClient();

  const { data: articles } = await supabase
    .from("articles")
    .select("slug, category_slug, updated_at, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  const articleEntries: MetadataRoute.Sitemap = (articles ?? []).map((article) => ({
    url: `${BASE_URL}/${article.category_slug}/${article.slug}`,
    lastModified: article.updated_at || article.published_at || new Date().toISOString(),
    changeFrequency: "weekly",
    priority: 0.6,
  }));

  return [...STATIC_PAGES, ...articleEntries];
}
