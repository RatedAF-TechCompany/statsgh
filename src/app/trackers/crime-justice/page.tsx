export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import CrimeJusticeTracker from "@/views/CrimeJusticeTracker";

const title = "Crime & Justice Statistics Tracker | StatsGH";
const description = "Arrests, convictions, cases and sums involved in Ghana crime and justice stories, with regional and monthly summaries — every figure linked to its source article.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/trackers/crime-justice" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: { type: "website", title, description, url: "https://www.statsgh.com/trackers/crime-justice", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <CrimeJusticeTracker />;
}
