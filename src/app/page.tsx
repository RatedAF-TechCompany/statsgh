import type { Metadata } from "next";
import Home from "@/views/Home";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { fetchHomepageArticles, fetchMostRead } from "@/lib/homepage-data";

export const metadata: Metadata = {
  title: "StatsGH – Ghana's Premier Data Journalism Platform",
  description:
    "Ghana's premier data journalism platform. We retell the story with numbers, openly sourced.",
  alternates: {
    canonical: "https://www.statsgh.com/",
    types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] },
  },
};

// ISR: regenerate at most every 600s; /api/revalidate refreshes it when an article publishes.
export const revalidate = 600;

// Organization/NewsMediaOrganization comes from the root layout (one @id site-wide).
// WebSite gives Google the site name; no SearchAction (Google retired the sitelinks
// search box in Nov 2024 and /search is disallowed in robots.txt).
const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.statsgh.com/#website",
  name: "StatsGH",
  alternateName: ["StatsGH.com", "Stats GH"],
  url: "https://www.statsgh.com/",
  inLanguage: "en",
  publisher: { "@id": "https://www.statsgh.com/#organization" },
};

export default async function HomePage() {
  // Server prefetch is an optimisation only: if it fails, the page still
  // renders and the client fetches the same data instead of a 500.
  let initialArticles: Awaited<ReturnType<typeof fetchHomepageArticles>> | undefined;
  let initialMostRead: Awaited<ReturnType<typeof fetchMostRead>> | undefined;
  try {
    const sb = createReadOnlyServerClient();
    const [a, m] = await Promise.allSettled([fetchHomepageArticles(sb), fetchMostRead(sb)]);
    if (a.status === "fulfilled") initialArticles = a.value;
    else console.error("Homepage articles prefetch failed", a.reason);
    if (m.status === "fulfilled") initialMostRead = m.value;
    else console.error("Most read prefetch failed", m.reason);
  } catch (error) {
    console.error("Homepage prefetch failed", error);
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <Home initialArticles={initialArticles} initialMostRead={initialMostRead} />
    </>
  );
}
