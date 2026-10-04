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

// ISR: regenerate at most every 120s; /api/revalidate refreshes it when an article publishes.
export const revalidate = 120;

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "StatsGH",
    url: "https://www.statsgh.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://www.statsgh.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StatsGH",
    url: "https://www.statsgh.com",
    logo: "https://www.statsgh.com/social/statsgh-og-1200x630.png",
    sameAs: ["https://twitter.com/StatsGH"],
  },
];

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
