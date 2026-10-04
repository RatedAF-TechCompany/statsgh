import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { DATASETS } from "@/lib/dataVault";
import { ARTICLES_PER_SITEMAP, BASE_URL, STATIC_PAGES, esc, xmlResponse } from "@/lib/sitemap";

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
    const extra = [
      ...DATASETS.map((d) => ({ url: `${BASE_URL}/data-vault/${d.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
      ...(reps ?? []).map((r: { kind: string; edition: string }) => ({ url: `${BASE_URL}/reports/${r.kind}/${r.edition}`, changeFrequency: "monthly" as const, priority: 0.5 })),
      ...(auths ?? []).map((a: { slug: string }) => ({ url: `${BASE_URL}/authors/${a.slug}`, changeFrequency: "weekly" as const, priority: 0.4 })),
    ];
    return xmlResponse(urlset([...STATIC_PAGES, ...gse, ...extra].map((p) =>
      `  <url><loc>${p.url}</loc><changefreq>${p.changeFrequency}</changefreq><priority>${p.priority}</priority></url>`).join("\n")));
  }

  const m = /^articles-(\d+)\.xml$/.exec(file);
  if (!m || Number(m[1]) < 1) return new Response("Not found", { status: 404 });
  const start = (Number(m[1]) - 1) * ARTICLES_PER_SITEMAP;

  const sb = createReadOnlyServerClient();
  const rows: { slug: string; category_slug: string; updated_at: string | null; published_at: string | null }[] = [];
  for (let off = start; off < start + ARTICLES_PER_SITEMAP; off += PAGE) {
    const { data, error } = await sb.from("articles")
      .select("slug, category_slug, updated_at, published_at")
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
    const lm = a.updated_at || a.published_at;
    return `  <url><loc>${esc(`${BASE_URL}/${a.category_slug}/${a.slug}`)}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ""}</url>`;
  }).join("\n")));
}
