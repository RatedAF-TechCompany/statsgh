import type { Metadata } from "next";
import { archiveDayPath, archiveMonthPath, formatLongDate, type Ymd } from "@/lib/archiveDates";

const BASE = "https://www.statsgh.com";

/** Canonical metadata for an archive URL. Empty and failed pages stay out of the index. */
export function archiveMetadata(path: string, title: string, description: string, index: boolean): Metadata {
  const url = `https://www.statsgh.com${path}`;
  return {
    title,
    description,
    alternates: {
      canonical: url,
      types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] },
    },
    openGraph: { type: "website", title, description, url, siteName: "StatsGH" },
    twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
    ...(index ? {} : { robots: { index: false, follow: true } }),
  };
}

export function breadcrumbLd(items: { path: string; label: string }[]) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.label,
      item: `${BASE}${item.path}`,
    })),
  };
}

export function collectionLd(opts: {
  path: string;
  name: string;
  description: string;
  crumbs: { path: string; label: string }[];
  articles?: { path: string; name: string }[];
}) {
  const page: Record<string, unknown> = {
    "@type": "CollectionPage",
    name: opts.name,
    description: opts.description,
    url: `${BASE}${opts.path}`,
    inLanguage: "en",
    isPartOf: { "@id": "https://www.statsgh.com/#website" },
  };
  if (opts.articles) {
    page.mainEntity = {
      "@type": "ItemList",
      numberOfItems: opts.articles.length,
      itemListOrder: "https://schema.org/ItemListOrderDescending",
      itemListElement: opts.articles.map((article, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: article.name,
        url: `${BASE}${article.path}`,
      })),
    };
  }
  return { "@context": "https://schema.org", "@graph": [page, breadcrumbLd(opts.crumbs)] };
}

export function dayNavEnds(prev: Ymd | null, next: Ymd | null) {
  return {
    prev: prev ? { href: archiveDayPath(prev.year, prev.month, prev.day), label: formatLongDate(prev.year, prev.month, prev.day) } : null,
    next: next ? { href: archiveDayPath(next.year, next.month, next.day), label: formatLongDate(next.year, next.month, next.day) } : null,
  };
}

export function monthNavEnds(prev: { year: number; month: number } | null, next: { year: number; month: number } | null) {
  return {
    prev: prev ? { href: archiveMonthPath(prev.year, prev.month), label: formatLongDate(prev.year, prev.month) } : null,
    next: next ? { href: archiveMonthPath(next.year, next.month), label: formatLongDate(next.year, next.month) } : null,
  };
}
