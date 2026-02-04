import { createReadOnlyServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const supabase = createReadOnlyServerClient();
  const baseUrl = "https://statsgh.com";

  // Google News recommends articles from last 48 hours
  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

  const { data: articles } = await supabase
    .from("articles")
    .select("slug, category_slug, title, published_at, tags")
    .eq("is_published", true)
    .gte("published_at", twoDaysAgo.toISOString())
    .order("published_at", { ascending: false })
    .limit(1000);

  const urlEntries = (articles || [])
    .map((article) => {
      const pubDate = new Date(article.published_at).toISOString();
      const keywords = article.tags?.join(", ") || "";

      return `
    <url>
      <loc>${baseUrl}/${article.category_slug}/${article.slug}</loc>
      <news:news>
        <news:publication>
          <news:name>StatsGH</news:name>
          <news:language>en</news:language>
        </news:publication>
        <news:publication_date>${pubDate}</news:publication_date>
        <news:title><![CDATA[${article.title}]]></news:title>
        ${keywords ? `<news:keywords><![CDATA[${keywords}]]></news:keywords>` : ""}
      </news:news>
    </url>`;
    })
    .join("");

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${urlEntries}
</urlset>`;

  return new Response(sitemap, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
