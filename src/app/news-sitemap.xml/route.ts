import { createReadOnlyServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = "https://www.statsgh.com";

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

  // Google News sitemap: articles published in the last 48 hours (Google News rule)
  // (publication_date always stays the original published_at)
  const fortyEightHoursAgo = new Date();
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

  const { data: articles } = await supabase
    .from("articles")
    .select("slug, category_slug, title, published_at, content_updated_at")
    .eq("is_published", true)
    .eq("is_sponsored", false)
    .gte("published_at", fortyEightHoursAgo.toISOString())
    .order("published_at", { ascending: false })
    .limit(1000);

  // Public live blogs started or updated in the same 48-hour window.
  // Ignore errors so a missing table (migration not yet applied) cannot break the news sitemap.
  let lives: { path: string; headline: string; started_at: string | null; content_updated_at: string | null; created_at: string | null }[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lr = await (supabase as any)
      .from("live_pages")
      .select("path, headline, started_at, content_updated_at, created_at")
      .eq("visibility", "public")
      .in("status", ["live", "ended"])
      .or(`started_at.gte.${fortyEightHoursAgo.toISOString()},content_updated_at.gte.${fortyEightHoursAgo.toISOString()}`)
      .limit(200);
    if (!lr.error) lives = lr.data ?? [];
  } catch { /* table may not exist yet */ }

  const liveUrls = (lives ?? []).map((page) => {
    const published = page.started_at || page.created_at;
    return `  <url>
    <loc>${BASE_URL}/live/${page.path}</loc>
    <news:news>
      <news:publication>
        <news:name>StatsGH</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${published}</news:publication_date>
      <news:title>${escapeXml(page.headline)}</news:title>
    </news:news>
    <lastmod>${page.content_updated_at || published}</lastmod>
  </url>`;
  });

  const urls = [
    ...(articles ?? []).map(
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
    <lastmod>${article.content_updated_at || article.published_at}</lastmod>
  </url>`
    )
    .join("\n"),
    ...liveUrls,
  ].filter(Boolean).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urls}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    },
  });
}
