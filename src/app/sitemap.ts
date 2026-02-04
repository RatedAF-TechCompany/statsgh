import { MetadataRoute } from "next";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { CATEGORY_MAPPING } from "@/lib/navigation";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createReadOnlyServerClient();
  const baseUrl = "https://statsgh.com";

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${baseUrl}/news`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/topics`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/data`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/sources`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/dashboards`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/dashboards/finance`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
    {
      url: `${baseUrl}/dashboards/gse`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.6,
    },
  ];

  // Category pages
  const categoryPages: MetadataRoute.Sitemap = Object.keys(CATEGORY_MAPPING).map(
    (slug) => ({
      url: `${baseUrl}/${slug}`,
      lastModified: new Date(),
      changeFrequency: "hourly" as const,
      priority: 0.8,
    })
  );

  // Fetch all published articles
  const { data: articles } = await supabase
    .from("articles")
    .select("slug, category_slug, updated_at, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(5000);

  const articlePages: MetadataRoute.Sitemap = (articles || []).map((article) => ({
    url: `${baseUrl}/${article.category_slug}/${article.slug}`,
    lastModified: new Date(article.updated_at || article.published_at),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Fetch topics
  const { data: topics } = await supabase
    .from("data_topics")
    .select("slug, updated_at")
    .order("display_order");

  const topicPages: MetadataRoute.Sitemap = (topics || []).map((topic) => ({
    url: `${baseUrl}/topics/${topic.slug}`,
    lastModified: new Date(topic.updated_at || new Date()),
    changeFrequency: "daily" as const,
    priority: 0.6,
  }));

  // Fetch indicators
  const { data: indicators } = await supabase
    .from("indicators")
    .select("slug, updated_at")
    .order("name");

  const indicatorPages: MetadataRoute.Sitemap = (indicators || []).map(
    (indicator) => ({
      url: `${baseUrl}/data/${indicator.slug}`,
      lastModified: new Date(indicator.updated_at || new Date()),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })
  );

  return [
    ...staticPages,
    ...categoryPages,
    ...articlePages,
    ...topicPages,
    ...indicatorPages,
  ];
}
