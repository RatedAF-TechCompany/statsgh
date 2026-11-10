import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { DATASETS } from "@/lib/dataVault";
import { accumulatePublicationDays } from "@/lib/archiveDates";
import { ARTICLES_PER_SITEMAP, BASE_URL, STATIC_PAGES, archiveSitemapEntries, esc, listingSlugs, xmlResponse } from "@/lib/sitemap";
import { PUBLIC_AUTHOR_SLUGS } from "@/lib/authorSlugs";

export const revalidate = 300;

const PAGE = 1000; // PostgREST row cap per request

const urlset = (body: string) => `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>`;

export async function GET(_req: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;

  if (file === "pages.xml") {
    // GSE stock pages: one per symbol in the latest stored snapshot.
    const { data: d } = await createReadOnlyServerClient().from("gse_daily_prices").select("trade_date").order("trade_date", { ascending: false }).limit(1);
    const { data: syms } = d?.[0] ? await createReadOnlyServerClient().from("gse_daily_prices").select("symbol").eq("trade_date", d[0].trade_date) : { data: [] };
    const gse = (syms ?? []).map((s: { symbol: string }) => ({ url: `${BASE_URL}/markets/gse/${encodeURIComponent(s.symbol)}`, changeFrequency: "daily" as const, priority: 0.5 }));
    const sb0 = createReadOnlyServerClient();
    const [{ data: reps }, { data: auths }] = await Promise.all([
      sb0.from("reports").select("kind, edition"),
      sb0.from("authors").select("slug").eq("is_active", true),
    ]);
    // Category/section of every published story (paged past the PostgREST 1,000-row cap).
    const cats: { category_slug: string | null; section: string | null; published_at: string | null }[] = [];
    for (let off = 0; off < 50_000; off += PAGE) {
      const { data, error } = await sb0.from("articles").select("category_slug, section, published_at").eq("is_published", true)
        .order("id", { ascending: true }).range(off, off + PAGE - 1);
      if (error) return new Response("Sitemap temporarily unavailable", { status: 503 });
      cats.push(...(data ?? []));
      if (!data || data.length < PAGE) break;
    }
    const listings = listingSlugs(cats).map((slug) => ({
      url: `${BASE_URL}/${slug}`, changeFrequency: "daily" as const, priority: 0.8,
    }));
    const extra = [
      ...archiveSitemapEntries(accumulatePublicationDays(cats)),
      ...listings,
      ...DATASETS.map((d) => ({ url: `${BASE_URL}/data-vault/${d.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
      ...(reps ?? []).map((r: { kind: string; edition: string }) => ({ url: `${BASE_URL}/reports/${r.kind}/${r.edition}`, changeFrequency: "monthly" as const, priority: 0.5 })),
      // Only author pages that render; every other slug 301s to the in-house byline.
      ...(auths ?? [])
        .filter((a: { slug: string }) => (PUBLIC_AUTHOR_SLUGS as readonly string[]).includes(a.slug))
        .map((a: { slug: string }) => ({ url: `${BASE_URL}/authors/${a.slug}`, changeFrequency: "weekly" as const, priority: 0.4 })),
    ];
    // One <url> per address (a listing slug can coincide with a static page such as /companies).
    const seen = new Set<string>();
    const all = [...STATIC_PAGES, ...gse, ...extra].filter((p) => !p.url.includes("?") && !seen.has(p.url) && seen.add(p.url));
    return xmlResponse(urlset(all.map((p) => {
      const lastmod = "lastmod" in p && p.lastmod ? `<lastmod>${esc(p.lastmod)}</lastmod>` : "";
      return `  <url><loc>${esc(p.url)}</loc>${lastmod}<changefreq>${p.changeFrequency}</changefreq><priority>${p.priority}</priority></url>`;
    }).join("\n")));
  }

  const m = /^articles-(\d+)\.xml$/.exec(file);
  if (!m || Number(m[1]) < 1) return new Response("Not found", { status: 404 });
  const start = (Number(m[1]) - 1) * ARTICLES_PER_SITEMAP;

  const sb = createReadOnlyServerClient();
  const rows: { slug: string; category_slug: string; content_updated_at: string | null; published_at: string | null }[] = [];
  for (let off = start; off < start + ARTICLES_PER_SITEMAP; off += PAGE) {
    const { data, error } = await sb.from("articles")
      .select("slug, category_slug, content_updated_at, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .order("id", { ascending: true })
      .range(off, Math.min(off + PAGE, start + ARTICLES_PER_SITEMAP) - 1);
    if (error) return new Response("Sitemap temporarily unavailable", { status: 503 });
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  if (!rows.length && start > 0) return new Response("Not found", { status: 404 });

  return xmlResponse(urlset(rows.map((a) => {
    const lm = a.content_updated_at || a.published_at;
    return `  <url><loc>${esc(`${BASE_URL}/${a.category_slug}/${a.slug}`)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ""}</url>`;
  }).join("\n")));
}
