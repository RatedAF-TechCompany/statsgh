import type { Metadata } from "next";
import Home from "@/views/Home";
import { createReadOnlyServerClient } from "@/lib/supabase/server";
import { fetchHomepageArticles, fetchMostRead } from "@/lib/homepage-data";

export const metadata: Metadata = {
  title: "StatsGH – Ghana's Premier Data Journalism Platform",
  description:
    "Ghana's premier data journalism platform. We retell the story with numbers, openly sourced.",
  alternates: { canonical: "https://statsgh.com/" },
};

const jsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "StatsGH",
    url: "https://statsgh.com",
    potentialAction: {
      "@type": "SearchAction",
      target: "https://statsgh.com/search?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StatsGH",
    url: "https://statsgh.com",
    logo: "https://statsgh.com/social/statsgh-og-1200x630.png",
    sameAs: ["https://twitter.com/StatsGH"],
  },
];

export default async function HomePage() {
  const sb = createReadOnlyServerClient();
  const [initialArticles, initialMostRead] = await Promise.all([
    fetchHomepageArticles(sb),
    fetchMostRead(sb),
  ]);

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
