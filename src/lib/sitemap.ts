// Shared helpers for sitemaps and RSS feeds. All URLs use the www origin.
import { getCategoriesForSection, SECTION_TO_CATEGORIES } from "@/lib/sectionMapping";

export const BASE_URL = "https://www.statsgh.com";
export const ARTICLES_PER_SITEMAP = 5000;
export const SITEMAP_CACHE = "public, max-age=0, s-maxage=300, stale-while-revalidate=600";

export const STATIC_PAGES = [
  { url: `${BASE_URL}/`, changeFrequency: "hourly" as const, priority: 1.0 },
  { url: `${BASE_URL}/top-stories`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/economy-inflation`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/public-finance`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/labour-salaries`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/agriculture-food`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/energy-resources`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/trade-investment`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/health-data`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/education`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/infrastructure-transport`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/security-governance`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/technology-innovation`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/environment-climate`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/population`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/business`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/markets-data`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/trackers/fuel-and-cedi`, changeFrequency: "daily" as const, priority: 0.7 },
  { url: `${BASE_URL}/trackers/inflation`, changeFrequency: "weekly" as const, priority: 0.7 },
  { url: `${BASE_URL}/trackers/crime-justice`, changeFrequency: "daily" as const, priority: 0.7 },
  { url: `${BASE_URL}/glossary`, changeFrequency: "monthly" as const, priority: 0.5 },
  { url: `${BASE_URL}/tools/cost-of-living`, changeFrequency: "weekly" as const, priority: 0.7 },
  { url: `${BASE_URL}/week-in-numbers`, changeFrequency: "weekly" as const, priority: 0.7 },
  { url: `${BASE_URL}/explorer`, changeFrequency: "daily" as const, priority: 0.7 },
  { url: `${BASE_URL}/politics-policy`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/charts-explainers`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/crime-justice`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/markets/forex`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/markets/gse`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/markets/rates`, changeFrequency: "daily" as const, priority: 0.8 },
  { url: `${BASE_URL}/dashboards/finance`, changeFrequency: "daily" as const, priority: 0.6 },
  { url: `${BASE_URL}/contact`, changeFrequency: "yearly" as const, priority: 0.3 },
  { url: `${BASE_URL}/advertise`, changeFrequency: "monthly" as const, priority: 0.3 },
  { url: `${BASE_URL}/newsletter`, changeFrequency: "monthly" as const, priority: 0.4 },
  { url: `${BASE_URL}/privacy`, changeFrequency: "yearly" as const, priority: 0.2 },
  { url: `${BASE_URL}/terms`, changeFrequency: "yearly" as const, priority: 0.2 },
  { url: `${BASE_URL}/about`, changeFrequency: "monthly" as const, priority: 0.5 },
  { url: `${BASE_URL}/corrections`, changeFrequency: "weekly" as const, priority: 0.4 },
  { url: `${BASE_URL}/sources`, changeFrequency: "weekly" as const, priority: 0.5 },
];

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Every slug that names a known section or one of its category slugs. */
export function isKnownSectionSlug(slug: string): boolean {
  return slug in SECTION_TO_CATEGORIES || Object.values(SECTION_TO_CATEGORIES).some((c) => c.includes(slug));
}

/** Category slugs a feed/section slug should include. */
export function feedCategories(slug: string): string[] {
  return slug in SECTION_TO_CATEGORIES ? getCategoriesForSection(slug) : [slug];
}

export function xmlResponse(xml: string, type = "application/xml") {
  return new Response(xml, { headers: { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": SITEMAP_CACHE } });
}

type FeedRow = { slug: string; category_slug: string; title: string; summary: string | null; published_at: string | null };

export function rssXml(opts: { title: string; link: string; self: string; description: string; rows: FeedRow[] }) {
  const items = opts.rows
    .map((a) => {
      const url = `${BASE_URL}/${a.category_slug}/${a.slug}`;
      return `<item><title>${esc(a.title)}</title><link>${url}</link><guid isPermaLink="true">${url}</guid>${
        a.published_at ? `<pubDate>${new Date(a.published_at).toUTCString()}</pubDate>` : ""
      }<category>${esc(a.category_slug)}</category><description>${esc(a.summary || "")}</description></item>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
<channel>
<title>${esc(opts.title)}</title>
<link>${opts.link}</link>
<atom:link href="${opts.self}" rel="self" type="application/rss+xml"/>
<description>${esc(opts.description)}</description>
<language>en-gh</language>
${items}
</channel>
</rss>`;
}
