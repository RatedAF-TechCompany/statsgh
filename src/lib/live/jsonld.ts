import type { LivePageWithEntries } from "./types";
import { liveUrl } from "./paths";

export type LiveBlogJsonLd = {
  "@context": "https://schema.org";
  "@type": "LiveBlogPosting";
  "@id": string;
  url: string;
  headline: string;
  description: string;
  datePublished: string;
  dateModified: string;
  coverageStartTime: string;
  coverageEndTime?: string;
  inLanguage: "en";
  publisher: { "@id": string };
  author: { "@type": "Person"; name: string };
  liveBlogUpdate: Array<{
    "@type": "BlogPosting";
    "@id": string;
    headline: string;
    datePublished: string;
    dateModified?: string;
    articleBody: string;
    url: string;
    image?: string;
  }>;
};

function plain(html: string): string {
  return String(html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function liveBlogJsonLd(page: LivePageWithEntries): LiveBlogJsonLd {
  const url = liveUrl(page.path);
  const start = page.started_at || page.created_at;
  const ld: LiveBlogJsonLd = {
    "@context": "https://schema.org",
    "@type": "LiveBlogPosting",
    "@id": `${url}#liveblog`,
    url,
    headline: page.headline,
    description: page.summary_bullets.join(" "),
    datePublished: start,
    dateModified: page.content_updated_at,
    coverageStartTime: start,
    inLanguage: "en",
    publisher: { "@id": "https://www.statsgh.com/#organization" },
    author: { "@type": "Person", name: page.byline },
    liveBlogUpdate: (page.entries || []).map((e) => {
      const item: LiveBlogJsonLd["liveBlogUpdate"][number] = {
        "@type": "BlogPosting",
        "@id": `${url}#entry-${e.id}`,
        headline: e.title,
        datePublished: e.posted_at,
        dateModified: e.updated_at,
        articleBody: plain(e.body),
        url: `${url}#entry-${e.id}`,
      };
      if (e.image_url) item.image = e.image_url;
      return item;
    }),
  };
  if (page.ended_at) ld.coverageEndTime = page.ended_at;
  return ld;
}

/** Shape checks used in tests (not a network call to Google's validator). */
export function assertLiveBlogJsonLd(ld: LiveBlogJsonLd): string[] {
  const errors: string[] = [];
  if (ld["@context"] !== "https://schema.org") errors.push("missing @context");
  if (ld["@type"] !== "LiveBlogPosting") errors.push("@type must be LiveBlogPosting");
  if (!ld.headline) errors.push("headline required");
  if (!ld.url || !ld.url.startsWith("https://www.statsgh.com/live/")) errors.push("url must be the live page");
  if (!ld.coverageStartTime) errors.push("coverageStartTime required");
  if (!ld.datePublished) errors.push("datePublished required");
  if (!ld.dateModified) errors.push("dateModified required");
  if (!Array.isArray(ld.liveBlogUpdate) || ld.liveBlogUpdate.length < 1) {
    errors.push("liveBlogUpdate must be a non-empty array of BlogPosting");
  } else {
    for (const u of ld.liveBlogUpdate) {
      if (u["@type"] !== "BlogPosting") errors.push("liveBlogUpdate item must be BlogPosting");
      if (!u.headline || !u.datePublished || !u.articleBody || !u.url) {
        errors.push("BlogPosting needs headline, datePublished, articleBody, url");
      }
    }
  }
  return errors;
}
