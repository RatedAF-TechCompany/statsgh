import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { crimeJusticeOrFilter } from "@/lib/sectionMapping";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const BASE_URL = "https://statsgh.com";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

export async function GET() {
  let items = "";
  try {
    const supabase = createReadOnlyServerClient();
    const { data } = await supabase
      .from("articles")
      .select("slug, category_slug, title, summary, published_at, author_name")
      .eq("is_published", true)
      .or(crimeJusticeOrFilter())
      .order("published_at", { ascending: false })
      .limit(50);
    items = (data || [])
      .map((a) => {
        const url = `${BASE_URL}/${a.category_slug}/${a.slug}`;
        return `<item><title>${esc(a.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid>${
          a.published_at ? `<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>` : ""
        }${a.author_name ? `<dc:creator>${esc(a.author_name)}</dc:creator>` : ""}<description>${esc(a.summary || "")}</description></item>`;
      })
      .join("");
  } catch {
    items = "";
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
<title>Crime &amp; Justice | StatsGH</title>
<link>${BASE_URL}/crime-justice</link>
<atom:link href="${BASE_URL}/feeds/crime-justice.xml" rel="self" type="application/rss+xml"/>
<description>Crime, courts, policing and corruption in Ghana, reported through the numbers.</description>
<language>en-gh</language>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=900" },
  });
}
