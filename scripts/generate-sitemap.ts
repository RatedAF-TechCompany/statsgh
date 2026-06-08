// Pre-generates public/sitemap.xml and public/news-sitemap.xml at build time
// so all sitemap URLs are served from https://statsgh.com (no cross-host references).
// Runs via predev/prebuild hooks in package.json.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://statsgh.com";
const SUPABASE_URL = "https://ofhejtwaigiqyejbvncz.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9maGVqdHdhaWdpcXllamJ2bmN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyOTE1NjUsImV4cCI6MjA3ODg2NzU2NX0.l01PfzD7KDaGQJKRoLFxoBuA46z8OsAM7F0Xc4DTLEo";

const CATEGORIES = [
  "top-stories",
  "economy-inflation",
  "public-finance",
  "labour-salaries",
  "agriculture-food",
  "energy-resources",
  "trade-investment",
  "health-data",
  "education",
  "infrastructure-transport",
  "security-governance",
  "technology-innovation",
  "environment-climate",
  "population",
  "business",
  "charts-explainers",
];

interface Article {
  slug: string;
  category_slug: string;
  published_at: string | null;
  updated_at: string | null;
  title?: string;
}

async function fetchArticles(params: string): Promise<Article[]> {
  const url = `${SUPABASE_URL}/rest/v1/articles?${params}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) {
    console.warn(`[sitemap] fetch failed (${res.status}); writing empty sitemap`);
    return [];
  }
  return (await res.json()) as Article[];
}

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function main() {
  // Main sitemap: homepage + categories + all published articles
  const articles = await fetchArticles(
    "select=slug,category_slug,published_at,updated_at&is_published=eq.true&order=published_at.desc&limit=10000",
  );

  const mainXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${BASE_URL}/</loc>
    <changefreq>hourly</changefreq>
    <priority>1.0</priority>
  </url>
${CATEGORIES.map(
  (cat) => `  <url>
    <loc>${BASE_URL}/${cat}</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`,
).join("\n")}
${articles
  .filter((a) => a.slug && a.category_slug)
  .map(
    (a) => `  <url>
    <loc>${BASE_URL}/${xmlEscape(a.category_slug)}/${xmlEscape(a.slug)}/</loc>
    <lastmod>${a.updated_at || a.published_at}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.6</priority>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  writeFileSync(resolve("public/sitemap.xml"), mainXml);
  console.log(`[sitemap] sitemap.xml written (${articles.length + CATEGORIES.length + 1} entries)`);

  // News sitemap: articles published in the last 48 hours (Google News spec)
  const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const newsArticles = await fetchArticles(
    `select=slug,category_slug,title,published_at,updated_at&is_published=eq.true&published_at=gte.${since}&order=published_at.desc&limit=1000`,
  );

  const newsXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">
${newsArticles
  .filter((a) => a.slug && a.category_slug && a.published_at)
  .map(
    (a) => `  <url>
    <loc>${BASE_URL}/${xmlEscape(a.category_slug)}/${xmlEscape(a.slug)}/</loc>
    <news:news>
      <news:publication>
        <news:name>StatsGH</news:name>
        <news:language>en</news:language>
      </news:publication>
      <news:publication_date>${a.published_at}</news:publication_date>
      <news:title>${xmlEscape(a.title ?? a.slug)}</news:title>
    </news:news>
  </url>`,
  )
  .join("\n")}
</urlset>`;

  writeFileSync(resolve("public/news-sitemap.xml"), newsXml);
  console.log(`[sitemap] news-sitemap.xml written (${newsArticles.length} entries)`);
}

main().catch((err) => {
  console.error("[sitemap] generation failed:", err);
  process.exit(0); // don't break the build
});
