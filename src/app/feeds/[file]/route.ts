import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { getSectionLabel } from "@/lib/navigation";
import { BASE_URL, feedCategories, isKnownSectionSlug, rssXml, xmlResponse } from "@/lib/sitemap";

export const revalidate = 300;

// Per-category feeds: /feeds/<category>.xml (crime-justice has its own tag-based route).
export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const m = /^([a-z0-9-]+)\.xml$/.exec(file);
  if (!m) return new Response("Not found", { status: 404 });
  const slug = m[1];
  const sb = createReadOnlyServerClient();
  const cats = feedCategories(slug);
  const { data } = await sb.from("articles")
    .select("slug, category_slug, title, summary, published_at")
    .eq("is_published", true).in("category_slug", cats)
    .order("published_at", { ascending: false }).limit(50);
  if (!isKnownSectionSlug(slug) && !(data && data.length)) return new Response("Not found", { status: 404 });
  const label = getSectionLabel(slug);
  return xmlResponse(rssXml({
    title: `${label} | StatsGH`, link: `${BASE_URL}/${slug}`, self: `${BASE_URL}/feeds/${slug}.xml`,
    description: `Latest ${label} stories from StatsGH.`, rows: data ?? [],
  }), "application/rss+xml");
}
