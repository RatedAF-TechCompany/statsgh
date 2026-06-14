import { createReadOnlyServerClient } from "@/lib/supabase/server";

const BASE_URL = "https://statsgh.com";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET() {
  const supabase = createReadOnlyServerClient();

  // Google News sitemap spec: only articles from the last 48 hours
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

  const { data: articles } = await supabase
    .from("articles")
    .select("slug, category_slug, title, published_at, updated_at")
    .eq("is_published", true)
    .gte("published_at", fortyEightHoursAgo.toISOString())
    .order("published_at", { ascending: false })
    .limit(1000);

  const urls = (articles ?? [])
    .map(
      (article) => `  <url>
    <loc>${BASE_URL}/${article.category_slug}/${article.slug}</loc>
    <news:news>
      <news:publication>
        <news:name>StatsGH</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${article.published_at}</news:publication_date>
      <news:title>${escapeXml(article.title)}</news:title>
    </news:news>
    <lastmod>${article.updated_at || article.published_at}</lastmod>
  </url>`
    )
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
