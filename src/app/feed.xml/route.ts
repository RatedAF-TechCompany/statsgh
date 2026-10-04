import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { BASE_URL, rssXml, xmlResponse } from "@/lib/sitemap";

export const revalidate = 300;

export async function GET() {
  const { data } = await createReadOnlyServerClient().from("articles")
    .select("slug, category_slug, title, summary, published_at")
    .eq("is_published", true).order("published_at", { ascending: false }).limit(50);
  return xmlResponse(rssXml({
    title: "StatsGH", link: `${BASE_URL}/`, self: `${BASE_URL}/feed.xml`,
    description: "Ghana's data journalism platform. The latest stories, told with numbers.",
    rows: data ?? [],
  }), "application/rss+xml");
}
