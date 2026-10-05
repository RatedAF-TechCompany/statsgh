export const revalidate = 600; // cached listing page: revalidate at most every 10 minutes
import type { Metadata } from "next";
import DataExplorer from "@/views/DataExplorer";

const title = "Data Explorer — Ghana statistics | StatsGH";
const description = "Search and chart every indicator, tracker and key number stored on StatsGH, with sources, last-updated dates, CSV downloads and shareable cards.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/explorer" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: { type: "website", title, description, url: "https://www.statsgh.com/explorer", siteName: "StatsGH" },
  twitter: { card: "summary_large_image", site: "@StatsGH" },
};

export default function Page() {
  return <DataExplorer />;
}
