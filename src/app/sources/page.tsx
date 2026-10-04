export const dynamic = "force-dynamic"; // personalised/live page: render per request
import type { Metadata } from "next";
import Sources from "@/views/Sources";

const title = "Data Sources | StatsGH";
const description =
  "The official data sources behind StatsGH reporting — statistical agencies, central bank, and public institutions in Ghana.";

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: "https://www.statsgh.com/sources" , types: { "application/rss+xml": [{ url: "https://www.statsgh.com/feed.xml", title: "StatsGH" }] } },
  openGraph: {
    type: "website",
    title,
    description,
    url: "https://www.statsgh.com/sources",
    siteName: "StatsGH",
  },
  twitter: { card: "summary_large_image", site: "@StatsGH", title, description },
};

export default function SourcesPage() {
  return <Sources />;
}
