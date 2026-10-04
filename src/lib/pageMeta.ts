import type { Metadata } from "next";

/** Standard metadata for a static StatsGH page (www canonical, OG, Twitter, RSS alternate). */
export function pageMeta(path: string, title: string, description: string): Metadata {
  const url = `https://www.statsgh.com${path}`;
  const full = `${title} | StatsGH`;
  return {
    title: full,
    description,
    alternates: { canonical: url, types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
    openGraph: { type: "website", title: full, description, url, siteName: "StatsGH" },
    twitter: { card: "summary_large_image", site: "@StatsGH", title: full, description },
  };
}
