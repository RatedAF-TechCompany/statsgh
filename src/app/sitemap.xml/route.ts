import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { ARTICLES_PER_SITEMAP, BASE_URL, xmlResponse } from "@/lib/sitemap";

export const revalidate = 300;

// Sitemap index: pages sitemap + one child sitemap per 5,000 published articles + news sitemap.
export async function GET() {
  const sb = createReadOnlyServerClient();
  const { count } = await sb.from("articles").select("id", { count: "exact", head: true }).eq("is_published", true);
  const n = Math.max(1, Math.ceil((count ?? 0) / ARTICLES_PER_SITEMAP));
  const locs = [
    `${BASE_URL}/sitemaps/pages.xml`,
    ...Array.from({ length: n }, (_, i) => `${BASE_URL}/sitemaps/articles-${i + 1}.xml`),
    `${BASE_URL}/news-sitemap.xml`,
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${locs.map((l) => `  <sitemap><loc>${l}</loc></sitemap>`).join("\n")}
</sitemapindex>`;
  return xmlResponse(xml);
}
